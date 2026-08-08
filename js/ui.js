// ---- player-slot join flow ----
// Replaces the old 1P/2P/3P mode select. Up to MAX_SLOTS players; claim order
// IS player order (first claim = Player 1). Game type (Versus / Co-op) is a
// SEPARATE choice, independent of how many players join. The game engine reads
// numPlayers / coop / padAssign exactly as before — this UI just populates them.
var MAX_SLOTS = 3;   // engine supports 3 humans (player / player2 / player3)
// session.slots[i] describes Player i+1: {kind:'pad', padIndex:n} or {kind:'kb'}.
// Contiguous by construction (claim appends the next slot; leave splices+repacks).
var session = { slots: [], gameType: 'ffa' };
// Join is DIRECT: an unassigned controller that presses A joins the next slot
// (handled per-frame in animate). "A" is read as south OR east, because the
// bottom-vs-right A/B letters differ between Xbox and Switch pads — so pressing
// A works on either brand. No arm-first step; an ASSIGNED pad navigates menus
// instead of joining (see the title-screen block in main.js).

function claimedCount() { return session.slots.length; }
function padIndexInUse(idx) {
  return session.slots.some(function (s) { return s && s.kind === 'pad' && s.padIndex === idx; });
}
function slotOfPad(idx) {
  for (var i = 0; i < session.slots.length; i++) {
    if (session.slots[i] && session.slots[i].kind === 'pad' && session.slots[i].padIndex === idx) return i;
  }
  return -1;
}
function slotDeviceLabel(s) {
  if (!s) return '';
  return s.kind === 'kb' ? '⌨ Keyboard' : '🎮 Controller ' + (s.padIndex + 1);
}
// Claim the next open slot. kind 'pad' (padIndex) or 'kb' (keyboard, P1 only —
// the engine only lets Player 1 fall back to keyboard).
function claimSlot(kind, padIndex) {
  if (session.slots.length >= MAX_SLOTS) return false;
  if (kind === 'kb' && session.slots.length !== 0) return false;    // keyboard = P1 only
  if (kind === 'pad' && padIndexInUse(padIndex)) return false;      // one slot per pad
  session.slots.push(kind === 'kb' ? { kind: 'kb' } : { kind: 'pad', padIndex: padIndex });
  snd(660, 0.1, 'sine'); snd(880, 0.14, 'sine');
  renderSlots();
  return true;
}
function leaveSlot(i) {
  if (i < 0 || i >= session.slots.length) return;
  session.slots.splice(i, 1);   // splice repacks: remaining players stay contiguous
  snd(300, 0.12, 'square');
  renderSlots();
}
function joinKeyboard(ev) {
  if (ev) ev.stopPropagation();
  claimSlot('kb');
}
function renderSlots() {
  var host = document.getElementById('playerslots');
  if (!host) return;
  var html = '';
  session.slots.forEach(function (s, i) {
    html += '<button class="pslot claimed" onclick="leaveSlot(' + i + ');event.stopPropagation();" title="Leave">' +
      '<div class="pslot-num">Player ' + (i + 1) + '</div>' +
      '<div class="pslot-dev">' + slotDeviceLabel(s) + '</div>' +
      '<div class="pslot-x">✕ leave</div></button>';
  });
  if (session.slots.length < MAX_SLOTS) {
    // instructional "press A on a controller to join" tile (clicking it is a
    // no-op — joining is done by pressing a controller button, not the mouse)
    html += '<button class="pslot empty" onclick="event.stopPropagation()">' +
      '<div class="pslot-plus">+</div>' +
      '<div class="pslot-dev">Press <b>A</b> on a<br>controller to join</div></button>';
    if (session.slots.length === 0) {
      html += '<button class="pslot kb" onclick="joinKeyboard(event)">' +
        '<div class="pslot-plus">⌨</div>' +
        '<div class="pslot-dev">Play with<br>keyboard</div></button>';
    }
  }
  host.innerHTML = html;
  // numPlayers reflects claimed players live (min 1 — solo default)
  numPlayers = Math.max(1, session.slots.length);
  var hint = document.getElementById('joinhint');
  if (hint) hint.style.display = session.slots.length ? 'none' : 'block';
  mCol = Math.min(mCol, Math.max(0, titleButtons(MENU_ROWS[mRow]).length - 1));
  renderTitleFocus();
  updatePadStatus();
}

