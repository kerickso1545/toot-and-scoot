// js/input.js — shared gamepad normalization + a small action layer.
// Classic script (ONE global scope, ES5). Loaded before ui.js/main.js.
//
// Why this exists: the game read raw standard-mapping indices
// (buttons[0..16], axes[0..3]) with NO handling for a pad that reports
// `mapping !== "standard"`. A pad in that state silently misses every
// button. This module normalizes every pad to standard POSITIONS so the
// rest of the game keeps reading buttons[0]=south, buttons[1]=east, etc.,
// regardless of the physical brand.
//
// Positions are canonical; letters are display-only. A "south" button is the
// bottom face button on ANY pad — it's labelled B on a Switch pad and A on an
// Xbox pad. Keeping the game position-based is what lets the same code drive
// the family's Switch pads and an Xbox pad, and what lets the Help Panel swap
// its letters by controller type without touching any logic.
var Input = (function () {
  var STD = 'standard';

  // Face-button POSITIONS (standard-mapping indices). Controller-agnostic.
  var FACE = { south: 0, east: 1, west: 2, north: 3 };

  // Per-type letters for the SAME physical positions. Used only for display
  // (Help Panel, on-screen hints) — never for logic.
  var LETTERS = {
    xbox:   { south: 'A', east: 'B', west: 'X', north: 'Y' },
    // Switch face layout: A is on the RIGHT, B on the BOTTOM (swapped vs Xbox)
    nintendo: { south: 'B', east: 'A', west: 'Y', north: 'X' }
  };

  // Remap tables for pads that report a NON-standard mapping. Keyed by a
  // lowercase substring of gamepad.id. Each maps a STANDARD index to the raw
  // index this device actually reports it at. Leave a slot out to pass it
  // through unchanged. Filled in from a live Controller Check readout — a
  // blind guess would be worse than the honest standard fallback below.
  //   { match:'…', type:'xbox'|'nintendo', buttons:{std:raw,…}, axes:{std:raw,…} }
  var REMAPS = [];

  function guessType(id) {
    id = (id || '').toLowerCase();
    if (id.indexOf('xbox') >= 0 || id.indexOf('xinput') >= 0 || id.indexOf('045e') >= 0) return 'xbox';
    if (id.indexOf('nintendo') >= 0 || id.indexOf('switch') >= 0 || id.indexOf('joy-con') >= 0 ||
        id.indexOf('pro controller') >= 0 || id.indexOf('057e') >= 0 || id.indexOf('8bitdo') >= 0) return 'nintendo';
    return 'xbox';   // default art/letters: Xbox is the standard-mapping reference layout
  }

  function findRemap(id) {
    id = (id || '').toLowerCase();
    for (var i = 0; i < REMAPS.length; i++) if (id.indexOf(REMAPS[i].match) >= 0) return REMAPS[i];
    return null;
  }

  function btnAt(gp, i) {
    var b = gp.buttons && gp.buttons[i];
    if (!b) return { pressed: false, value: 0 };
    // Gamepad button entries are {pressed, value}; snapshot (never cache the
    // live Gamepad object across frames — this makes a fresh copy each call).
    return { pressed: !!b.pressed, value: b.value || 0 };
  }
  function axAt(gp, i) { return (gp.axes && gp.axes[i]) || 0; }

  // Normalize ONE raw Gamepad into a standard-position snapshot the rest of
  // the game reads exactly like a native standard pad: .buttons[i].pressed,
  // .axes[i], .index, .id, .mapping, .connected — plus .type / .remapped.
  function normalize(gp) {
    if (!gp) return null;
    var std = gp.mapping === STD;
    var rm = std ? null : findRemap(gp.id);
    var out = {
      index: gp.index, id: gp.id, mapping: gp.mapping, connected: !!gp.connected,
      type: (rm && rm.type) || guessType(gp.id),
      remapped: !!rm, nonStandard: !std,
      buttons: [], axes: []
    };
    var i;
    if (std || !rm) {
      // Standard mapping (or unknown non-standard with no table): pass the
      // reported layout straight through. For a truly standard pad this is
      // exactly today's behavior; for an unknown non-standard pad it is the
      // honest best effort until a REMAPS entry is added from real data.
      for (i = 0; i < 17; i++) out.buttons[i] = btnAt(gp, i);
      for (i = 0; i < 4; i++) out.axes[i] = axAt(gp, i);
    } else {
      for (i = 0; i < 17; i++) {
        var rb = rm.buttons && (rm.buttons[i] !== undefined) ? rm.buttons[i] : i;
        out.buttons[i] = btnAt(gp, rb);
      }
      for (i = 0; i < 4; i++) {
        var ra = rm.axes && (rm.axes[i] !== undefined) ? rm.axes[i] : i;
        out.axes[i] = axAt(gp, ra);
      }
    }
    return out;
  }

  // Live list of normalized, connected pads (fresh snapshot every call).
  function pads() {
    var out = [];
    if (navigator.getGamepads) {
      var raw = navigator.getGamepads();
      for (var i = 0; i < raw.length; i++) if (raw[i] && raw[i].connected) out.push(normalize(raw[i]));
    }
    return out;
  }
  function byIndex(i) {
    if (i === null || i === undefined || i < 0 || !navigator.getGamepads) return null;
    var raw = navigator.getGamepads()[i];
    return (raw && raw.connected) ? normalize(raw) : null;
  }

  // ---- position-based action reads (a normalized pad in, boolean/number out) ----
  // Central place the button->action mapping lives. Matches the game's current
  // Switch-style layout by POSITION: south = fart, east = use item, north/west
  // = super, L3/LT = sprint, Menu(+) = pause. Consumers still track their own
  // edges (prev-state) to match the existing suppress-until-released style.
  function b(np, i) { return !!(np && np.buttons[i] && np.buttons[i].pressed); }
  var act = {
    fart:  function (np) { return b(np, FACE.south) || b(np, 7); },        // south or RT
    item:  function (np) { return b(np, FACE.east); },                     // east
    'super': function (np) { return b(np, FACE.west) || b(np, FACE.north); }, // west or north
    sprint:function (np) { return b(np, 10) || b(np, 6); },                 // L3 or LT
    pause: function (np) { return b(np, 9); },                             // Menu (+)
    claim: function (np) { return b(np, FACE.south); },                    // join: south claims
    leave: function (np) { return b(np, FACE.east); },                     // join: east leaves
    confirm: function (np) { return b(np, FACE.south) || b(np, FACE.east); }, // menus: south or east
    navUp:   function (np) { return b(np, 12) || (np && np.axes[1] < -0.5); },
    navDown: function (np) { return b(np, 13) || (np && np.axes[1] > 0.5); },
    navLeft: function (np) { return b(np, 14) || (np && np.axes[0] < -0.5); },
    navRight:function (np) { return b(np, 15) || (np && np.axes[0] > 0.5); }
  };

  return {
    FACE: FACE, LETTERS: LETTERS, REMAPS: REMAPS,
    normalize: normalize, pads: pads, byIndex: byIndex,
    guessType: guessType, act: act, button: b
  };
})();
