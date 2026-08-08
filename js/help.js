// js/help.js — Controller Help Panel + live controller test screen.
//
// Classic script (ONE global scope, ES5). NO import/export, NO "use strict".
// Depends on the global `Input` object from js/input.js (loaded before this).
// This file must be loaded AFTER js/input.js. It builds its own #helppanel
// container in the <body> at load time (a fixed centered .menu-style overlay
// that behaves exactly like #rulespanel: simple display:block/none show/hide).
//
// Public surface (all global, wire these up from main.js/ui.js):
//   helpOpen              — boolean, true while the panel is showing
//   openHelp()            — show the panel
//   closeHelp()           — hide the panel
//   updateHelpHighlight() — call once per frame from animate() to light up
//                           pressed buttons, deflect sticks, fill triggers.
//
// Everything is drawn as inline SVG built in code — no image assets. The
// controller-type toggle (Nintendo Switch <-> Xbox) swaps ONLY the face-button
// letters and the art accent colors; button POSITIONS and their in-game action
// never change (the game is position-based; see js/input.js).

var helpOpen = false;

// Selected controller type for the ART/LETTERS ('nintendo' | 'xbox').
// Default: Nintendo Switch (the family plays with two Switch-style pads).
var helpType = 'nintendo';

// SVG namespace + cached element handles for the live highlight (filled in
// buildHelpSVG). Kept module-global so updateHelpHighlight() is allocation-free.
var HELP_NS = 'http://www.w3.org/2000/svg';
var helpEls = null;          // { btn:{0..16}, lstick, rstick, ltFill, rtFill, ... }
var helpBuilt = false;       // SVG + labels built once, lazily on first open

// Accent palette per controller type. Positions/actions never change; only
// these colors + the face letters differ. Xbox: green guide + colored ABXY
// ring hint; Switch: red/blue Joy-Con accents, dark face buttons.
var HELP_ACCENT = {
  xbox:     { guide: '#57b93a', shellA: '#3a4a63', shellB: '#26324a', accent: '#57b93a' },
  nintendo: { guide: '#e5322b', shellA: '#3a4a63', shellB: '#26324a', accent: '#2f6fe0' }
};

// In-game action + keyboard equivalent for every control we label. Face
// buttons are keyed by POSITION (south/east/west/north); the visible letter is
// looked up per type from Input.LETTERS at build time.
// Each: { pos:standardIndex, title:'Action', key:'Keyboard' }.
var HELP_ACTIONS = {
  lstick: { title: 'Move',            key: 'WASD' },
  rstick: { title: 'Camera / Aim',    key: 'Mouse' },
  south:  { pos: 0,  title: 'Fart! (drop gas bomb)', key: 'Space / Click' },
  east:   { pos: 1,  title: 'Use item',   key: 'E' },
  west:   { pos: 2,  title: 'Superpower', key: 'Q' },
  north:  { pos: 3,  title: 'Superpower', key: 'Q' },
  lt:     { pos: 6,  title: 'Sprint',     key: 'Shift' },
  rt:     { pos: 7,  title: 'Fart!',      key: 'Space / Click' },
  l3:     { pos: 10, title: 'Sprint (click stick)', key: 'Shift' },
  menu:   { pos: 9,  title: 'Pause',      key: 'Esc' },
  lb:     { pos: 4,  title: 'unused',     key: '' },
  rb:     { pos: 5,  title: 'unused',     key: '' },
  view:   { pos: 8,  title: 'unused',     key: '' },
  guide:  { pos: 16, title: 'unused',     key: '' }
};

// ---- small SVG helpers -------------------------------------------------
function helpSvg(tag, attrs) {
  var e = document.createElementNS(HELP_NS, tag);
  if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
  return e;
}
function helpText(x, y, str, cls, size) {
  var t = helpSvg('text', {
    x: x, y: y, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
    'font-family': 'Arial Black, Arial, sans-serif',
    'font-size': (size || 18), 'font-weight': 'bold', fill: '#fff'
  });
  if (cls) t.setAttribute('class', cls);
  t.textContent = str;
  return t;
}