// Game type: Versus (free-for-all) vs Co-op team. Independent of player count;
// only takes effect in multiplayer (coopActive gates on that in startLevel).
function pickGameType(gt, ev) {
  if (ev) ev.stopPropagation();
  session.gameType = gt;
  coop = (gt === 'coop');
  document.getElementById('gtffa').classList.toggle('gtsel', !coop);
  document.getElementById('gtcoop').classList.toggle('gtsel', coop);
}

var playerColor = 0x2979ff;
function pickColor(hex, el, ev) {
  if (ev) ev.stopPropagation();
  playerColor = hex;
  var cb = document.querySelectorAll('#colorbtns .hatbtn');
  for (var i = 0; i < cb.length; i++) cb[i].classList.remove('hatsel');
  el.classList.add('hatsel');
}

// ---- rules panel ----
var rulesOpen = false;
function showRules(ev) {
  if (ev) ev.stopPropagation();
  rulesOpen = true;
  document.getElementById('rulespanel').style.display = 'block';
}
function hideRules(ev) {
  if (ev) ev.stopPropagation();
  rulesOpen = false;
  document.getElementById('rulespanel').style.display = 'none';
}

// ---- title menu controller navigation ----
var MENU_ROWS = ['playerslots', 'gametyperow', 'colorbtns', 'hatbtns', 'startbtns', 'rulesrow'];
// boss mode (play.py --boss): a start-level picker row joins the menu grid,
// fully d-pad navigable like every other row
if (bossMode) MENU_ROWS.splice(MENU_ROWS.indexOf('startbtns'), 0, 'levelbtns');
var mRow = MENU_ROWS.indexOf('startbtns'), mCol = 0;
function titleButtons(rid) {
  var el = document.getElementById(rid);
  return el ? Array.prototype.slice.call(el.querySelectorAll('button')) : [];
}
function renderTitleFocus() {
  MENU_ROWS.forEach(function (rid, ri) {
    titleButtons(rid).forEach(function (b, ci) {
      b.classList.toggle('focus', ri === mRow && ci === mCol);
    });
  });
}
function titleNav(dx, dy) {
  if (dy) {
    mRow = (mRow + dy + MENU_ROWS.length) % MENU_ROWS.length;
    mCol = Math.min(mCol, titleButtons(MENU_ROWS[mRow]).length - 1);
  }
  if (dx) {
    var n = titleButtons(MENU_ROWS[mRow]).length;
    mCol = (mCol + dx + n) % n;
  }
  renderTitleFocus();
}
function titleActivate() {
  var b = titleButtons(MENU_ROWS[mRow])[mCol];
  if (b) b.click();
}

