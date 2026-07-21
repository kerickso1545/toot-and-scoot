var scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 30, 70);

var camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
var camera2 = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
var camera3 = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
var cameraTop = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
function setAspects() {
  // 2P = two tall halves; 3P = four quadrants (same aspect as full screen); 1P = full
  var a = numPlayers === 2 ? (window.innerWidth / 2) / window.innerHeight : window.innerWidth / window.innerHeight;
  [camera, camera2, camera3, cameraTop].forEach(function (cam) {
    cam.aspect = a;
    cam.updateProjectionMatrix();
  });
}

var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

var sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(20, 40, 15);
scene.add(sun);
scene.add(new THREE.AmbientLight(0xbbbbbb, 0.75));

// ---------- materials ----------
var matWall  = new THREE.MeshLambertMaterial({ color: 0x5c6bc0 });
var matCrate = new THREE.MeshLambertMaterial({ color: 0x8d6e63 });
var matFloorA = new THREE.MeshLambertMaterial({ color: 0x9ccc65 });
var matFloorB = new THREE.MeshLambertMaterial({ color: 0xaed581 });
var matBomb  = new THREE.MeshLambertMaterial({ color: 0x7cb342, transparent: true, opacity: 0.85 });
var matTempWall = new THREE.MeshLambertMaterial({ color: 0x66bb6a });
var matBoom  = new THREE.MeshBasicMaterial({ color: 0xb2ff59, transparent: true, opacity: 0.8, depthWrite: false });
var boxGeo   = new THREE.BoxGeometry(TS, TS, TS);
var crateGeo = new THREE.BoxGeometry(TS * 0.94, TS * 0.94, TS * 0.94);
var rollGeo  = new THREE.CylinderGeometry(TS * 0.47, TS * 0.47, TS * 0.94, 20);
var crateGeoActive = crateGeo, crateMatActive = null;   // set by applyTheme
var bombGeo  = new THREE.SphereGeometry(0.55, 16, 12);
var boomGeo  = new THREE.BoxGeometry(TS * 0.96, TS * 0.9, TS * 0.96);
var puGeo    = new THREE.BoxGeometry(0.6, 0.6, 0.6);
applyTheme('bathroom');
// ---------- world state ----------
var grid, crateMeshes, bombs, explosions, powerups, bots, walls, domes;
var player, running = false, gameOver = false;
var difficulty = 0, level = 1, levelParams = null, transitioning = false;
var playerHat = 'cowboy';
var numPlayers = 1, twoPlayer = false, player2 = null, player3 = null, round2p = 0;
// ---- game session + tracked delayed transitions ----
// EVERY delayed callback that mutates game state goes through later(); bumpSession()
// (called from startGame / quit / endGame) both clears the pending timeouts AND
// invalidates the session id each callback captured, so a stale callback can
// never fire into a game it doesn't belong to.
var gameSession = 0;
var pendingTimeouts = [];
function later(fn, ms) {
  var sess = gameSession;
  var id = setTimeout(function () {
    var ix = pendingTimeouts.indexOf(id);
    if (ix >= 0) pendingTimeouts.splice(ix, 1);
    if (sess !== gameSession) return;   // a quit / endGame / startGame happened since
    fn();
  }, ms);
  pendingTimeouts.push(id);
  return id;
}
function bumpSession() {
  gameSession++;
  pendingTimeouts.forEach(function (id) { clearTimeout(id); });
  pendingTimeouts = [];
}
function humans() {
  var h = [];
  if (player) h.push(player);
  if (twoPlayer && player2) h.push(player2);
  if (twoPlayer && player3) h.push(player3);
  return h;
}
function nearestPlayerTile(gx, gz) {
  var best = null, bd = 1e9;
  humans().forEach(function (h) {
    if (!h.alive) return;
    var t = tileOf(h);
    var d = Math.abs(t.x - gx) + Math.abs(t.z - gz);
    if (d < bd) { bd = d; best = t; }
  });
  return best || { x: 1, z: 1 };
}

function carryStats(prevPlayer) {
  // the ONE rule for what persists between levels — used identically for P1, P2, P3
  if (!prevPlayer) return { score: 0, wins: 0, lives: 0 };
  return { score: prevPlayer.score || 0, wins: prevPlayer.wins || 0, lives: prevPlayer.lives || 0 };
}

function startLevel(keepStats) {
  // clean up everything left over from the previous round
  resetTransientUI();
  if (bombs) bombs.forEach(function (b) { scene.remove(b.mesh); });
  if (explosions) explosions.forEach(function (e) { scene.remove(e.mesh); });
  if (powerups) powerups.forEach(function (u) { scene.remove(u.mesh); });
  if (bots) bots.forEach(function (b) { scene.remove(b.mesh); });
  if (player && player.mesh) scene.remove(player.mesh);
  if (player2 && player2.mesh) scene.remove(player2.mesh);
  if (player3 && player3.mesh) scene.remove(player3.mesh);
  if (walls) walls.forEach(function (w) { scene.remove(w.mesh); });
  if (domes) domes.forEach(function (d) { scene.remove(d.mesh); });
  bombs = []; explosions = []; powerups = []; bots = []; walls = []; domes = [];
  twoPlayer = numPlayers >= 2;
  setAspects();
  buildWorld();

  // difficulty tier: rises with the chosen difficulty AND the current level
  var t = difficulty * 2 + (level - 1);
  levelParams = {
    botCount:    Math.min(2 + Math.floor((t + 1) / 2), 6),
    botSpeed:    Math.min(3.2 + t * 0.2, 4.8),
    botRange:    Math.min(2 + Math.floor(t / 3), 4),
    bombChance:  Math.min(0.45 + t * 0.06, 0.85),
    chaseChance: Math.min(0.4 + t * 0.06, 0.8),
    think:       Math.max(0.05, 0.15 - t * 0.01)
  };

  var superType = SUPERS[(level - 1) % SUPERS.length];
  // persistent stats survive between levels the same way for every player
  var cs1 = carryStats(keepStats ? player : null);
  var cs2 = carryStats(keepStats ? player2 : null);
  var cs3 = carryStats(keepStats ? player3 : null);
  var sp1 = levelSpawns[0] || [1, 1];
  var c = tileCenter(sp1[0], sp1[1]);
  var prev = keepStats && !twoPlayer && player ? player : null;   // solo also carries upgrades + held item
  player = {
    x: c.x, z: c.z, alive: true, mesh: makePlayerMesh(playerColor, playerHat), baseColor: playerColor,
    yaw: Math.PI + 0.6, pitch: 0.55,
    speed:    prev ? prev.speed    : 5,
    maxBombs: prev ? prev.maxBombs : 1,
    range:    prev ? prev.range    : 2,
    held:     prev ? prev.held     : null,
    score:    cs1.score,
    wins:     cs1.wins,
    lives:    cs1.lives,
    stamina:  100,
    maskTime: 0,
    suppress: true,
    superType: superType,
    superUsed: false
  };
  player.mesh.position.set(c.x, 0, c.z);
  if (twoPlayer) {
    var sp2 = levelSpawns[1] || sp1;
    var c2 = tileCenter(sp2[0], sp2[1]);
    player2 = {
      x: c2.x, z: c2.z, alive: true,
      mesh: makePlayerMesh(0x00c853, playerHat === 'cap' ? 'party' : 'cap'), baseColor: 0x00c853,
      yaw: 0.6, pitch: 0.55,
      speed: 5, maxBombs: 1, range: 2, held: null, wins: cs2.wins, lives: cs2.lives, score: cs2.score, stamina: 100,
      maskTime: 0, suppress: true, superType: superType, superUsed: false
    };
    player2.mesh.position.set(c2.x, 0, c2.z);
    if (numPlayers >= 3) {
      var sp3 = levelSpawns[2] || sp1;
      var c3 = tileCenter(sp3[0], sp3[1]);
      var p3color = playerColor === 0xd500f9 ? 0xff9100 : 0xd500f9;
      var p3hat = playerHat === 'tproll' ? 'party' : 'tproll';
      player3 = {
        x: c3.x, z: c3.z, alive: true,
        mesh: makePlayerMesh(p3color, p3hat), baseColor: p3color,
        yaw: 2.5, pitch: 0.55,
        speed: 5, maxBombs: 1, range: 2, held: null, wins: cs3.wins, lives: cs3.lives, score: cs3.score, stamina: 100,
        maskTime: 0, suppress: true, superType: superType, superUsed: false
      };
      player3.mesh.position.set(c3.x, 0, c3.z);
      cameraTop.position.set(COLS * TS / 2, 27, ROWS * TS / 2 + 7);
      cameraTop.lookAt(COLS * TS / 2, 0, ROWS * TS / 2);
    } else {
      player3 = null;
    }
    document.getElementById('hudP3').style.display = numPlayers >= 3 ? 'block' : 'none';
    document.getElementById('slots').style.display = 'none';
    document.getElementById('hudBL').style.display = 'none';
  } else {
    player2 = null;
    player3 = null;
    document.getElementById('hudP3').style.display = 'none';
    document.getElementById('hudTL').innerHTML = '<div class="hlabel">Level</div><div class="hbig" id="hLevel">1</div><div class="hsub" id="hDiff">Easy</div><div class="hsub" id="hScore" style="color:#ffd54f">Score 0</div>';
    document.getElementById('hudTR').innerHTML = '<div class="hlabel">Rivals</div><div class="hbig" id="hRivals">0</div>';
    document.getElementById('slots').style.display = 'flex';
    document.getElementById('hudBL').style.display = 'flex';
  }
  document.getElementById('stambar').style.display = twoPlayer ? 'none' : 'block';
  hudroot.style.display = 'block';
  maskoverlay.style.display = 'none';
  for (var bl = 0; bl < 3; bl++) document.getElementById('blind' + bl).style.display = 'none';
  // in 3-player the bottom-right quadrant already has the bird's-eye camera
  document.getElementById('minimap').style.display = numPlayers === 3 ? 'none' : 'block';

  var spawns = levelSpawns.slice(numPlayers);
  if (level % 10 === 0) {
    // BOSS FIGHT: one giant rival with 1000 health
    var bs = spawns[0] || [7, 6];
    var bossBot = makeBot(bs[0], bs[1], 0x4e342e, 'The Big Stinker');
    bossBot.mesh.scale.set(2.2, 2.2, 2.2);
    bossBot.boss = true;
    bossBot.hp = 1000;
    bossBot.speed = 3.2;
    bossBot.range = 4;
    bossBot.maxBombs = 2;
    bossBot.phase = 1;
    bossBot.specialCd = 0;
    bossBot.telegraph = 0;
    bots.push(bossBot);
  } else {
    var botDefs = [[0xab47bc,'Sir Toots-a-Lot'],[0xff7043,'Stinky Pete'],[0xfdd835,'Windy Wendy'],[0xec407a,'Princess Poot'],[0x26c6da,'Gassy Gus'],[0xeceff1,'Captain Cheeks']];
    // never index a spawn that doesn't exist: cap the bot count to available spawns
    var botN = Math.min(levelParams.botCount, spawns.length);
    for (var i = 0; i < botN; i++) {
      var sp = spawns[i];
      var b = makeBot(sp[0], sp[1], botDefs[i][0], botDefs[i][1]);
      b.speed = levelParams.botSpeed;
      b.range = levelParams.botRange;
      bots.push(b);
    }
  }
  running = true; gameOver = false;
  overlay.style.display = 'none';
}