// ---- build the panel DOM once -----------------------------------------
function buildHelpPanel() {
  if (helpBuilt) return;
  helpBuilt = true;

  var panel = document.getElementById('helppanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'helppanel';
    panel.className = 'menu';
    panel.style.display = 'none';
    document.body.appendChild(panel);
  }

  // Header
  var h2 = document.createElement('h2');
  h2.textContent = 'Controller';
  panel.appendChild(h2);

  // Type toggle (Switch / Xbox). Chunky segmented control.
  var toggle = document.createElement('div');
  toggle.id = 'helptoggle';
  var bSwitch = document.createElement('button');
  bSwitch.id = 'helpTypeSwitch';
  bSwitch.className = 'helptypebtn';
  bSwitch.type = 'button';
  bSwitch.textContent = 'Nintendo Switch';
  bSwitch.onclick = function () { setHelpType('nintendo'); };
  var bXbox = document.createElement('button');
  bXbox.id = 'helpTypeXbox';
  bXbox.className = 'helptypebtn';
  bXbox.type = 'button';
  bXbox.textContent = 'Xbox';
  bXbox.onclick = function () { setHelpType('xbox'); };
  toggle.appendChild(bSwitch);
  toggle.appendChild(bXbox);
  panel.appendChild(toggle);

  // "No controller" hint (shown when zero pads connected).
  var hint = document.createElement('div');
  hint.id = 'helphint';
  hint.textContent = 'No controller detected — connect one and press a button.';
  panel.appendChild(hint);

  // SVG stage.
  var stage = document.createElement('div');
  stage.id = 'helpstage';
  panel.appendChild(stage);

  buildHelpSVG(stage);

  // Close button (chunky red brick). Escape + East(B) are wired in main.js.
  var close = document.createElement('button');
  close.id = 'helpclose';
  close.className = 'mbtn';
  close.type = 'button';
  close.textContent = 'Close (B / Esc)';
  close.onclick = function () { closeHelp(); };
  panel.appendChild(close);

  applyHelpType();
}