// ---- persistent leaderboard (browser local storage) ----
var initialsActive = false, initLetters = ['A', 'A', 'A'], initSlot = 0, pendingScore = null;
function loadScores() {
  try { return JSON.parse(localStorage.getItem('tootScootScores')) || []; } catch (e) { return []; }
}
function scoreQualifies(s) {
  var sc = loadScores();
  return sc.length < 10 || s > sc[sc.length - 1].score;
}
function renderScoreboard() {
  var s = loadScores().slice(0, 5);
  var el = document.getElementById('scoreboard');
  if (!s.length) { el.innerHTML = ''; return; }
  el.innerHTML = 'HIGH SCORES<br>' + s.map(function (r, i) {
    // every entry banks its difficulty + play mode; pre-tag entries show plain.
    // mode is only displayed when it isn't the usual 1P (the board is 1P-only
    // today, but the data is future-proofed).
    var tag = 'level ' + r.level +
      (r.diff !== undefined ? ' &middot; ' + ['Easy', 'Medium', 'Hard'][r.diff] : '') +
      (r.mode && r.mode !== '1P' ? ' &middot; ' + r.mode : '');
    return '<span class="scorerow">' + (i + 1) + '. ' + r.initials + ' ' + ('' + r.score) + ' pts (' + tag + ')</span>';
  }).join('<br>');
}
function renderInitials() {
  for (var i = 0; i < 3; i++) {
    var el = document.getElementById('init' + i);
    el.textContent = initLetters[i];
    el.style.borderColor = i === initSlot ? '#ffd54f' : 'rgba(255,255,255,0.4)';
  }
}
function showInitials(sc) {
  initialsActive = true;
  initLetters = ['A', 'A', 'A'];
  initSlot = 0;
  // snapshot difficulty + mode NOW (globals could be re-picked on the title
  // screen before the letters are finished)
  sc.diff = difficulty;
  sc.mode = numPlayers + 'P';
  pendingScore = sc;
  document.getElementById('initScore').textContent = sc.score + ' points — level ' + sc.level;
  document.getElementById('initials').style.display = 'block';
  renderInitials();
  snd(700, 0.2, 'sine'); snd(900, 0.3, 'sine');
}
function cycleLetter(d) {
  var A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  initLetters[initSlot] = A[(A.indexOf(initLetters[initSlot]) + d + 26) % 26];
  renderInitials();
}
function advanceSlot() {
  if (initSlot < 2) { initSlot++; renderInitials(); }
  else finishInitials();
}
function finishInitials() {
  initialsActive = false;
  document.getElementById('initials').style.display = 'none';
  var sc = loadScores();
  sc.push({ initials: initLetters.join(''), score: pendingScore.score, level: pendingScore.level,
            diff: pendingScore.diff, mode: pendingScore.mode });
  sc.sort(function (a, b) { return b.score - a.score; });
  try { localStorage.setItem('tootScootScores', JSON.stringify(sc.slice(0, 10))); } catch (e) {}
  renderScoreboard();
  // initials first, results second: the score is banked before the results
  // panel offers a retry, so a qualifying score can never be lost
  if (pendingResults) { showResults(); return; }
  overlay.style.display = 'flex';
  diffbtns.style.display = 'block';
  renderTitleFocus();
}