function startGame() {
  bumpSession();               // invalidate every delayed callback from the old game
  padDiscMsg = '';
  assignPads();                // lock controller assignments for this match
  level = 1;
  if (numPlayers === 2) round2p++;
  startLevel(false);
}
function resetTransientUI() {
  // hide/clear every transient overlay, timer, and helper mesh.
  // safe to call any time: quit, endGame, and every startLevel go through here.
  maskoverlay.style.display = 'none';
  maskoverlay.style.opacity = '1';
  for (var i = 0; i < 3; i++) {
    var bl = document.getElementById('blind' + i);
    if (bl) bl.style.display = 'none';
  }
  var bb = document.getElementById('bossbar');
  if (bb) bb.style.display = 'none';
  var sb = document.getElementById('stambar');
  if (sb) sb.style.display = 'none';
  if (levelMsgTimer) { clearTimeout(levelMsgTimer); levelMsgTimer = null; }
  levelmsg.style.display = 'none';
  clearPlayerMsgs();
  clearBossWarnings();
  humans().forEach(function (p) {
    clearPreview(p);
    p.blindTime = 0;
    p.reviveTime = 0;
    p.beansTime = 0;
    removeBlindCloud(p);
    if (p.maskTime > 0) {
      p.maskTime = 0;
      if (p.mesh && p.mesh.userData && p.mesh.userData.mat) p.mesh.userData.mat.color.setHex(p.baseColor);
    }
  });
  if (bots) bots.forEach(function (b) {
    b.blindTime = 0;
    removeBlindCloud(b);
  });
}
// ---------- helpers ----------
function playerTile() { return { x: Math.floor(player.x / TS), z: Math.floor(player.z / TS) }; }
function bombAt(x, z) {
  for (var i = 0; i < bombs.length; i++) if (bombs[i].gx === x && bombs[i].gz === z) return bombs[i];
  return null;
}
// ---------- bombs ----------
function dropBombFor(p) {
  if (!running || !p || !p.alive) return;
  var own = bombs.filter(function (b) { return b.owner === p; }).length;
  var t = tileOf(p);
  if (own >= p.maxBombs || bombAt(t.x, t.z)) return;
  placeBomb(t.x, t.z, p.range, p);
}
function placeBomb(gx, gz, range, owner, opts) {
  var c = tileCenter(gx, gz);
  var m = new THREE.Mesh(bombGeo, matBomb);
  m.position.set(c.x, 0.55, c.z);
  scene.add(m);
  var b = { gx: gx, gz: gz, timer: (opts && opts.fuse) || 2.2, range: range, owner: owner, mesh: m };
  if (opts && opts.hidden) { b.hidden = true; m.visible = false; }
  bombs.push(b);
  if (opts && opts.hidden) {}                              // silent but deadly makes no sound
  else if (opts && opts.quiet) snd(220, 0.08);             // bean-trail toots are little ones
  else fart(ownerProfile(owner));
}
function explode(b) {
  var idx = bombs.indexOf(b);
  if (idx < 0) return;
  bombs.splice(idx, 1);
  scene.remove(b.mesh);
  fart(ownerProfile(b.owner), true);
  snd(65, 0.5, 'sawtooth');
  var tiles = [[b.gx, b.gz]];
  var drops = [];
  [[1,0],[-1,0],[0,1],[0,-1]].forEach(function (d) {
    for (var r = 1; r <= b.range; r++) {
      var x = b.gx + d[0] * r, z = b.gz + d[1] * r;
      if (grid[z][x] === 1 || grid[z][x] === 3) break;
      tiles.push([x, z]);
      var other = bombAt(x, z);
      if (other) explode(other);
      if (grid[z][x] === 2) {
        removeCrate(x, z);
        if (Math.random() < 0.35) drops.push([x, z]);
        if (b.owner && b.owner.score !== undefined) b.owner.score += 10;   // 10 points per roll destroyed
        // blast punches straight through crates — same length every direction
      }
    }
  });
  tiles.forEach(function (t) {
    var c = tileCenter(t[0], t[1]);
    var m = new THREE.Mesh(boomGeo, matBoom);
    m.position.set(c.x, TS * 0.45, c.z);
    scene.add(m);
    explosions.push({ gx: t[0], gz: t[1], timer: 0.45, mesh: m, owner: b.owner });
    for (var i = powerups.length - 1; i >= 0; i--) {
      if (powerups[i].gx === t[0] && powerups[i].gz === t[1] &&
          powerups[i].type !== 'beans' && powerups[i].type !== 'rainbow') {
        // blasts burn up regular power-ups — but the can of beans and the rainbow are indestructible
        scene.remove(powerups[i].mesh);
        powerups.splice(i, 1);
      }
    }
  });
  // spawn the drops after the blast cleanup so brand-new power-ups survive
  drops.forEach(function (d) { spawnPowerup(d[0], d[1]); });
}
function explosionAt(x, z) {
  for (var i = 0; i < explosions.length; i++)
    if (explosions[i].gx === x && explosions[i].gz === z) return true;
  return false;
}
function spawnPowerup(x, z) {
  if (Math.random() < 0.02) {
    // the ultra-rare rainbow: an extra life!
    var rm = new THREE.Mesh(puGeo, new THREE.MeshLambertMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.4 }));
    var rc = tileCenter(x, z);
    rm.position.set(rc.x, 0.6, rc.z);
    scene.add(rm);
    powerups.push({ gx: x, gz: z, type: 'rainbow', mesh: rm });
    return;
  }
  if (Math.random() < 0.10) {
    // the rare can of beans!
    var bm = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.52, 10),
      new THREE.MeshLambertMaterial({ color: 0x8d5524, emissive: 0xbf360c, emissiveIntensity: 0.3 }));
    var bc = tileCenter(x, z);
    bm.position.set(bc.x, 0.6, bc.z);
    scene.add(bm);
    powerups.push({ gx: x, gz: z, type: 'beans', mesh: bm });
    return;
  }
  var types = [
    { t: 'bomb',  color: 0xffab40 },
    { t: 'range', color: 0xff5252 },
    { t: 'speed', color: 0x40c4ff },
    { t: 'wall',  color: 0x66bb6a },
    { t: 'spray', color: 0xf5f5f5 },
    { t: 'turbo', color: 0x9c27b0 }
  ];
  var pick = types[Math.floor(Math.random() * types.length)];
  var m = new THREE.Mesh(puGeo, new THREE.MeshLambertMaterial({ color: pick.color, emissive: pick.color, emissiveIntensity: 0.35 }));
  var c = tileCenter(x, z);
  m.position.set(c.x, 0.6, c.z);
  scene.add(m);
  powerups.push({ gx: x, gz: z, type: pick.t, mesh: m });
}