// Build the controller SVG (art + labels) into `stage`. viewBox is 800x520;
// CSS scales it to ~600px wide. Layout is symmetric with leader lines running
// from short labels out to each control.
function buildHelpSVG(stage) {
  var svg = helpSvg('svg', {
    id: 'helpsvg', viewBox: '0 0 800 520',
    width: '100%', preserveAspectRatio: 'xMidYMid meet',
    role: 'img', 'aria-label': 'Game controller diagram'
  });
  helpEls = { btn: {} };

  // --- shell -----------------------------------------------------------
  // Body: two rounded grips joined by a center. Drawn as one glossy blob.
  var shell = helpSvg('path', {
    id: 'helpshell',
    d: 'M180 150 ' +
       'C110 150 70 210 70 290 C70 380 110 430 175 430 ' +
       'C225 430 250 400 300 395 L500 395 ' +
       'C550 400 575 430 625 430 C690 430 730 380 730 290 ' +
       'C730 210 690 150 620 150 C560 150 520 175 480 180 L320 180 ' +
       'C280 175 240 150 180 150 Z',
    fill: 'url(#helpShellGrad)', stroke: 'var(--ink)', 'stroke-width': 7
  });
  // gradient defs
  var defs = helpSvg('defs', {});
  var grad = helpSvg('linearGradient', { id: 'helpShellGrad', x1: '0', y1: '0', x2: '0', y2: '1' });
  var s1 = helpSvg('stop', { offset: '0%', 'stop-color': '#3a4a63' });
  var s2 = helpSvg('stop', { offset: '100%', 'stop-color': '#26324a' });
  grad.appendChild(s1); grad.appendChild(s2);
  defs.appendChild(grad);
  helpEls.shellStops = [s1, s2];
  svg.appendChild(defs);
  svg.appendChild(shell);
  // gloss highlight across the top
  svg.appendChild(helpSvg('path', {
    d: 'M170 165 C240 158 560 158 630 165 C560 200 240 200 170 165 Z',
    fill: 'var(--gloss)', opacity: '0.5', 'pointer-events': 'none'
  }));

  // --- left analog stick ----------------------------------------------
  var lsx = 210, lsy = 260;
  svg.appendChild(helpSvg('circle', { cx: lsx, cy: lsy, r: 52, fill: '#141c30', stroke: 'var(--ink)', 'stroke-width': 5 }));
  var lstick = helpSvg('circle', { cx: lsx, cy: lsy, r: 38, fill: '#5a6b86', stroke: 'var(--ink)', 'stroke-width': 5 });
  svg.appendChild(lstick);
  helpEls.lstick = lstick; helpEls.lsx = lsx; helpEls.lsy = lsy;

  // --- d-pad -----------------------------------------------------------
  var dpx = 300, dpy = 360, a = 22;
  var dpad = helpSvg('path', {
    d: 'M' + (dpx - a) + ' ' + (dpy - a * 3) + ' h' + (2 * a) + ' v' + (2 * a) +
       ' h' + (2 * a) + ' v' + (2 * a) + ' h' + (-2 * a) + ' v' + (2 * a) +
       ' h' + (-2 * a) + ' v' + (-2 * a) + ' h' + (-2 * a) + ' v' + (-2 * a) +
       ' h' + (2 * a) + ' Z',
    fill: '#2a3245', stroke: 'var(--ink)', 'stroke-width': 5
  });
  svg.appendChild(dpad);
  // clickable-ish d-pad direction cells for highlight (Up/Down/Left/Right)
  helpEls.btn[12] = helpSvg('rect', { x: dpx - a, y: dpy - a * 3, width: 2 * a, height: 2 * a, rx: 4, fill: '#3a4560', opacity: '0.01' }); // Up
  helpEls.btn[13] = helpSvg('rect', { x: dpx - a, y: dpy + a,     width: 2 * a, height: 2 * a, rx: 4, fill: '#3a4560', opacity: '0.01' }); // Down
  helpEls.btn[14] = helpSvg('rect', { x: dpx - a * 3, y: dpy - a, width: 2 * a, height: 2 * a, rx: 4, fill: '#3a4560', opacity: '0.01' }); // Left
  helpEls.btn[15] = helpSvg('rect', { x: dpx + a, y: dpy - a,     width: 2 * a, height: 2 * a, rx: 4, fill: '#3a4560', opacity: '0.01' }); // Right
  svg.appendChild(helpEls.btn[12]); svg.appendChild(helpEls.btn[13]);
  svg.appendChild(helpEls.btn[14]); svg.appendChild(helpEls.btn[15]);

  // --- face buttons (diamond) -----------------------------------------
  // Positions are canonical: south=bottom, east=right, west=left, north=top.
  var fcx = 590, fcy = 290, fr = 30, off = 58;
  var faces = [
    { pos: 'south', idx: 0, x: fcx,        y: fcy + off },
    { pos: 'east',  idx: 1, x: fcx + off,  y: fcy },
    { pos: 'west',  idx: 2, x: fcx - off,  y: fcy },
    { pos: 'north', idx: 3, x: fcx,        y: fcy - off }
  ];
  helpEls.faceLetters = {};
  for (var i = 0; i < faces.length; i++) {
    var f = faces[i];
    var circ = helpSvg('circle', {
      cx: f.x, cy: f.y, r: fr, fill: '#2a3245',
      stroke: 'var(--ink)', 'stroke-width': 5, 'class': 'helpface'
    });
    svg.appendChild(circ);
    helpEls.btn[f.idx] = circ;
    var lt = helpText(f.x, f.y + 1, '?', null, 24);
    lt.setAttribute('pointer-events', 'none');
    svg.appendChild(lt);
    helpEls.faceLetters[f.pos] = lt;
    helpEls.btn[f.idx].dataFacePos = f.pos;
  }
  helpEls.faceCenter = { x: fcx, y: fcy, off: off, r: fr };

  // --- right analog stick ---------------------------------------------
  var rsx = 500, rsy = 360;
  svg.appendChild(helpSvg('circle', { cx: rsx, cy: rsy, r: 52, fill: '#141c30', stroke: 'var(--ink)', 'stroke-width': 5 }));
  var rstick = helpSvg('circle', { cx: rsx, cy: rsy, r: 38, fill: '#5a6b86', stroke: 'var(--ink)', 'stroke-width': 5 });
  svg.appendChild(rstick);
  helpEls.rstick = rstick; helpEls.rsx = rsx; helpEls.rsy = rsy;

  // --- center buttons: View (8), Menu/+ (9), Guide (16) ---------------
  helpEls.btn[8] = helpSvg('rect', { x: 350, y: 250, width: 30, height: 20, rx: 6, fill: '#2a3245', stroke: 'var(--ink)', 'stroke-width': 4 });
  helpEls.btn[9] = helpSvg('rect', { x: 420, y: 250, width: 30, height: 20, rx: 6, fill: '#2a3245', stroke: 'var(--ink)', 'stroke-width': 4 });
  helpEls.btn[16] = helpSvg('circle', { id: 'helpguide', cx: 400, cy: 300, r: 22, fill: '#2a3245', stroke: 'var(--ink)', 'stroke-width': 5 });
  svg.appendChild(helpEls.btn[8]); svg.appendChild(helpEls.btn[9]); svg.appendChild(helpEls.btn[16]);
  // + glyph on Menu
  svg.appendChild(helpText(435, 261, '+', null, 20));
  helpEls.menuGlyph = null;

  // --- shoulder buttons LB(4)/RB(5) + triggers LT(6)/RT(7) ------------
  helpEls.btn[4] = helpSvg('rect', { x: 150, y: 120, width: 110, height: 26, rx: 13, fill: '#2a3245', stroke: 'var(--ink)', 'stroke-width': 5 });
  helpEls.btn[5] = helpSvg('rect', { x: 540, y: 120, width: 110, height: 26, rx: 13, fill: '#2a3245', stroke: 'var(--ink)', 'stroke-width': 5 });
  svg.appendChild(helpEls.btn[4]); svg.appendChild(helpEls.btn[5]);
  svg.appendChild(helpText(205, 133, 'LB', null, 14));
  svg.appendChild(helpText(595, 133, 'RB', null, 14));

  // triggers: outline + a proportional fill rect grown from the bottom.
  // LT
  svg.appendChild(helpSvg('rect', { x: 165, y: 66, width: 80, height: 46, rx: 12, fill: '#141c30', stroke: 'var(--ink)', 'stroke-width': 5 }));
  helpEls.ltFill = helpSvg('rect', { x: 168, y: 109, width: 74, height: 0, rx: 8, fill: 'var(--brick-blue)' });
  svg.appendChild(helpEls.ltFill);
  svg.appendChild(helpText(205, 89, 'LT', null, 14));
  helpEls.ltBox = { x: 168, y: 69, w: 74, h: 40 };
  // RT
  svg.appendChild(helpSvg('rect', { x: 555, y: 66, width: 80, height: 46, rx: 12, fill: '#141c30', stroke: 'var(--ink)', 'stroke-width': 5 }));
  helpEls.rtFill = helpSvg('rect', { x: 558, y: 109, width: 74, height: 0, rx: 8, fill: 'var(--brick-green)' });
  svg.appendChild(helpEls.rtFill);
  svg.appendChild(helpText(595, 89, 'RT', null, 14));
  helpEls.rtBox = { x: 558, y: 69, w: 74, h: 40 };

  // --- labels with leader lines ---------------------------------------
  // Each entry: { key, ax,ay (anchor on control), lx,ly (label text pos),
  //   halign }. Kept compact; describes what the control does in THIS game.
  addHelpLabel(svg, 'lstick', lsx, lsy, 60, 150, 'start', 'Move', 'WASD');
  addHelpLabel(svg, 'l3',     lsx, lsy + 40, 60, 200, 'start', 'Sprint (click)', 'Shift');
  addHelpLabel(svg, 'dpad',   dpx, dpy + 3 * a, 210, 460, 'start', 'Menus', '');
  addHelpLabel(svg, 'rstick', rsx, rsy, 640, 460, 'end', 'Camera / Aim', 'Mouse');
  addHelpLabel(svg, 'south',  fcx, fcy + off, 760, 400, 'end', 'FART!', 'Space');
  addHelpLabel(svg, 'east',   fcx + off, fcy, 770, 300, 'end', 'Use item', 'E');
  addHelpLabel(svg, 'westnorth', fcx, fcy - off, 720, 150, 'end', 'Superpower', 'Q');
  addHelpLabel(svg, 'menu',   435, 250, 400, 150, 'middle', 'Pause', 'Esc');
  addHelpLabel(svg, 'lt',     205, 66, 140, 40, 'end', 'Sprint', 'Shift');
  addHelpLabel(svg, 'rt',     595, 66, 660, 40, 'start', 'Fart!', 'Space');

  stage.appendChild(svg);
}