// ---- end-of-game results panel (1P game over / multiplayer total wipe) ----
var resultsActive = false, resultsIndex = 0, pendingResults = null;
var resultspanelEl = document.getElementById('resultspanel');
function fmtLevelTime(t) {
  if (t === null || t === undefined) return '-';
  var m = Math.floor(t / 60);
  var s = t - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
}
function buildResults() {
  // snapshot at endGame time — player objects get rebuilt on the next start
  var cols = ['#64b5f6', '#81c784', '#ea80fc'];
  return {
    level: level,
    mp: twoPlayer,
    players: humans().map(function (p, i) {
      return {
        name: twoPlayer ? 'Player ' + (i + 1) : 'You',
        color: cols[i],
        score: p.score || 0, wins: p.wins || 0,
        kills: p.kills || 0, crates: p.crates || 0,
        selfGas: p.selfGas || 0, itemsUsed: p.itemsUsed || 0,
        bestT: p.bestT === undefined ? null : p.bestT
      };
    })
  };
}
function resultsHtml(r) {
  var rows = [
    ['Score', function (p) { return p.score; }],
    ['Rounds won', function (p) { return p.wins; }, true],   // multiplayer only
    ['Rivals gassed', function (p) { return p.kills; }],
    ['TP shredded', function (p) { return p.crates; }],
    ['Oops! Gassed yourself', function (p) { return p.selfGas; }],
    ['Items used', function (p) { return p.itemsUsed; }],
    ['Fastest level', function (p) { return fmtLevelTime(p.bestT); }]
  ];
  var html = '<table class="rtable">';
  if (r.mp) {
    html += '<tr><td></td>';
    r.players.forEach(function (p) { html += '<th style="color:' + p.color + '">' + p.name + '</th>'; });
    html += '</tr>';
  }
  rows.forEach(function (row) {
    if (row[2] && !r.mp) return;
    html += '<tr><td class="rlabel">' + row[0] + '</td>';
    r.players.forEach(function (p) { html += '<td class="rval">' + row[1](p) + '</td>'; });
    html += '</tr>';
  });
  return html + '</table>';
}
function resultsButtons() {
  return Array.prototype.slice.call(resultspanelEl.querySelectorAll('.mbtn'));
}
function renderResultsFocus() {
  resultsButtons().forEach(function (b, i) { b.className = 'mbtn' + (i === resultsIndex ? ' sel' : ''); });
}
function showResults() {
  var r = pendingResults;
  if (!r) {   // nothing pending: fall back to the title screen
    overlay.style.display = 'flex';
    diffbtns.style.display = 'block';
    renderTitleFocus();
    return;
  }
  resultsActive = true;
  resultsIndex = 0;
  var sub = document.getElementById('resultsSub');
  sub.textContent = (r.mp ? 'The rivals got everyone on level ' : 'You made it to level ') + r.level + '!';
  sub.style.color = '#ffd54f';
  document.getElementById('resultsBody').innerHTML = resultsHtml(r);
  resultspanelEl.style.display = 'block';
  renderResultsFocus();
}
function hideResults() {
  resultsActive = false;
  pendingResults = null;
  resultspanelEl.style.display = 'none';
}
function resultsAction(act) {
  if (act === 'retry') {
    // same players/difficulty/color/hat are still selected in the globals, so
    // a retry is just startGame() — but ONLY through the one true gate
    resultsActive = false;                 // canStartGame must see the panel as closing
    if (!canStartGame()) {
      resultsActive = true;                // blocked (controller missing) — stay here
      var sub = document.getElementById('resultsSub');
      sub.textContent = 'Connect your controllers to retry!';
      sub.style.color = '#ff8a65';
      snd(140, 0.2, 'square');
      return;
    }
    hideResults();
    startGame(true);   // retry continues from the level you died on
    try { renderer.domElement.requestPointerLock(); } catch (e) {}
  } else {
    // 'setup' and 'menu' both land on the title screen (it IS the setup screen)
    hideResults();
    overlay.style.display = 'flex';
    diffbtns.style.display = 'block';
    renderTitleFocus();
    updatePadStatus();
  }
}

function pickLevel(n, el, ev) {
  // boss-mode start-level picker (row only visible when launched with --boss)
  if (ev) ev.stopPropagation();
  startAtLevel = n;
  var lb = document.querySelectorAll('#levelbtns .hatbtn');
  for (var i = 0; i < lb.length; i++) lb[i].classList.remove('hatsel');
  el.classList.add('hatsel');
}

function pickHat(t, el, ev) {
  if (ev) ev.stopPropagation();
  playerHat = t;
  var hb = document.querySelectorAll('.hatbtn');
  for (var i = 0; i < hb.length; i++) hb[i].classList.remove('hatsel');
  el.classList.add('hatsel');
}
var menuOpen = false, menuScreen = 'pause', menuIndex = 0;
var soundOn = true, camSpeedIdx = 1, camSpeeds = [0.6, 1, 1.6];
var pausemenuEl = document.getElementById('pausemenu');
var settingsEl = document.getElementById('settingsmenu');