// ---------- bot AI ----------
function dangerMap() {
  var danger = {};
  explosions.forEach(function (e) { danger[e.gx + ',' + e.gz] = true; });
  bombs.forEach(function (b) {
    if (b.hidden) return;   // rivals can't sense a Silent But Deadly
    danger[b.gx + ',' + b.gz] = true;
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(function (d) {
      for (var r = 1; r <= b.range; r++) {
        var x = b.gx + d[0] * r, z = b.gz + d[1] * r;
        if (grid[z][x] === 1 || grid[z][x] === 3) break;
        danger[x + ',' + z] = true;
      }
    });
  });
  return danger;
}
function passableBot(x, z, bot) {
  if (grid[z][x] !== 0) return false;
  var b = bombAt(x, z);
  if (b && !(bot.gx === x && bot.gz === z)) return false;
  return true;
}
function tryMoveBot(bot, dx, dz) {
  var nx = bot.gx + dx, nz = bot.gz + dz;
  if (passableBot(nx, nz, bot)) { bot.tx = nx; bot.tz = nz; bot.moving = true; return true; }
  return false;
}
function botThink(bot, dt) {
  if (bot.moving) return;
  if (bot.blindTime > 0) {
    // blinded: stumbles randomly, can't chase, fart, or sense danger
    bot.timer -= dt;
    if (bot.timer > 0) return;
    bot.timer = 0.25 + Math.random() * 0.35;
    var bdirs = [[1,0],[-1,0],[0,1],[0,-1]];
    var opts = [];
    for (var bi = 0; bi < 4; bi++) {
      if (passableBot(bot.gx + bdirs[bi][0], bot.gz + bdirs[bi][1], bot)) opts.push(bdirs[bi]);
    }
    if (opts.length) {
      var pk = opts[Math.floor(Math.random() * opts.length)];
      tryMoveBot(bot, pk[0], pk[1]);
    }
    return;
  }
  var danger = dangerMap();
  var dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  var here = bot.gx + ',' + bot.gz;

  if (danger[here]) {
    var q = [[bot.gx, bot.gz, null]], seen = {}; seen[here] = true;
    while (q.length) {
      var cur = q.shift();
      if (!danger[cur[0] + ',' + cur[1]]) {
        if (cur[2]) tryMoveBot(bot, cur[2][0], cur[2][1]);
        return;
      }
      for (var i = 0; i < 4; i++) {
        var nx = cur[0] + dirs[i][0], nz = cur[1] + dirs[i][1];
        var k = nx + ',' + nz;
        if (!seen[k] && passableBot(nx, nz, bot)) { seen[k] = true; q.push([nx, nz, cur[2] || dirs[i]]); }
      }
    }
    for (var j = 0; j < 4; j++) if (tryMoveBot(bot, dirs[j][0], dirs[j][1])) return;
    return;
  }

  bot.timer -= dt;
  if (bot.timer > 0) return;
  bot.timer = levelParams.think + Math.random() * 0.3;

  var pt = nearestPlayerTile(bot.gx, bot.gz);
  var nearCrate = dirs.some(function (d) { return grid[bot.gz + d[1]][bot.gx + d[0]] === 2; });
  var nearPlayer = Math.abs(pt.x - bot.gx) + Math.abs(pt.z - bot.gz) <= 2;
  var own = bombs.filter(function (b) { return b.owner === bot; }).length;
  if ((nearCrate || nearPlayer) && own < bot.maxBombs && Math.random() < levelParams.bombChance) {
    placeBomb(bot.gx, bot.gz, bot.range, bot);
    return;
  }

  var options = [];
  for (var m = 0; m < 4; m++) {
    var tx = bot.gx + dirs[m][0], tz = bot.gz + dirs[m][1];
    if (passableBot(tx, tz, bot) && !danger[tx + ',' + tz]) options.push(dirs[m]);
  }
  if (!options.length) return;
  var pick = options[Math.floor(Math.random() * options.length)];
  // a useful passive upgrade (gas/range/speed) within ~4 tiles? head for it —
  // options above already exclude danger tiles, and the flee branch ran first
  var puT = null, puD = 5;
  powerups.forEach(function (u) {
    if (u.type !== 'bomb' && u.type !== 'range' && u.type !== 'speed') return;
    if (!botWantsPU(bot, u)) return;
    var d2 = Math.abs(u.gx - bot.gx) + Math.abs(u.gz - bot.gz);
    if (d2 < puD) { puD = d2; puT = u; }
  });
  if (puT) {
    options.sort(function (a, b) {
      var da = Math.abs(puT.gx - (bot.gx + a[0])) + Math.abs(puT.gz - (bot.gz + a[1]));
      var db = Math.abs(puT.gx - (bot.gx + b[0])) + Math.abs(puT.gz - (bot.gz + b[1]));
      return da - db;
    });
    pick = options[0];
  } else if (Math.random() < levelParams.chaseChance) {
    options.sort(function (a, b) {
      var da = Math.abs(pt.x - (bot.gx + a[0])) + Math.abs(pt.z - (bot.gz + a[1]));
      var db = Math.abs(pt.x - (bot.gx + b[0])) + Math.abs(pt.z - (bot.gz + b[1]));
      return da - db;
    });
    pick = options[0];
  }
  tryMoveBot(bot, pick[0], pick[1]);
}
function botWantsPU(bot, u) {
  if (u.type === 'bomb') return bot.maxBombs < MAX_GAS;
  if (u.type === 'range') return bot.range < MAX_BLAST;
  if (u.type === 'speed') return bot.speed < MAX_SPEED - 0.001;
  return false;
}

// ---------- input ----------
var overlay = document.getElementById('overlay');
var bigmsg = document.getElementById('bigmsg');
var hudroot = document.getElementById('hudroot');
var maskoverlay = document.getElementById('maskoverlay');
var levelmsg = document.getElementById('levelmsg');
var diffbtns = document.getElementById('diffbtns');

// ---- aiming: directional abilities aim from the player's CAMERA yaw ----
// (forward = (-sin(yaw), -cos(yaw)), matching controlHuman's movement math),
// snapped to the closest cardinal direction — NOT the mesh's walk rotation.
function aimDir(p) {
  var fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  if (Math.abs(fx) > Math.abs(fz)) return { dx: fx > 0 ? 1 : -1, dz: 0 };
  return { dx: 0, dz: fz > 0 ? 1 : -1 };
}
function wallTargetInfo(p) {
  var d = aimDir(p), pt = tileOf(p);
  var x = pt.x + d.dx, z = pt.z + d.dz;
  var inb = !(x <= 0 || z <= 0 || x >= COLS - 1 || z >= ROWS - 1);
  var ok = inb && grid[z][x] === 0 && !bombAt(x, z);
  if (ok) {
    var occupied = bots.some(function (b) {
      return b.alive && ((b.gx === x && b.gz === z) || (b.moving && b.tx === x && b.tz === z));
    }) || humans().some(function (h) {
      var t = tileOf(h);
      return h !== p && h.alive && t.x === x && t.z === z;
    });
    if (occupied) ok = false;
  }
  return { x: x, z: z, inBounds: inb, ok: ok };
}
function turboLaneInfo(p) {
  var d = aimDir(p), pt = tileOf(p);
  var tiles = [], hit = false;
  for (var r = 1; r <= 4; r++) {
    var x = pt.x + d.dx * r, z = pt.z + d.dz * r;
    if (x < 0 || z < 0 || x >= COLS || z >= ROWS) break;
    if (grid[z][x] === 1 || grid[z][x] === 3) break;
    tiles.push([x, z]);
    var victim = bots.some(function (b) {
      return b.alive && ((b.gx === x && b.gz === z) || (b.moving && b.tx === x && b.tz === z));
    }) || humans().some(function (h) {
      if (h === p || !h.alive) return false;
      var t = tileOf(h);
      return t.x === x && t.z === z;
    });
    if (victim) { hit = true; break; }
  }
  return { tiles: tiles, hit: hit };
}
function placeWall(p) {
  // put the wall on the tile the CAMERA is aiming at (matches the preview)
  var wt = wallTargetInfo(p);
  if (!wt.ok) return false;
  var x = wt.x, z = wt.z;
  grid[z][x] = 3;
  var c = tileCenter(x, z);
  var m = new THREE.Mesh(boxGeo, matTempWall);
  m.position.set(c.x, TS / 2, c.z);
  scene.add(m);
  walls.push({ gx: x, gz: z, timer: 10, mesh: m });
  return true;
}

function sprayAir(p) {
  // the aerosol can: any fart within 2 tiles of you disappears before it spreads
  var pt = tileOf(p);
  var found = false;
  for (var i = bombs.length - 1; i >= 0; i--) {
    var b = bombs[i];
    if (Math.max(Math.abs(b.gx - pt.x), Math.abs(b.gz - pt.z)) <= 2) {
      scene.remove(b.mesh);
      bombs.splice(i, 1);
      found = true;
    }
  }
  if (found) snd(1500, 0.3, 'sine');
  return found;
}

var SUPERS = ['mask', 'sbd', 'dutch'];
var SUPER_NAMES = { mask: 'Gas Mask', sbd: 'Silent But Deadly', dutch: 'Dutch Oven' };
var SUPER_SHORT = { mask: 'MASK', sbd: 'S.B.D.', dutch: 'OVEN' };

function dutchOven(p) {
  var pt = tileOf(p);
  var target = null, best = 99;
  var candidates = bots.filter(function (b) { return b.alive; }).slice();
  humans().forEach(function (h) {
    if (h !== p && h.alive) {
      var t = tileOf(h);
      candidates.push({ gx: t.x, gz: t.z });
    }
  });
  candidates.forEach(function (b) {
    var d = Math.max(Math.abs(b.gx - pt.x), Math.abs(b.gz - pt.z));
    if (d <= 4 && d < best) { best = d; target = b; }
  });
  if (!target) return false;   // nobody close enough to trap
  var dirs8 = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  dirs8.forEach(function (d) {
    var x = target.gx + d[0], z = target.gz + d[1];
    if (x <= 0 || z <= 0 || x >= COLS - 1 || z >= ROWS - 1) return;
    if (grid[z][x] !== 0 || bombAt(x, z)) return;
    if (pt.x === x && pt.z === z) return;   // never wall in the thrower
    var occupiedByBot = bots.some(function (b) {
      return b.alive && ((b.gx === x && b.gz === z) || (b.moving && b.tx === x && b.tz === z));
    });
    if (occupiedByBot) return;
    grid[z][x] = 3;
    var c = tileCenter(x, z);
    var m = new THREE.Mesh(boxGeo, matTempWall);
    m.position.set(c.x, TS / 2, c.z);
    scene.add(m);
    walls.push({ gx: x, gz: z, timer: 4.5, mesh: m });
  });
  placeBomb(target.gx, target.gz, 1, p, { fuse: 1.4 });
  var c2 = tileCenter(target.gx, target.gz);
  var dm = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0xc9a06b, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })
  );
  dm.position.set(c2.x, 0, c2.z);
  scene.add(dm);
  domes.push({ mesh: dm, timer: 4.5 });
  return true;
}