// Draw one leader line + a two-line label (title on top, keyboard equiv below).
function addHelpLabel(svg, key, ax, ay, lx, ly, halign, title, kbd) {
  // leader line
  svg.appendChild(helpSvg('line', {
    x1: ax, y1: ay, x2: lx, y2: ly,
    stroke: 'var(--gold)', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: '0.85'
  }));
  // dot on the control anchor
  svg.appendChild(helpSvg('circle', { cx: ax, cy: ay, r: 4, fill: 'var(--gold)' }));
  // title
  var t = helpSvg('text', {
    x: lx, y: ly, 'text-anchor': halign,
    'font-family': 'Arial Black, Arial, sans-serif', 'font-size': 20, 'font-weight': 'bold',
    fill: '#fff', stroke: 'var(--ink)', 'stroke-width': 3, 'paint-order': 'stroke'
  });
  t.textContent = title;
  svg.appendChild(t);
  // keyboard equivalent underneath (skip when none)
  if (kbd) {
    var k = helpSvg('text', {
      x: lx, y: ly + 20, 'text-anchor': halign,
      'font-family': 'Arial, sans-serif', 'font-size': 14, fill: 'var(--gold)'
    });
    k.textContent = 'Key: ' + kbd;
    svg.appendChild(k);
  }
}