// ---- controller readiness + per-match assignment ----
// Assignments are captured ONCE at match start (by gamepad index) and never
// silently reshuffled mid-match. P1 may always fall back to keyboard + mouse;
// P2 / P3 require a controller each.
var padAssign = null;        // { p1: index|-1(keyboard), p2: index|null, p3: index|null }
var padDiscMsg = '';
// Both accessors return NORMALIZED pads (Input.normalize): standard-position
// buttons/axes regardless of the physical brand, so a non-standard-mapping pad
// (the reported Xbox-vs-Switch failure mode) reads correctly everywhere the
// game already reads .buttons[i]/.axes[i]. Shape is otherwise unchanged
// (.index/.id/.mapping/.connected all preserved).
function connectedPads() { return Input.pads(); }
function padByIndex(i) { return Input.byIndex(i); }
function requiredPads() {
  return session.slots.filter(function (s) { return s.kind === 'pad'; }).length;
}
// Ready = every pad a player claimed is currently connected. Zero claimed slots
// is fine (solo keyboard + mouse). A claimed keyboard slot is always ready.
function controllersReady() {
  var s = session.slots;
  for (var i = 0; i < s.length; i++) if (s[i].kind === 'pad' && !padByIndex(s[i].padIndex)) return false;
  return true;
}
// Build padAssign straight from the claimed slots (claim order = player order).
// Only Player 1 may be keyboard (-1); P2/P3 slots are always pads by construction.
// If NOBODY explicitly joined, fall back to the old "just works" solo behavior:
// P1 uses the first connected controller if there is one, else keyboard + mouse.
function assignPads() {
  var s = session.slots;
  function idxOf(i) { return s[i] ? (s[i].kind === 'kb' ? -1 : s[i].padIndex) : null; }
  if (s.length) { padAssign = { p1: idxOf(0), p2: idxOf(1), p3: idxOf(2) }; return; }
  var cps = connectedPads();
  padAssign = { p1: cps[0] ? cps[0].index : -1, p2: null, p3: null };
}
function reclaimPads() {
  // a reconnected controller can come back on a new index — hand it to whoever lost theirs
  if (!padAssign) return;
  var taken = {};
  ['p1', 'p2', 'p3'].forEach(function (k) {
    var v = padAssign[k];
    if (v !== null && v >= 0 && padByIndex(v)) taken[v] = true;
  });
  var cps = connectedPads();
  ['p1', 'p2', 'p3'].forEach(function (k, ki) {
    var v = padAssign[k];
    if (v !== null && v < 0) return;                 // keyboard + mouse — leave it
    if (v !== null && padByIndex(v)) return;         // still connected
    if (v === null && ki + 1 > numPlayers) return;   // slot not in play this match
    for (var i = 0; i < cps.length; i++) {
      if (!taken[cps[i].index]) { padAssign[k] = cps[i].index; taken[cps[i].index] = true; break; }
    }
  });
}
function missingPadPlayer() {
  // only P2/P3 hard-require a controller; P1 falls back to keyboard + mouse
  if (!padAssign) return null;
  if (numPlayers >= 2 && !padByIndex(padAssign.p2)) return 'Player 2';
  if (numPlayers >= 3 && !padByIndex(padAssign.p3)) return 'Player 3';
  return null;
}
var lastPadStatusHtml = null;
function updatePadStatus() {
  var el = document.getElementById('padstatus');
  if (!el) return;
  var s = session.slots, ready = controllersReady();
  var lines = [];
  if (!s.length) {
    var nPads = connectedPads().length;
    lines.push(nPads ? 'Solo: controller or keyboard — press A on a controller to add players'
                     : 'Solo: keyboard + mouse — connect a controller to add players');
  } else {
    s.forEach(function (slot, i) {
      var ok = slot.kind === 'kb' || padByIndex(slot.padIndex);
      lines.push('P' + (i + 1) + ': ' + slotDeviceLabel(slot) +
        (ok ? '' : ' <span style="color:#ef9a9a">(disconnected!)</span>'));
    });
  }
  var html = lines.join(' &middot; ') +
    (ready ? '' : '<br><span style="color:#ffd54f">Reconnect the controller to start</span>');
  if (html !== lastPadStatusHtml) {
    lastPadStatusHtml = html;
    el.innerHTML = html;
    titleButtons('startbtns').forEach(function (b) {
      b.style.opacity = ready ? '1' : '0.4';
      b.style.cursor = ready ? 'pointer' : 'not-allowed';
    });
  }
}
function flashStartHint() {
  var el = document.getElementById('padstatus');
  if (el) {
    el.style.outline = '3px solid #ff8a65';
    setTimeout(function () { el.style.outline = 'none'; }, 900);
  }
  snd(140, 0.2, 'square');
}
// the ONE gate every start path must pass through
function canStartGame() {
  return (!running || gameOver) && !initialsActive && !resultsActive && !rulesOpen &&
         !(typeof helpOpen !== 'undefined' && helpOpen) && !menuOpen && controllersReady();
}