function useSuperFor(p) {
  if (!running || !p || !p.alive) return;
  if (p.superUsed || p.maskTime > 0) { showPMsg(p, 'Superpower used', 'super'); snd(110, 0.15, 'square'); return; }
  var t = p.superType;
  if (t === 'mask') {
    p.superUsed = true;
    p.maskTime = 8;
    if (!twoPlayer) {
      maskoverlay.style.display = 'block';
      maskoverlay.style.opacity = '1';
    }
    snd(400, 0.12, 'sine');
    snd(280, 0.22, 'sine');
  } else if (t === 'sbd') {
    var pt = tileOf(p);
    if (bombAt(pt.x, pt.z)) { snd(110, 0.15, 'square'); return; }
    p.superUsed = true;
    placeBomb(pt.x, pt.z, p.range + 1, p, { hidden: true });
  } else if (t === 'dutch') {
    if (!dutchOven(p)) { snd(110, 0.15, 'square'); return; }   // no rival in range — keep it
    p.superUsed = true;
    snd(240, 0.3, 'sine');
  }
}
// ---- The Big Stinker, phase 2: enraged at half health ----
var warnGeo = new THREE.PlaneGeometry(TS * 0.95, TS * 0.95);
var warnMat = new THREE.MeshBasicMaterial({ color: 0xff7043, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide });
var bossWarnMeshes = [];
function clearBossWarnings() {
  bossWarnMeshes.forEach(function (m) { scene.remove(m); });
  bossWarnMeshes = [];
}
function bossCrossTiles(gx, gz) {
  // a big cardinal cross, range 5 — stops at permanent walls AND trap walls,
  // exactly like a normal blast (crates don't stop it; diagonals stay open)
  var tiles = [[gx, gz]];
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
    for (var r = 1; r <= 5; r++) {
      var x = gx + d[0] * r, z = gz + d[1] * r;
      if (x < 0 || z < 0 || x >= COLS || z >= ROWS) break;
      if (grid[z][x] === 1 || grid[z][x] === 3) break;
      tiles.push([x, z]);
    }
  });
  return tiles;
}
function enrageBoss(bot) {
  bot.phase = 2;
  bot.speed += 0.8;
  bot.maxBombs = 3;
  bot.specialCd = 2.5;               // first special no sooner than 2.5s into phase 2
  bot.telegraph = 0;
  bot.mesh.traverse(function (o) {   // red tint on all his materials
    if (o.isMesh && o.material && o.material.color) {
      o.material = o.material.clone();
      o.material.color.lerp(new THREE.Color(0xff2200), 0.45);
    }
  });
  showLevelMsg('THE BIG STINKER IS ENRAGED!');
  snd(48, 1.2, 'sawtooth');
  snd(90, 0.8, 'square');
}
function updateBossSpecial(bot, dt) {
  if (bot.telegraph > 0) {
    bot.telegraph -= dt;
    warnMat.opacity = 0.28 + 0.22 * Math.abs(Math.sin(performance.now() / 90));
    if (bot.telegraph <= 0) {
      clearBossWarnings();
      // detonate along the warned lanes, recomputed against the CURRENT grid so a
      // trap wall raised during the telegraph blocks propagation like any blast.
      // These go through the normal explosion system (masks, kill logic, walls,
      // air freshener interplay all behave as usual); owner = boss, and the boss
      // hit code skips explosions he owns, so he can't hurt himself.
      var org = bot.warnOrigin || [bot.gx, bot.gz];
      bossCrossTiles(org[0], org[1]).forEach(function (t) {
        var x = t[0], z = t[1];
        if (grid[z][x] === 2) removeCrate(x, z);
        var c = tileCenter(x, z);
        var m = new THREE.Mesh(boomGeo, matBoom);
        m.position.set(c.x, TS * 0.45, c.z);
        scene.add(m);
        explosions.push({ gx: x, gz: z, timer: 0.5, mesh: m, owner: bot });
        var other = bombAt(x, z);
        if (other) explode(other);
      });
      bot.warnOrigin = null;
      fart(FARTS['The Big Stinker'], true);
      snd(45, 0.9, 'sawtooth');
      bot.specialCd = 7 + Math.random() * 2;    // ~7-9s between specials
    }
    return;
  }
  bot.specialCd -= dt;
  if (bot.specialCd <= 0) {
    // telegraph: flat translucent warning tiles for 1.2s before the blast
    bot.warnOrigin = [bot.gx, bot.gz];
    bossCrossTiles(bot.gx, bot.gz).forEach(function (t) {
      var c = tileCenter(t[0], t[1]);
      var m = new THREE.Mesh(warnGeo, warnMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(c.x, 0.12, c.z);
      scene.add(m);
      bossWarnMeshes.push(m);
    });
    bot.telegraph = 1.2;
    snd(210, 0.25, 'square');
    snd(150, 0.4, 'square');
  }
}
function turboToot(p) {
  // a directed blast of stink: blinds whoever is in front of you for 5 seconds.
  // aimed from the CAMERA yaw (matches the lane preview), not the walk rotation
  var d = aimDir(p);
  var pt = tileOf(p);
  for (var r = 1; r <= 4; r++) {
    var x = pt.x + d.dx * r, z = pt.z + d.dz * r;
    if (x < 0 || z < 0 || x >= COLS || z >= ROWS) break;
    if (grid[z][x] === 1 || grid[z][x] === 3) break;   // walls block the stink
    var victim = null;
    bots.forEach(function (b) {
      if (b.alive && ((b.gx === x && b.gz === z) || (b.moving && b.tx === x && b.tz === z))) victim = b;
    });
    if (!victim) humans().forEach(function (h) {
      if (h !== p && h.alive) {
        var t = tileOf(h);
        if (t.x === x && t.z === z) victim = h;
      }
    });
    if (victim) {
      victim.blindTime = 5;
      addBlindCloud(victim);
      spawnStinkPuff(x, z);
      fart(ownerProfile(p), true);
      snd(950, 0.25, 'sawtooth');
      return true;
    }
  }
  return false;
}
function usePowerupFor(p) {
  if (!running || !p || !p.alive || !p.held) return;
  if (p.held === 'wall') {
    if (!placeWall(p)) { showPMsg(p, 'Tile blocked', 'use'); snd(110, 0.2, 'square'); return; }   // no room there — keep holding it
  }
  else if (p.held === 'spray') {
    if (!sprayAir(p)) { showPMsg(p, 'No fart nearby', 'use'); snd(110, 0.2, 'square'); return; }  // save it for when you need it
  }
  else if (p.held === 'turbo') {
    if (!turboToot(p)) { showPMsg(p, 'No target ahead', 'use'); snd(110, 0.2, 'square'); return; } // nobody in your lane — keep it
  }
  else if (p.held === 'bomb') p.maxBombs = Math.min(MAX_GAS, p.maxBombs + 1);
  else if (p.held === 'range') p.range = Math.min(MAX_BLAST, p.range + 1);
  p.held = null;
  clearPreview(p);
  snd(880, 0.18, 'sine');
}
var locked = false;
var keys = {};
var padBombPrev = false, padStartPrev = false, padUsePrev = false;
var padUpPrev = false, padDnPrev = false, padAPrev = false, padMaskPrev = false, padLtPrev = false, padRtPrev = false;

overlay.addEventListener('click', function () {
  if (running && !gameOver) return;                 // bubbled click from a start button that already began the game
  if (!canStartGame()) { flashStartHint(); return; }
  renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', function () {
  locked = document.pointerLockElement === renderer.domElement;
  if (locked) {
    if (running && !gameOver) {
      overlay.style.display = 'none';
      closeMenus();
    } else if (canStartGame()) {
      startGame();
      overlay.style.display = 'none';
      closeMenus();
    } else {
      // a modal (rules / initials / pause) is open or controllers are missing:
      // gaining pointer lock must NOT start a game
      document.exitPointerLock();
    }
  } else {
    if (running && !gameOver) {
      openMenu();
    } else if (!initialsActive) {
      overlay.style.display = 'flex';
      diffbtns.style.display = 'block';
      renderTitleFocus();
    }
  }
});
document.addEventListener('mousemove', function (e) {
  if (!locked || !player) return;
  var sens = 0.0025 * camSpeeds[camSpeedIdx];
  player.yaw -= e.movementX * sens;
  player.pitch = Math.max(0.25, Math.min(1.25, player.pitch + e.movementY * sens));
});
document.addEventListener('keydown', function (e) {
  if (initialsActive) {
    if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
      initLetters[initSlot] = e.key.toUpperCase();
      if (initSlot < 2) initSlot++;
      renderInitials();
    }
    else if (e.code === 'ArrowUp') cycleLetter(1);
    else if (e.code === 'ArrowDown') cycleLetter(-1);
    else if (e.code === 'ArrowLeft') { if (initSlot > 0) initSlot--; renderInitials(); }
    else if (e.code === 'ArrowRight') advanceSlot();
    else if (e.code === 'Enter') { if (initSlot === 2) finishInitials(); else advanceSlot(); }
    else if (e.code === 'Backspace') { if (initSlot > 0) initSlot--; renderInitials(); }
    return;
  }
  if (rulesOpen) {
    if (e.code === 'Enter' || e.code === 'Escape' || e.code === 'Backspace') hideRules();
    return;
  }
  if ((!running || gameOver) && overlay.style.display !== 'none') {
    if (e.code === 'ArrowUp') { titleNav(0, -1); return; }
    if (e.code === 'ArrowDown') { titleNav(0, 1); return; }
    if (e.code === 'ArrowLeft') { titleNav(-1, 0); return; }
    if (e.code === 'ArrowRight') { titleNav(1, 0); return; }
    if (e.code === 'Enter') { titleActivate(); return; }
  }
  if (menuOpen) {
    var btns = menuButtons();
    if (e.code === 'ArrowUp' || e.code === 'KeyW') { menuIndex = (menuIndex + btns.length - 1) % btns.length; renderMenu(); }
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') { menuIndex = (menuIndex + 1) % btns.length; renderMenu(); }
    else if (e.code === 'Enter' || e.code === 'KeyE') menuAction(btns[menuIndex].dataset.act, false);
    return;
  }
  keys[e.code] = true;
  if (e.code === 'Space') {
    e.preventDefault();
    if (locked) {
      if (player && !player.alive && twoPlayer) { player.spec = (player.spec || 0) + 1; }
      else dropBombFor(player);
    }
  }
  if (e.code === 'KeyE') usePowerupFor(player);
  if (e.code === 'KeyQ') useSuperFor(player);
});
document.addEventListener('keyup', function (e) { keys[e.code] = false; });
document.addEventListener('mousedown', function () { if (locked) dropBombFor(player); });