// ---- controller-type toggle -------------------------------------------
function setHelpType(t) {
  if (t !== 'xbox' && t !== 'nintendo') return;
  helpType = t;
  applyHelpType();
}

// Apply helpType to letters, accent colors, and toggle button state.
function applyHelpType() {
  if (!helpBuilt || !helpEls) return;
  var letters = Input.LETTERS[helpType] || Input.LETTERS.xbox;
  var pos;
  for (pos in helpEls.faceLetters) {
    if (helpEls.faceLetters.hasOwnProperty(pos)) {
      helpEls.faceLetters[pos].textContent = letters[pos];
    }
  }
  var acc = HELP_ACCENT[helpType];
  var guide = document.getElementById('helpguide');
  if (guide) guide.setAttribute('fill', acc.guide);

  var bS = document.getElementById('helpTypeSwitch');
  var bX = document.getElementById('helpTypeXbox');
  if (bS) bS.className = 'helptypebtn' + (helpType === 'nintendo' ? ' sel' : '');
  if (bX) bX.className = 'helptypebtn' + (helpType === 'xbox' ? ' sel' : '');
}

// ---- open / close ------------------------------------------------------
function openHelp() {
  buildHelpPanel();
  // If a real pad is connected, prefer its type as the initial art selection,
  // but keep the manual toggle available.
  try {
    var ps = Input.pads();
    if (ps && ps.length && (ps[0].type === 'xbox' || ps[0].type === 'nintendo')) {
      setHelpType(ps[0].type);
    }
  } catch (e) {}
  helpOpen = true;
  var p = document.getElementById('helppanel');
  if (p) p.style.display = 'block';
  updateHelpHighlight();
}