function pickDiff(d, ev) {
  if (ev) ev.stopPropagation();
  if (!canStartGame()) { flashStartHint(); return; }
  difficulty = d;
  startGame();
  try { renderer.domElement.requestPointerLock(); } catch (e) {}
}

function menuButtons() {
  var el = menuScreen === 'pause' ? pausemenuEl : settingsEl;
  return Array.prototype.slice.call(el.querySelectorAll('.mbtn'));
}
function renderMenu() {
  pausemenuEl.style.display = menuOpen && menuScreen === 'pause' ? 'block' : 'none';
  settingsEl.style.display = menuOpen && menuScreen === 'settings' ? 'block' : 'none';
  document.getElementById('sndbtn').textContent = 'Sound: ' + (soundOn ? 'On' : 'Off');
  document.getElementById('cambtn').textContent = 'Camera speed: ' + ['Slow', 'Normal', 'Fast'][camSpeedIdx];
  document.getElementById('shakebtn').textContent = 'Screen shake: ' + (fxShakeEnabled ? 'On' : 'Off');
  document.getElementById('pausemsg').textContent = padDiscMsg || '';
  menuButtons().forEach(function (b, i) { b.className = 'mbtn' + (i === menuIndex ? ' sel' : ''); });
}
function openMenu() {
  menuOpen = true; menuScreen = 'pause'; menuIndex = 0;
  renderMenu();
  if (document.pointerLockElement) document.exitPointerLock();
}
function closeMenus() {
  menuOpen = false;
  pausemenuEl.style.display = 'none';
  settingsEl.style.display = 'none';
}
function menuAction(act, fromPad) {
  if (act === 'resume') {
    reclaimPads();
    if (missingPadPlayer()) { snd(140, 0.2, 'square'); renderMenu(); return; }   // can't resume until their controller is back
    closeMenus();
    padDiscMsg = '';
    // suppress-until-released: every action button must be seen RELEASED
    // before any press can fire again (see controlHuman / spectate)
    humans().forEach(function (h) { h.suppress = true; h.prevBomb = true; h.prevUse = true; h.prevMask = true; });
    if (!fromPad) renderer.domElement.requestPointerLock();
  } else if (act === 'settings') { menuScreen = 'settings'; menuIndex = 0; renderMenu(); }
  else if (act === 'back') { menuScreen = 'pause'; menuIndex = 1; renderMenu(); }
  else if (act === 'quit') {
    closeMenus();
    bumpSession();                       // cancels any pending level-clear transition
    running = false; gameOver = true; transitioning = false;
    padDiscMsg = '';
    resetTransientUI();
    hudroot.style.display = 'none';
    bigmsg.textContent = '';
    overlay.style.display = 'flex';
    diffbtns.style.display = 'block';
    renderTitleFocus();
    updatePadStatus();
  }
  else if (act === 'sound') { soundOn = !soundOn; renderMenu(); }
  else if (act === 'camspeed') { camSpeedIdx = (camSpeedIdx + 1) % 3; renderMenu(); }
  else if (act === 'shake') { fxShakeEnabled = !fxShakeEnabled; renderMenu(); }
}
var levelMsgTimer = null;
function showLevelMsg(text) {
  levelmsg.textContent = text;
  levelmsg.style.display = 'block';
  if (levelMsgTimer) clearTimeout(levelMsgTimer);
  levelMsgTimer = setTimeout(function () { levelmsg.style.display = 'none'; levelMsgTimer = null; }, 1600);
}