function endGame(text) {
  gameOver = true; running = false; transitioning = false;
  bumpSession();               // cancels pending transitions; new session for our own delay below
  closeMenus();
  padDiscMsg = '';
  resetTransientUI();
  hudroot.style.display = 'none';
  bigmsg.textContent = text;
  later(function () {          // session-guarded: a quit or new game cancels this too
    if (document.pointerLockElement) document.exitPointerLock();
    if (!twoPlayer && player && player.score > 0 && scoreQualifies(player.score)) {
      showInitials({ score: player.score, level: level });
    } else {
      overlay.style.display = 'flex';
      diffbtns.style.display = 'block';
      renderTitleFocus();
    }
    updatePadStatus();
  }, 600);
}

// ---------- main loop ----------
function controlHuman(p, pd, kb, dt) {
  var sens = camSpeeds[camSpeedIdx];
  if (pd) {
    var rx = pd.axes[2] || 0, ry = pd.axes[3] || 0;
    if (Math.abs(rx) > 0.2) p.yaw -= rx * 2.8 * sens * dt;
    if (Math.abs(ry) > 0.2) p.pitch = Math.max(0.25, Math.min(1.25, p.pitch + ry * 1.8 * sens * dt));
    var bp = (pd.buttons[0] && pd.buttons[0].pressed) || (pd.buttons[7] && pd.buttons[7].pressed);
    var ub = pd.buttons[1] && pd.buttons[1].pressed;
    var mk = (pd.buttons[2] && pd.buttons[2].pressed) || (pd.buttons[3] && pd.buttons[3].pressed);
    if (p.suppress) {
      // just resumed (or just spawned): ALL action buttons must be seen released
      // before any press can fire — release and re-press to act
      if (!bp && !ub && !mk) { p.suppress = false; p.prevBomb = false; p.prevUse = false; p.prevMask = false; }
      else { p.prevBomb = true; p.prevUse = true; p.prevMask = true; }
    } else {
      if (bp && !p.prevBomb) dropBombFor(p);
      p.prevBomb = bp;
      if (ub && !p.prevUse) usePowerupFor(p);
      p.prevUse = ub;
      if (mk && !p.prevMask) useSuperFor(p);
      p.prevMask = mk;
    }
  }
  var fwd = 0, str = 0;
  if (kb) {
    fwd = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
    str = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
  }
  if (pd) {
    var lx = pd.axes[0] || 0, ly = pd.axes[1] || 0;
    if (Math.abs(lx) > 0.2) str += lx;
    if (Math.abs(ly) > 0.2) fwd -= ly;
  }
  var len = Math.max(1, Math.hypot(fwd, str));
  // sprinting: hold Shift (keyboard) or click the left stick / left trigger (controller).
  // only sprinting drains stamina (10/sec); it refills (20/sec) whenever you're not sprinting.
  // run dry and you're too tired to sprint until it comes back to 30.
  var moving = fwd !== 0 || str !== 0;
  var wantSprint = false;
  if (kb && (keys['ShiftLeft'] || keys['ShiftRight'])) wantSprint = true;
  if (pd && ((pd.buttons[10] && pd.buttons[10].pressed) || (pd.buttons[6] && pd.buttons[6].pressed))) wantSprint = true;
  if (wantSprint && moving && p.exhausted) showPMsg(p, 'Too tired to sprint', 'sprint');   // throttled inside showPMsg
  var sprinting = wantSprint && moving && !p.exhausted;
  if (sprinting) p.stamina = Math.max(0, p.stamina - 10 * dt);
  else p.stamina = Math.min(100, p.stamina + 20 * dt);
  if (p.stamina <= 0) p.exhausted = true;
  else if (p.stamina >= 30) p.exhausted = false;
  var spd = p.speed * (p.beansTime > 0 || p.reviveTime > 0 ? 2 : 1);   // beans and extra-life revival: double speed
  if (sprinting) spd *= 1.6;
  var vx = (Math.sin(p.yaw) * -fwd + Math.cos(p.yaw) * str) / len * spd;
  var vz = (Math.cos(p.yaw) * -fwd - Math.sin(p.yaw) * str) / len * spd;
  var stuck = overlappingSolids(p.x, p.z);
  var nx = p.x + vx * dt;
  if (!collides(nx, p.z, stuck)) p.x = nx;
  var nz = p.z + vz * dt;
  if (!collides(p.x, nz, stuck)) p.z = nz;
  p.mesh.position.set(p.x, 0, p.z);
  if (fwd || str) p.mesh.rotation.y = Math.atan2(vx, vz);
}

function camBlockedAt(x, y, z) {
  if (y >= TS) return false;                       // above wall height — always clear
  var gx = Math.floor(x / TS), gz = Math.floor(z / TS);
  if (gx < 0 || gz < 0 || gx >= COLS || gz >= ROWS) return false;
  var g = grid[gz][gx];
  return g === 1 || g === 2 || g === 3;            // walls, crates, trap walls (never the floor)
}
function camRayHit(p, dx, dy, dz, want) {
  // cheap grid march from the head toward the desired camera spot: sample every
  // ~0.3 units; if a solid tile is in the way, stop just before it
  for (var d = 0.3; d <= want; d += 0.3) {
    if (camBlockedAt(p.x + dx * d, 1.25 + dy * d, p.z + dz * d)) return Math.max(0.7, d - 0.3);
  }
  return want;
}
function placeCam(cam, p) {
  var want = 6.5, comfy = 2.4, maxPitch = 1.35;
  // If a wall close behind would force an extreme zoom-in (character fills the
  // screen), ride the camera UP over the wall instead: find the smallest extra
  // pitch that restores a comfortable distance (walls have no ceilings, so
  // lifting always has an escape), then smooth toward it.
  var need = 0;
  for (var lift = 0; ; lift += 0.15) {
    var ep = Math.min(p.pitch + lift, maxPitch);
    var t = camRayHit(p, Math.sin(p.yaw) * Math.cos(ep), Math.sin(ep), Math.cos(p.yaw) * Math.cos(ep), want);
    if (t >= comfy || ep >= maxPitch) { need = ep - p.pitch; break; }
  }
  if (p.camLift === undefined) p.camLift = 0;
  p.camLift += (need - p.camLift) * (need > p.camLift ? 0.25 : 0.08); // lift in fast, settle out slow
  var ep2 = Math.min(p.pitch + Math.max(0, p.camLift), maxPitch);
  var dx = Math.sin(p.yaw) * Math.cos(ep2);
  var dz = Math.cos(p.yaw) * Math.cos(ep2);
  var dy = Math.sin(ep2);
  var target = camRayHit(p, dx, dy, dz, want);   // march the ACTUAL ray so we never clip
  if (p.camDist === undefined) p.camDist = target;
  if (target < p.camDist) p.camDist = target;                    // snap in when blocked
  else p.camDist += (target - p.camDist) * 0.12;                 // smooth the recovery back out
  var cd = p.camDist;
  cam.position.set(p.x + dx * cd, 1.2 + dy * cd, p.z + dz * cd);
  cam.lookAt(p.x, 1.1, p.z);
}

