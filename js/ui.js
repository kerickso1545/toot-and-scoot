function pickMode(n, el, ev) {
  if (ev) ev.stopPropagation();
  numPlayers = n;
  for (var i = 1; i <= 3; i++) document.getElementById('modebtn' + i).classList.toggle('hatsel', n === i);
  refreshTeamRow();
  updatePadStatus();
}

// Team/Free-for-all toggle: only meaningful with 2+ players, so the row
// appears (and joins the d-pad grid) only in multiplayer — mirrors how boss
// mode splices in the level picker.
function pickTeam(v, el, ev) {
  if (ev) ev.stopPropagation();
  coop = !!v;
  document.getElementById('teambtn0').classList.toggle('hatsel', !coop);
  document.getElementById('teambtn1').classList.toggle('hatsel', coop);
}
function refreshTeamRow() {
  var show = numPlayers >= 2;
  document.getElementById('teamrow').style.display = show ? 'block' : 'none';
  var idx = MENU_ROWS.indexOf('teambtns');
  if (show && idx < 0) MENU_ROWS.splice(MENU_ROWS.indexOf('modebtns') + 1, 0, 'teambtns');
  else if (!show && idx >= 0) MENU_ROWS.splice(idx, 1);
  mRow = Math.min(mRow, MENU_ROWS.length - 1);
  mCol = Math.min(mCol, titleButtons(MENU_ROWS[mRow]).length - 1);
  renderTitleFocus();
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
var MENU_ROWS = ['modebtns', 'colorbtns', 'hatbtns', 'startbtns', 'rulesrow'];
// boss mode (play.py --boss): a start-level picker row joins the menu grid,
// fully d-pad navigable like every other row
if (bossMode) MENU_ROWS.splice(3, 0, 'levelbtns');
var mRow = MENU_ROWS.indexOf('startbtns'), mCol = 0;
function titleButtons(rid) {
  return Array.prototype.slice.call(document.getElementById(rid).querySelectorAll('button'));
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
function connectedPads() {
  var out = [];
  if (navigator.getGamepads) {
    var pads = navigator.getGamepads();
    for (var i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) out.push(pads[i]);
  }
  return out;
}
function padByIndex(i) {
  if (i === null || i === undefined || i < 0 || !navigator.getGamepads) return null;
  var p = navigator.getGamepads()[i];
  return (p && p.connected) ? p : null;
}
function requiredPads() { return Math.max(0, numPlayers - 1); }
function controllersReady() { return connectedPads().length >= requiredPads(); }
function assignPads() {
  var cps = connectedPads();
  if (cps.length >= numPlayers) {
    // enough controllers for everyone (P1's is optional but welcome)
    padAssign = { p1: cps[0].index, p2: cps[1] ? cps[1].index : null, p3: cps[2] ? cps[2].index : null };
  } else {
    // one short: P1 takes keyboard + mouse, pads go to P2 and P3
    padAssign = { p1: -1, p2: cps[0] ? cps[0].index : null, p3: cps[1] ? cps[1].index : null };
  }
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
  var n = connectedPads().length;
  var lines = [], ready = controllersReady();
  if (numPlayers === 1) {
    lines.push('P1: ' + (n >= 1 ? 'Controller 1' : 'keyboard + mouse'));
  } else {
    var all = n >= numPlayers;
    lines.push('P1: ' + (all ? 'Controller 1' : 'keyboard + mouse'));
    for (var p = 2; p <= numPlayers; p++) {
      var pi = all ? p - 1 : p - 2;
      lines.push('P' + p + ': ' + (pi >= 0 && pi < n ? 'Controller ' + (pi + 1)
        : '<span style="color:#ef9a9a">controller missing — connect one</span>'));
    }
  }
  var short = requiredPads() - n;
  var html = lines.join(' &middot; ') +
    (ready ? '' : '<br><span style="color:#ffd54f">Connect ' + short +
      ' more controller' + (short === 1 ? '' : 's') + ' to start</span>');
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
  return (!running || gameOver) && !initialsActive && !resultsActive && !rulesOpen && !menuOpen && controllersReady();
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