function closeHelp() {
  helpOpen = false;
  var p = document.getElementById('helppanel');
  if (p) p.style.display = 'none';
}

// ---- live highlight (call once per frame from animate()) --------------
// Reads Input.pads(); prefers a pad matching the selected type, else the first.
// Lights pressed buttons, deflects sticks by axes, fills triggers by value.
function updateHelpHighlight() {
  if (!helpOpen || !helpEls) return;

  var pads = Input.pads();
  var np = null;
  if (pads.length) {
    for (var i = 0; i < pads.length; i++) {
      if (pads[i].type === helpType) { np = pads[i]; break; }
    }
    if (!np) np = pads[0];
  }

  var hint = document.getElementById('helphint');
  if (hint) hint.style.display = np ? 'none' : 'block';

  // Reset + apply button highlight for every mapped standard index.
  var idx;
  for (idx in helpEls.btn) {
    if (!helpEls.btn.hasOwnProperty(idx)) continue;
    var el = helpEls.btn[idx];
    var pressed = np && Input.button(np, +idx);
    var isFace = el.dataFacePos !== undefined;
    var isDpad = (+idx >= 12 && +idx <= 15);
    if (isDpad) {
      // near-invisible cell that flashes gold when pressed
      el.setAttribute('fill', 'var(--gold)');
      el.setAttribute('opacity', pressed ? '0.9' : '0.01');
    } else if (isFace) {
      el.setAttribute('fill', pressed ? 'var(--gold)' : '#2a3245');
    } else {
      el.setAttribute('fill', pressed ? 'var(--gold)' : '#2a3245');
    }
  }

  // Sticks: deflect the inner circle by the analog axes (max ~18px).
  var DEF = 18;
  var lx = np ? (np.axes[0] || 0) : 0, ly = np ? (np.axes[1] || 0) : 0;
  helpEls.lstick.setAttribute('cx', helpEls.lsx + lx * DEF);
  helpEls.lstick.setAttribute('cy', helpEls.lsy + ly * DEF);
  helpEls.lstick.setAttribute('fill', Input.button(np, 10) ? 'var(--gold)' : '#5a6b86');
  var rx = np ? (np.axes[2] || 0) : 0, ry = np ? (np.axes[3] || 0) : 0;
  helpEls.rstick.setAttribute('cx', helpEls.rsx + rx * DEF);
  helpEls.rstick.setAttribute('cy', helpEls.rsy + ry * DEF);
  helpEls.rstick.setAttribute('fill', Input.button(np, 11) ? 'var(--gold)' : '#5a6b86');

  // Triggers: proportional fill grown up from the bottom by LT/RT value.
  var ltv = 0, rtv = 0;
  if (np) {
    if (np.buttons[6]) ltv = np.buttons[6].value || (np.buttons[6].pressed ? 1 : 0);
    if (np.buttons[7]) rtv = np.buttons[7].value || (np.buttons[7].pressed ? 1 : 0);
  }
  fillTrigger(helpEls.ltFill, helpEls.ltBox, ltv);
  fillTrigger(helpEls.rtFill, helpEls.rtBox, rtv);
}

function fillTrigger(fillEl, box, v) {
  if (v < 0) v = 0; if (v > 1) v = 1;
  var h = box.h * v;
  fillEl.setAttribute('y', box.y + (box.h - h));
  fillEl.setAttribute('height', h);
}

// Build the panel DOM at load time so #helppanel exists immediately (matches
// the always-present #rulespanel). Guard for a non-DOM env (node --check).
if (typeof document !== 'undefined' && document.body) {
  buildHelpPanel();
} else if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', buildHelpPanel);
}