function spectate(p, pd, cam, dt) {
  // knocked out: follow someone else — A cycles targets, right stick orbits
  var targets = [], names = [];
  humans().forEach(function (h, i) {
    if (h !== p && h.alive) { targets.push(h); names.push('Player ' + (i + 1)); }
  });
  bots.forEach(function (b) {
    if (b.alive) { targets.push(b); names.push(b.name); }
  });
  if (!targets.length) return;
  if (p.spec === undefined) p.spec = 0;
  if (pd) {
    var aP = (pd.buttons[0] && pd.buttons[0].pressed) || (pd.buttons[1] && pd.buttons[1].pressed);
    if (p.suppress) {
      // just resumed: require a full release before A switches the target
      if (!aP) { p.suppress = false; p.prevBomb = false; }
      else p.prevBomb = true;
    } else {
      if (aP && !p.prevBomb) p.spec++;
      p.prevBomb = aP;
    }
    var sens = camSpeeds[camSpeedIdx];
    var rx = pd.axes[2] || 0, ry = pd.axes[3] || 0;
    if (Math.abs(rx) > 0.2) p.yaw -= rx * 2.8 * sens * dt;
    if (Math.abs(ry) > 0.2) p.pitch = Math.max(0.25, Math.min(1.25, p.pitch + ry * 1.8 * sens * dt));
  }
  var idx = p.spec % targets.length;
  var t = targets[idx];
  p.specName = names[idx];
  var pos = t.x !== undefined ? { x: t.x, z: t.z } : { x: t.mesh.position.x, z: t.mesh.position.z };
  var tmp = { x: pos.x, z: pos.z, yaw: p.yaw, pitch: p.pitch, camDist: p.camDist, camLift: p.camLift };
  placeCam(cam, tmp);
  p.camDist = tmp.camDist;
  p.camLift = tmp.camLift;
}