// ---- per-player contextual feedback (positioned inside that player's viewport) ----
var pmsgTimers = [null, null, null];
function humanIndex(p) { return p === player ? 0 : p === player2 ? 1 : 2; }
function showPMsg(p, text, kind) {
  if (!p) return;
  var t = performance.now();
  p.msgCd = p.msgCd || {};
  if (p.msgCd[kind] && t - p.msgCd[kind] < 1500) return;   // throttle repeats per message kind
  p.msgCd[kind] = t;
  var i = humanIndex(p);
  var el = document.getElementById('pmsg' + i);
  if (!el) return;
  var r = viewRect(p);
  el.style.left = (r.l + r.w / 2) + '%';
  el.style.top = (r.t + r.h * 0.6) + '%';
  el.textContent = text;
  el.style.display = 'block';
  if (pmsgTimers[i]) clearTimeout(pmsgTimers[i]);
  pmsgTimers[i] = setTimeout(function () { el.style.display = 'none'; pmsgTimers[i] = null; }, 1200);
}
function cappedFx(p, text, kind) {
  // "you're full" feedback: message + a throttled fizzle sound
  showPMsg(p, text, kind);
  var t = performance.now();
  if (!p.capSndAt || t - p.capSndAt > 900) { p.capSndAt = t; snd(150, 0.2, 'sine'); }
}
function clearPlayerMsgs() {
  for (var i = 0; i < 3; i++) {
    if (pmsgTimers[i]) { clearTimeout(pmsgTimers[i]); pmsgTimers[i] = null; }
    var el = document.getElementById('pmsg' + i);
    if (el) el.style.display = 'none';
  }
}
function superStateText(p) {
  return p.maskTime > 0 ? Math.ceil(p.maskTime) + 's' : p.superUsed ? 'used' : SUPER_SHORT[p.superType];
}
function twoPHudHtml(label, col, p) {
  // player tile styled EXACTLY like the 1P panel: hlabel on top, one hbig
  // number (score), hsub lines below. Level/difficulty/rivals live in the
  // separate #hudGame tile — never inside a player tile.
  var item = p.held ? PU_NAME[p.held] : '—';
  var stCol = p.stamina > 40 ? '#66bb6a' : p.stamina > 15 ? '#fdd835' : '#e53935';
  var stBar = (p.alive && !p.downed)
    ? '<div style="width:120px;height:8px;background:rgba(0,0,0,0.5);border:2px solid #fff;border-radius:5px;margin:4px auto;overflow:hidden">' +
      '<div style="height:100%;width:' + Math.round(p.stamina) + '%;background:' + stCol + '"></div></div>'
    : '';
  return '<div class="hlabel" style="color:' + col + '">' + label + '</div>' +
    '<div class="hbig">' + (p.score || 0) + '</div>' +
    '<div class="hsub" style="color:#ffd54f">Wins ' + (p.wins || 0) + '</div>' + stBar +
    '<div class="hsub">' + (p.downed ? '<span style="color:#ff5252">DOWN! Revive: ' + Math.ceil(p.downTime || 0) + 's</span>' :
      p.alive ? 'Gas ' + p.maxBombs + ' · Blast ' + p.range + ' · Spd ' + p.speed.toFixed(1) +
      (p.lives > 0 ? ' · Lives ' + p.lives : '') +
      (p.beansTime > 0 ? ' · BEANS ' + Math.ceil(p.beansTime) + 's!' : '') :
      'KNOCKED OUT' + (p.specName ? ' — watching ' + p.specName : '') + ' (A = switch)') + '</div>' +
    '<div class="hsub">Item (A): ' + item + ' · Super (X): ' + superStateText(p) + '</div>';
}