function viewRect(p) {
  if (!twoPlayer) return { l: 0, t: 0, w: 100, h: 100 };
  if (numPlayers === 2) return p === player ? { l: 0, t: 0, w: 50, h: 100 } : { l: 50, t: 0, w: 50, h: 100 };
  if (p === player) return { l: 0, t: 0, w: 50, h: 50 };
  if (p === player2) return { l: 50, t: 0, w: 50, h: 50 };
  return { l: 0, t: 50, w: 50, h: 50 };
}
var last = performance.now();
function animate() {
  requestAnimationFrame(animate);
  var now = performance.now();
  var dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  // gamepads: assignments were locked at match start (assignPads) and are read
  // back by index every frame — a mid-match connect/disconnect never reshuffles
  // who owns which controller. cps[0] still drives menus and the title screen.
  var pad = null, p1pad = null, p2pad = null, p3pad = null;
  var cps = connectedPads();
  pad = cps[0] || null;
  if (running && !gameOver && padAssign) {
    // a vanished assigned controller ALWAYS pauses the game with a message naming
    // which player lost it (checked BEFORE reclaiming a replacement pad)
    var lostNow = (padAssign.p1 !== null && padAssign.p1 >= 0 && !padByIndex(padAssign.p1)) ? 'Player 1'
      : (numPlayers >= 2 && padAssign.p2 !== null && padAssign.p2 >= 0 && !padByIndex(padAssign.p2)) ? 'Player 2'
      : (numPlayers >= 3 && padAssign.p3 !== null && padAssign.p3 >= 0 && !padByIndex(padAssign.p3)) ? 'Player 3' : null;
    reclaimPads();   // a reconnected (or spare) pad may fill the gap, possibly on a new index
    if (lostNow === 'Player 1' && !padByIndex(padAssign.p1)) padAssign.p1 = -1;   // P1 falls back to keyboard + mouse
    var missNow = missingPadPlayer();
    var newMsg = padDiscMsg;
    if (missNow) newMsg = missNow + ' lost their controller — reconnect it to resume';
    else if (lostNow) newMsg = (lostNow === 'Player 1' && padAssign.p1 === -1)
      ? 'Player 1 controller disconnected — using keyboard + mouse'
      : lostNow + '\'s controller was replaced — you can resume';
    else if (padDiscMsg && padDiscMsg.indexOf('reconnect it') !== -1) newMsg = 'Controller reconnected — you can resume';
    if (newMsg !== padDiscMsg) { padDiscMsg = newMsg; if (menuOpen) renderMenu(); }
    if (lostNow && !menuOpen) openMenu();
    p1pad = padAssign.p1 !== null && padAssign.p1 >= 0 ? padByIndex(padAssign.p1) : null;
    p2pad = padByIndex(padAssign.p2);
    p3pad = padByIndex(padAssign.p3);
  }
  // keep the setup screen's controller status + start-button state fresh
  if ((!running || gameOver) && overlay.style.display !== 'none') updatePadStatus();
  if (pad) {
    // + button: start from the title, or open/close the pause menu in-game
    var plus = pad.buttons[9] && pad.buttons[9].pressed;
    if (plus && !padStartPrev) {
      if (!running || gameOver) {
        if (canStartGame()) startGame();
        else if (!initialsActive && !rulesOpen && !menuOpen) flashStartHint();
      }
      else if (menuOpen) menuAction('resume', true);
      else openMenu();
    }
    padStartPrev = plus;

    var aNow = (pad.buttons[0] && pad.buttons[0].pressed) || (pad.buttons[1] && pad.buttons[1].pressed);
    var upNow = (pad.buttons[12] && pad.buttons[12].pressed) || pad.axes[1] < -0.5;
    var dnNow = (pad.buttons[13] && pad.buttons[13].pressed) || pad.axes[1] > 0.5;
    var ltNow = (pad.buttons[14] && pad.buttons[14].pressed) || pad.axes[0] < -0.5;
    var rtNow = (pad.buttons[15] && pad.buttons[15].pressed) || pad.axes[0] > 0.5;
    if (initialsActive) {
      if (upNow && !padUpPrev) cycleLetter(1);
      if (dnNow && !padDnPrev) cycleLetter(-1);
      if (ltNow && !padLtPrev) { if (initSlot > 0) initSlot--; renderInitials(); }
      if (rtNow && !padRtPrev) advanceSlot();
      if (aNow && !padAPrev) advanceSlot();
    } else if (menuOpen) {
      var mbtns = menuButtons();
      if (upNow && !padUpPrev) { menuIndex = (menuIndex + mbtns.length - 1) % mbtns.length; renderMenu(); }
      if (dnNow && !padDnPrev) { menuIndex = (menuIndex + 1) % mbtns.length; renderMenu(); }
      if (aNow && !padAPrev) menuAction(mbtns[menuIndex].dataset.act, true);
    } else if (rulesOpen) {
      if (aNow && !padAPrev) hideRules();
    } else if (!running || gameOver) {
      if (upNow && !padUpPrev) titleNav(0, -1);
      if (dnNow && !padDnPrev) titleNav(0, 1);
      if (ltNow && !padLtPrev) titleNav(-1, 0);
      if (rtNow && !padRtPrev) titleNav(1, 0);
      if (aNow && !padAPrev) titleActivate();
    }
    padUpPrev = upNow; padDnPrev = dnNow; padAPrev = aNow; padLtPrev = ltNow; padRtPrev = rtNow;
  }

  if (running && !menuOpen && (locked || pad)) {
    // each human: controller (and keyboard for P1) drives movement, camera, and buttons
    if (player.alive) {
      controlHuman(player, p1pad, true, dt);
      placeCam(camera, player);
    } else if (twoPlayer) {
      spectate(player, p1pad, camera, dt);
    }
    if (twoPlayer && player2) {
      if (player2.alive) {
        controlHuman(player2, p2pad, false, dt);
        placeCam(camera2, player2);
      } else {
        spectate(player2, p2pad, camera2, dt);
      }
    }
    if (twoPlayer && player3) {
      if (player3.alive) {
        controlHuman(player3, p3pad, false, dt);
        placeCam(camera3, player3);
      } else {
        spectate(player3, p3pad, camera3, dt);
      }
    }
    // targeting previews for held Trap Wall / Turbo Toot
    updatePreviews();

    // bombs
    bombs.slice().forEach(function (b) {
      b.timer -= dt;
      // the fart cloud slowly swells and wobbles while it lingers
      var s = (1 + (2.2 - b.timer) * 0.3) * (1 + Math.sin(b.timer * 10) * 0.08);
      b.mesh.scale.set(s, s * 0.8, s);
      if (b.timer <= 0) explode(b);
    });
    // blind timers: cover the stinked player's part of the screen
    humans().forEach(function (p, hi) {
      var el = document.getElementById('blind' + hi);
      if (!el) return;
      if (p.blindTime > 0) {
        p.blindTime -= dt;
        if (p.blindTime <= 0) {
          p.blindTime = 0;
          removeBlindCloud(p);
          el.style.display = 'none';
        } else {
          var r;
          if (!twoPlayer) r = { l: 0, t: 0, w: 100, h: 100 };
          else if (numPlayers === 2) r = p === player ? { l: 0, t: 0, w: 50, h: 100 } : { l: 50, t: 0, w: 50, h: 100 };
          else r = p === player ? { l: 0, t: 0, w: 50, h: 50 } : p === player2 ? { l: 50, t: 0, w: 50, h: 50 } : { l: 0, t: 50, w: 50, h: 50 };
          el.style.left = r.l + '%'; el.style.top = r.t + '%';
          el.style.width = r.w + '%'; el.style.height = r.h + '%';
          el.style.display = 'flex';
        }
      } else {
        el.style.display = 'none';
      }
    });
    // revival speed-boost timer
    humans().forEach(function (p) {
      if (p.reviveTime > 0) p.reviveTime = Math.max(0, p.reviveTime - dt);
    });
    // bean power: leave a little fart on every tile you cross
    humans().forEach(function (p) {
      if (!p.alive || !(p.beansTime > 0)) return;
      p.beansTime = Math.max(0, p.beansTime - dt);
      var bt = tileOf(p);
      if (p.trailTile && (bt.x !== p.trailTile.x || bt.z !== p.trailTile.z)) {
        if (!bombAt(p.trailTile.x, p.trailTile.z)) {
          placeBomb(p.trailTile.x, p.trailTile.z, 1, p, { fuse: 1.3, quiet: true });
        }
        p.trailTile = bt;
      }
    });
    // holding an Extra Life makes your avatar shimmer rainbow
    humans().forEach(function (p) {
      if (!p.alive || p.maskTime > 0) return;   // the gas mask gray takes priority
      if (p.lives > 0) p.mesh.userData.mat.color.setHSL((now / 700) % 1, 0.9, 0.55);
      else p.mesh.userData.mat.color.setHex(p.baseColor);
    });
    // gas mask timers: gray while worn, blinks before wearing off
    humans().forEach(function (p) {
      if (p.maskTime <= 0) return;
      p.maskTime -= dt;
      if (p.maskTime <= 0) {
        p.maskTime = 0;
        p.mesh.userData.mat.color.setHex(p.baseColor);
        if (p === player && !twoPlayer) maskoverlay.style.display = 'none';
      } else {
        var blink = p.maskTime < 1.5 && Math.floor(p.maskTime * 6) % 2 === 0;
        p.mesh.userData.mat.color.setHex(blink ? p.baseColor : 0x37474f);
        if (p === player && !twoPlayer) maskoverlay.style.opacity = blink ? '0.35' : '1';
      }
    });
    // dutch oven domes fade out with their walls
    for (var di = domes.length - 1; di >= 0; di--) {
      domes[di].timer -= dt;
      if (domes[di].timer <= 0) { scene.remove(domes[di].mesh); domes.splice(di, 1); }
    }
    // temporary trap walls tick down, blink near the end, then vanish
    for (var wi = walls.length - 1; wi >= 0; wi--) {
      var w = walls[wi];
      w.timer -= dt;
      w.mesh.visible = w.timer > 2 || Math.floor(w.timer * 5) % 2 === 0;
      if (w.timer <= 0) {
        grid[w.gz][w.gx] = 0;
        scene.remove(w.mesh);
        walls.splice(wi, 1);
      }
    }
    // explosions
    for (var i = explosions.length - 1; i >= 0; i--) {
      explosions[i].timer -= dt;
      explosions[i].mesh.material = matBoom;
      if (explosions[i].timer <= 0) {
        scene.remove(explosions[i].mesh);
        explosions.splice(i, 1);
      }
    }
    // powerups spin + pickup
    powerups.slice().forEach(function (u) {
      u.mesh.rotation.y += dt * 2.5;
      u.mesh.position.y = 0.6 + Math.sin(now / 300) * 0.12;
      if (u.type === 'rainbow') {
        u.mesh.material.color.setHSL((now / 600) % 1, 1, 0.55);
        u.mesh.material.emissive.setHSL((now / 600) % 1, 1, 0.35);
      }
      var consumed = false;
      humans().some(function (p) {
        if (!p.alive) return false;
        var pt = tileOf(p);
        if (pt.x !== u.gx || pt.z !== u.gz) return false;
        if (u.type === 'rainbow') {
          // extra life!
          p.lives = (p.lives || 0) + 1;
          snd(523, 0.12, 'sine'); snd(659, 0.12, 'sine'); snd(784, 0.25, 'sine');
        } else if (u.type === 'beans') {
          // eat them on the spot: fart trail for 6 seconds!
          p.beansTime = 6;
          p.trailTile = tileOf(p);
          snd(500, 0.1, 'sine'); snd(330, 0.18, 'sine');
        } else if (u.type === 'bomb') {
          // passive: applies instantly; at the cap it stays on the floor
          if (p.maxBombs >= MAX_GAS) { cappedFx(p, 'Gas full', 'cap'); return true; }
          p.maxBombs++;
          snd(660, 0.15, 'sine');
        } else if (u.type === 'range') {
          if (p.range >= MAX_BLAST) { cappedFx(p, 'Blast full', 'cap'); return true; }
          p.range++;
          snd(660, 0.15, 'sine');
        } else if (u.type === 'speed') {
          if (p.speed >= MAX_SPEED - 0.001) { cappedFx(p, 'Speed full', 'cap'); return true; }
          p.speed = Math.min(MAX_SPEED, p.speed + SPEED_STEP);
          snd(660, 0.15, 'sine');
        } else {
          // active held item (wall/spray/turbo): hands full? it stays on the floor
          if (p.held) { cappedFx(p, 'Item slot full', 'slot'); return true; }
          p.held = u.type;
          snd(660, 0.15, 'sine');
        }
        consumed = true;
        scene.remove(u.mesh);
        powerups.splice(powerups.indexOf(u), 1);
        return true;
      });
      // bots collect PASSIVE upgrades only — never held items, beans, or extra lives
      if (!consumed && (u.type === 'bomb' || u.type === 'range' || u.type === 'speed')) {
        for (var ubi = 0; ubi < bots.length; ubi++) {
          var ubb = bots[ubi];
          if (!ubb.alive || ubb.gx !== u.gx || ubb.gz !== u.gz) continue;
          if (!botWantsPU(ubb, u)) break;   // capped: walk over it, leave it
          if (u.type === 'bomb') ubb.maxBombs++;
          else if (u.type === 'range') ubb.range++;
          else ubb.speed = Math.min(MAX_SPEED, ubb.speed + SPEED_STEP);
          snd(660, 0.1, 'sine');
          scene.remove(u.mesh);
          powerups.splice(powerups.indexOf(u), 1);
          break;
        }
      }
    });
    // bots
    bots.forEach(function (bot) {
      if (!bot.alive) return;
      if (bot.blindTime > 0) {
        bot.blindTime -= dt;
        if (bot.blindTime <= 0) { bot.blindTime = 0; removeBlindCloud(bot); }
      }
      if (bot.hitCd > 0) bot.hitCd -= dt;
      if (bot.boss) {
        var bscale = bot.hitCd > 0.45 ? 2.5 : 2.2;                  // flinch when hit
        if (bot.phase === 2) bscale += 0.06 + Math.sin(now / 130) * 0.1;   // enraged: stronger pulsing
        bot.mesh.scale.setScalar(bscale);
        if (bot.phase === 2) updateBossSpecial(bot, dt);
      }
      botThink(bot, dt);
      if (bot.moving) {
        var c = tileCenter(bot.tx, bot.tz);
        var dx = c.x - bot.mesh.position.x, dz = c.z - bot.mesh.position.z;
        var dist = Math.hypot(dx, dz);
        var step = bot.speed * dt;
        if (dist <= step) {
          bot.mesh.position.set(c.x, 0, c.z);
          bot.gx = bot.tx; bot.gz = bot.tz; bot.moving = false;
        } else {
          bot.mesh.position.x += dx / dist * step;
          bot.mesh.position.z += dz / dist * step;
          bot.mesh.rotation.y = Math.atan2(dx, dz);
        }
      }
      var tiles = [[bot.gx, bot.gz]];
      if (bot.moving) tiles.push([bot.tx, bot.tz]);
      var hitE = null;
      tiles.forEach(function (t) {
        explosions.forEach(function (e2) { if (e2.gx === t[0] && e2.gz === t[1]) hitE = e2; });
      });
      if (hitE) {
        if (bot.boss) {
          // the boss takes 100 damage per blast (not from his own farts)
          if ((bot.hitCd || 0) <= 0 && hitE.owner !== bot) {
            bot.hp -= 100;
            bot.hitCd = 0.6;
            snd(85, 0.35, 'sawtooth');
            if (hitE.owner && hitE.owner.score !== undefined) hitE.owner.score += 100;
            if (bot.hp > 0 && bot.phase === 1 && bot.hp <= 500) enrageBoss(bot);   // phase 2 triggers ONCE at half health
            if (bot.hp <= 0) {
              bot.alive = false;
              scene.remove(bot.mesh);
              clearBossWarnings();
              snd(60, 0.8, 'sawtooth'); snd(40, 1.0, 'triangle');
              if (hitE.owner && hitE.owner.score !== undefined) hitE.owner.score += 1000;   // boss bonus!
            }
          }
        } else {
          bot.alive = false;
          scene.remove(bot.mesh);
          snd(120, 0.5, 'triangle');
          if (hitE.owner && hitE.owner.score !== undefined) hitE.owner.score += 100;   // 100 points per rival YOU gassed
        }
      }
    });
    // player hit?
    // did anyone get gassed?
    humans().forEach(function (p, hIdx) {
      if (!p.alive || transitioning || p.maskTime > 0) return;
      var t = tileOf(p);
      var hitBy = null;
      explosions.forEach(function (e2) { if (e2.gx === t.x && e2.gz === t.z) hitBy = e2; });
      if (hitBy) {
        if (p.lives > 0) {
          // the rainbow saves you: spend a life, flash invincible for 2 seconds
          // with bean-style double speed to escape the danger
          p.lives--;
          p.maskTime = 2;
          p.reviveTime = 2;
          showLevelMsg((twoPlayer ? 'Player ' + (hIdx + 1) : 'You') + ' used an Extra Life!');
          snd(784, 0.12, 'sine'); snd(523, 0.2, 'sine');
          return;
        }
        p.alive = false;
        scene.remove(p.mesh);
        // 200 points for gassing another player
        if (hitBy.owner && hitBy.owner !== p && hitBy.owner.score !== undefined) hitBy.owner.score += 200;
        if (!twoPlayer) {
          maskoverlay.style.display = 'none';
          endGame('You got gassed on level ' + level + '! Pick a difficulty to try again');
        }
      }
    });
    if (twoPlayer && !transitioning) {
      // versus round: last one standing wins the level, then EVERYONE moves on together
      var aliveH = humans().filter(function (p) { return p.alive; });
      var aliveBotCount = bots.filter(function (b) { return b.alive; }).length;
      if (aliveH.length === 0) {
        endGame('The rivals win! Press Start to play again');
      } else if (aliveH.length === 1 && aliveBotCount === 0) {
        transitioning = true;
        var winner = aliveH[0];
        winner.wins = (winner.wins || 0) + 1;
        winner.score = (winner.score || 0) + 500;   // 500 point round-win bonus
        var wname = winner === player ? 'Player 1' : winner === player2 ? 'Player 2' : 'Player 3';
        showLevelMsg(wname + ' wins the round!');
        snd(520, 0.2, 'sine'); snd(780, 0.3, 'sine');
        later(function () {             // session-guarded AND cleared on quit/endGame/startGame
          if (!transitioning) return;   // belt-and-braces: player quit during the transition
          level++;
          startLevel(true);
          showLevelMsg(level % 10 === 0
            ? 'Level ' + level + ': BOSS FIGHT — The Big Stinker!'
            : 'Level ' + level + ': ' + currentMaze.name + ' — ' + SUPER_NAMES[player.superType] + '!');
          transitioning = false;
        }, 1700);
      }
    } else if (!twoPlayer) {
      // level cleared?
      if (player.alive && !transitioning && bots.length && bots.every(function (b) { return !b.alive; })) {
        transitioning = true;
        player.score += 500;   // 500 point bonus for winning the level
        showLevelMsg('Level ' + level + ' cleared! +500');
        snd(520, 0.2, 'sine'); snd(780, 0.3, 'sine');
        later(function () {             // session-guarded AND cleared on quit/endGame/startGame
          if (!transitioning) return;   // belt-and-braces: player quit during the transition
          level++;
          startLevel(true);
          showLevelMsg(level % 10 === 0
            ? 'Level ' + level + ': BOSS FIGHT — The Big Stinker!'
            : 'Level ' + level + ': ' + currentMaze.name + ' — ' + SUPER_NAMES[player.superType] + '!');
          transitioning = false;
        }, 1700);
      }
    }

    // minimap: walls, crates, farts, power-ups, and everyone's position
    if (numPlayers !== 3) {
      var mmv = document.getElementById('minimap');
      var mc = mmv.getContext('2d');
      var mts = 10;
      mc.clearRect(0, 0, mmv.width, mmv.height);
      for (var mz = 0; mz < ROWS; mz++) {
        for (var mxx = 0; mxx < COLS; mxx++) {
          var mg = grid[mz][mxx];
          if (!mg) continue;
          mc.fillStyle = mg === 1 ? '#7986cb' : mg === 2 ? '#efe8d8' : '#66bb6a';
          mc.fillRect(mxx * mts, mz * mts, mts - 1, mts - 1);
        }
      }
      bombs.forEach(function (b) {
        if (b.hidden) return;
        mc.fillStyle = '#558b2f';
        mc.beginPath(); mc.arc(b.gx * mts + 5, b.gz * mts + 5, 3.5, 0, 7); mc.fill();
      });
      powerups.forEach(function (u) {
        mc.fillStyle = u.type === 'beans' ? '#a1662f' : '#ffd54f';
        mc.fillRect(u.gx * mts + 3, u.gz * mts + 3, 4, 4);
      });
      bots.forEach(function (b) {
        if (!b.alive) return;
        mc.fillStyle = '#' + ('00000' + b.color.toString(16)).slice(-6);
        mc.beginPath(); mc.arc(b.mesh.position.x / TS * mts, b.mesh.position.z / TS * mts, 3.5, 0, 7); mc.fill();
      });
      humans().forEach(function (p) {
        if (!p.alive) return;
        mc.fillStyle = '#' + ('00000' + p.baseColor.toString(16)).slice(-6);
        mc.beginPath(); mc.arc(p.x / TS * mts, p.z / TS * mts, 4.5, 0, 7); mc.fill();
        mc.strokeStyle = '#fff'; mc.lineWidth = 1.5; mc.stroke();
      });
    }

    var aliveBots = bots.filter(function (b) { return b.alive; }).length;
    // stamina bar (1P)
    if (!twoPlayer) {
      var sf = document.getElementById('stamfill');
      sf.style.width = Math.round(player.stamina) + '%';
      sf.style.background = player.stamina > 40 ? '#66bb6a' : player.stamina > 15 ? '#fdd835' : '#e53935';
    }
    // boss health bar
    var bossAlive = null;
    bots.forEach(function (b) { if (b.boss && b.alive) bossAlive = b; });
    document.getElementById('bossbar').style.display = bossAlive ? 'block' : 'none';
    if (bossAlive) document.getElementById('bossfill').style.width = Math.max(0, bossAlive.hp / 10) + '%';
    var puNames = PU_NAME, puColors = PU_COLOR;
    if (twoPlayer) {
      document.getElementById('hudTL').innerHTML = twoPHudHtml('Player 1', '#64b5f6', player);
      document.getElementById('hudTR').innerHTML = twoPHudHtml('Player 2', '#81c784', player2) +
        '<div class="hsub" style="margin-top:4px">Level ' + level + ' &middot; Rivals left: ' + aliveBots + '</div>';
      if (player3) document.getElementById('hudP3').innerHTML = twoPHudHtml('Player 3', '#ea80fc', player3);
      renderer.autoClear = true;
    } else {
    document.getElementById('hLevel').textContent = level;
    document.getElementById('hDiff').textContent = ['Easy', 'Medium', 'Hard'][difficulty];
    document.getElementById('hScore').textContent = 'Score ' + player.score +
      (player.lives > 0 ? ' · Lives ' + player.lives : '') +
      (player.beansTime > 0 ? ' · BEANS ' + Math.ceil(player.beansTime) + 's!' : '');
    document.getElementById('hRivals').textContent = aliveBots;
    document.getElementById('hGas').textContent = player.maxBombs;
    document.getElementById('hBlast').textContent = player.range;
    document.getElementById('hSpeed').textContent = player.speed.toFixed(1);
    var slotA = document.getElementById('slotA'), slotAName = document.getElementById('slotAName');
    if (player.held) {
      slotAName.textContent = puNames[player.held];
      slotAName.style.color = puColors[player.held];
      slotA.style.borderColor = puColors[player.held];
      slotA.style.boxShadow = '0 0 16px ' + puColors[player.held];
    } else {
      slotAName.innerHTML = '&mdash;';
      slotAName.style.color = '#fff';
      slotA.style.borderColor = 'rgba(255,255,255,0.9)';
      slotA.style.boxShadow = 'none';
    }
    var slotX = document.getElementById('slotX'), slotXName = document.getElementById('slotXName');
    if (player.maskTime > 0) {
      slotXName.textContent = Math.ceil(player.maskTime) + 's';
      slotXName.style.color = '#66bb6a';
      slotX.style.borderColor = '#66bb6a';
      slotX.style.boxShadow = '0 0 16px #66bb6a';
      slotX.style.opacity = '1';
    } else if (player.superUsed) {
      slotXName.textContent = 'USED';
      slotXName.style.color = '#90a4ae';
      slotX.style.borderColor = '#607d8b';
      slotX.style.boxShadow = 'none';
      slotX.style.opacity = '0.55';
    } else {
      slotXName.textContent = SUPER_SHORT[player.superType];
      slotXName.style.color = '#fff';
      slotX.style.borderColor = 'rgba(255,255,255,0.9)';
      slotX.style.boxShadow = 'none';
      slotX.style.opacity = '1';
    }
    }
  }

  if (twoPlayer && player3 && running) {
    // 3 players: four quadrants — P1, P2, P3, and a bird's-eye view of the arena
    var qw = window.innerWidth / 2, qh = window.innerHeight / 2;
    renderer.setScissorTest(true);
    renderer.setScissor(0, qh, qw, qh);  renderer.setViewport(0, qh, qw, qh);  renderer.render(scene, camera);
    renderer.setScissor(qw, qh, qw, qh); renderer.setViewport(qw, qh, qw, qh); renderer.render(scene, camera2);
    renderer.setScissor(0, 0, qw, qh);   renderer.setViewport(0, 0, qw, qh);   renderer.render(scene, camera3);
    renderer.setScissor(qw, 0, qw, qh);  renderer.setViewport(qw, 0, qw, qh);  renderer.render(scene, cameraTop);
    renderer.setScissorTest(false);
  } else if (twoPlayer && player2 && running) {
    var hw = window.innerWidth / 2, hh = window.innerHeight;
    renderer.setScissorTest(true);
    renderer.setScissor(0, 0, hw, hh);
    renderer.setViewport(0, 0, hw, hh);
    renderer.render(scene, camera);
    renderer.setScissor(hw, 0, hw, hh);
    renderer.setViewport(hw, 0, hw, hh);
    renderer.render(scene, camera2);
    renderer.setScissorTest(false);
  } else {
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.render(scene, camera);
  }
}
buildWorld();
camera.position.set(COLS * TS / 2, 22, ROWS * TS + 10);
camera.lookAt(COLS * TS / 2, 0, ROWS * TS / 2);
renderScoreboard();
renderTitleFocus();
updatePadStatus();
window.addEventListener('gamepadconnected', function () { updatePadStatus(); });
window.addEventListener('gamepaddisconnected', function () { updatePadStatus(); });
animate();

window.addEventListener('resize', function () {
  setAspects();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
