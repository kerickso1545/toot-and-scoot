// ---- targeting previews while holding a Trap Wall or Turbo Toot ----
var previewBoxGeo  = new THREE.BoxGeometry(TS * 0.92, TS * 0.92, TS * 0.92);
var previewLaneGeo = new THREE.BoxGeometry(TS * 0.9, 0.14, TS * 0.9);
var previewMatOk   = new THREE.MeshBasicMaterial({ color: 0x69f0ae, transparent: true, opacity: 0.35, depthWrite: false });
var previewMatBad  = new THREE.MeshBasicMaterial({ color: 0xff5252, transparent: true, opacity: 0.35, depthWrite: false });
var previewMatHit  = new THREE.MeshBasicMaterial({ color: 0xea80fc, transparent: true, opacity: 0.45, depthWrite: false });
var previewMatMiss = new THREE.MeshBasicMaterial({ color: 0xb0bec5, transparent: true, opacity: 0.22, depthWrite: false });
function clearPreview(p) {
  if (p && p.previewGroup) { scene.remove(p.previewGroup); p.previewGroup = null; }
}
function updatePreviews() {
  humans().forEach(function (p) {
    clearPreview(p);
    if (!p.alive || (p.held !== 'wall' && p.held !== 'turbo')) return;
    var g = new THREE.Group();
    if (p.held === 'wall') {
      var wt = wallTargetInfo(p);
      if (wt.inBounds) {
        var c = tileCenter(wt.x, wt.z);
        var m = new THREE.Mesh(previewBoxGeo, wt.ok ? previewMatOk : previewMatBad);
        m.position.set(c.x, TS / 2, c.z);
        g.add(m);
      }
    } else {
      var ln = turboLaneInfo(p);
      ln.tiles.forEach(function (t) {
        var c2 = tileCenter(t[0], t[1]);
        var m2 = new THREE.Mesh(previewLaneGeo, ln.hit ? previewMatHit : previewMatMiss);
        m2.position.set(c2.x, 0.1, c2.z);
        g.add(m2);
      });
    }
    if (g.children.length) { scene.add(g); p.previewGroup = g; }
  });
}
// ================================================================
// Fart Cloud FX Engine (WS-A)
// Pooled sprite gas-puff particles, ground glow, dutch-oven swirls,
// upgraded blind clouds, and per-player camera shake.
//
// fx.js loads AFTER constants/theme (THREE, TS, canvasTex available at
// load time) but BEFORE main.js — so nothing here may TOUCH main.js
// state (scene, humans, domes, tileCenter...) at load time. Textures,
// geometries, and materials are created at load; the sprite pool is
// built lazily on the first spawn; everything else runs at runtime.
//
// Public API (all globals, called by main.js — see HANDOFF-ws-fx.md):
//   spawnFartCloud(gx, gz, opts)   opts: { big, boss, color }
//   fxExplosionAt(tiles, opts)     one call per blast: clouds + shake
//   fxGroundGlow(gx, gz, boss)     pooled glow plane for explosions[]
//   spawnDutchSwirl(wx, wz, dur)   swirling puffs around the oven dome
//   spawnMiniPuff(wx, wz, color)   tiny toot wisp (bean trail)
//   updateFX(dt)                   advance everything (from animate())
//   resetFX()                      instant teardown (resetTransientUI)
//   addShake(p, mag)               kick a player's camera shake
//   getShakeOffset(p, dt)          decayed offset for placeCam
//   applyShake(cam, p, dt)         one-liner: add offset to a camera
//   fxShakeEnabled                 "Screen shake" settings toggle flag
// ================================================================

var FX_MAX_PUFFS = 150;      // hard cap — pool never grows past this
var FX_MAX_GLOWS = 60;       // pooled ground-glow planes (overflow allocs)
var FX_SHAKE_DUR = 0.2;      // seconds; shake always decays within this
var fxShakeEnabled = true;   // flipped by the Settings "Screen shake" toggle

// comedy-gas palettes: green #88aa33 family; boss stink darker + purple
var FX_FART_TINTS  = [0x88aa33, 0x9bbf3e, 0x7a9a2d, 0xaac455];
var FX_BOSS_TINTS  = [0x6d4d85, 0x59396f, 0x7e5b96, 0x8a9a4a];
var FX_DUTCH_TINTS = [0xb08d5e, 0x9c7a4f, 0x8a9a4a];
var FX_MINT_TINTS  = [0xdff5ea, 0xc4ecd9, 0xffffff];

// soft cartoon puff: a cluster of blurry blobs, white so tint = mat color
var fxPuffTex = canvasTex(function (c) {
  c.clearRect(0, 0, 128, 128);
  var blobs = [[64, 64, 40], [42, 74, 26], [88, 72, 25], [56, 44, 24], [80, 46, 21], [64, 86, 22]];
  for (var i = 0; i < blobs.length; i++) {
    var g = c.createRadialGradient(blobs[i][0], blobs[i][1], 2, blobs[i][0], blobs[i][1], blobs[i][2]);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(blobs[i][0], blobs[i][1], blobs[i][2], 0, 7); c.fill();
  }
});
// radial glow for the per-tile ground plane under a blast
var fxGlowTex = canvasTex(function (c) {
  c.clearRect(0, 0, 128, 128);
  var g = c.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
});

var fxPuffBaseMat = new THREE.SpriteMaterial({ map: fxPuffTex, transparent: true, opacity: 0, depthWrite: false });
var fxGlowGeo     = new THREE.PlaneGeometry(TS * 1.15, TS * 1.15);
var fxGlowMat     = new THREE.MeshBasicMaterial({ map: fxGlowTex, color: 0x8fd44a, transparent: true, opacity: 0.45,
                                                  depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
var fxGlowBossMat = new THREE.MeshBasicMaterial({ map: fxGlowTex, color: 0x9a5fc0, transparent: true, opacity: 0.45,
                                                  depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
var fxBlindMat    = new THREE.SpriteMaterial({ map: fxPuffTex, color: 0x6b8e23, transparent: true, opacity: 0.85, depthWrite: false });

// ---- the puff pool: FX_MAX_PUFFS sprites, allocated once, reused forever.
// each slot owns ONE material clone (made at pool build, never per frame)
// so opacity/tint/rotation can differ per sprite.
var fxPool = null;
var fxSeq = 0;
var fxEmitters = [];    // dutch-oven swirl emitters
var fxBlindList = [];   // live blind-cloud groups to animate
var fxGlowPool = [];    // pooled ground-glow meshes (free when .parent is null)

function fxEnsurePool() {
  if (fxPool) return;
  fxPool = [];
  for (var i = 0; i < FX_MAX_PUFFS; i++) {
    var mat = fxPuffBaseMat.clone();
    var s = new THREE.Sprite(mat);
    s.visible = false;
    fxPool.push({ sprite: s, mat: mat, active: false, seq: 0,
      age: 0, life: 1, sw: 0.15, fd: 0.3, mode: 0,
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      cx: 0, cz: 0, ang: 0, angVel: 0, rad: 0,
      size: 1, peak: 0.7, spin: 0, rot0: 0 });
  }
}
function fxAllocPuff() {
  fxEnsurePool();
  var q = null;
  for (var i = 0; i < FX_MAX_PUFFS; i++) {
    if (!fxPool[i].active) { q = fxPool[i]; break; }
  }
  if (!q) {
    // pool exhausted (3P chain reactions): steal the oldest puff
    var oldest = Infinity;
    for (var j = 0; j < FX_MAX_PUFFS; j++) {
      if (fxPool[j].seq < oldest) { oldest = fxPool[j].seq; q = fxPool[j]; }
    }
  }
  q.active = true;
  q.seq = ++fxSeq;
  q.age = 0;
  q.mode = 0;
  if (!q.sprite.parent) scene.add(q.sprite);   // added once, then reused
  q.sprite.visible = true;
  return q;
}
function fxConfigPuff(q, x, y, z, size, life, peak, tint) {
  q.x = x; q.y = y; q.z = z;
  q.vx = 0; q.vy = 0; q.vz = 0;
  q.size = size;
  q.life = life;
  q.sw = Math.min(0.15, life * 0.25);          // burst-swell
  q.fd = Math.min(0.3,  life * 0.45);          // linger-fade tail
  q.peak = peak;
  q.rot0 = Math.random() * Math.PI * 2;
  q.spin = (Math.random() - 0.5) * 2.4;
  q.mat.rotation = q.rot0;
  q.mat.color.setHex(tint);
  q.mat.color.offsetHSL((Math.random() - 0.5) * 0.02, 0, (Math.random() - 0.5) * 0.08);
  q.mat.opacity = 0;
  q.sprite.position.set(x, y, z);
  q.sprite.scale.set(0.05, 0.05, 1);
}

// ---- public spawners ----
function spawnFartCloud(gx, gz, opts) {
  opts = opts || {};
  var c = tileCenter(gx, gz);
  var boss = !!opts.boss, big = !!opts.big;
  var pal = boss ? FX_BOSS_TINTS : FX_FART_TINTS;
  var n = big ? (boss ? 9 : 8) : 3;
  // 3-phase lifecycle: burst-swell (~0.15s) -> billow-drift (to ~0.45s,
  // matching the blast linger) -> linger-fade (~0.3s, purely cosmetic)
  var life = big ? 0.75 : 0.6;
  for (var i = 0; i < n; i++) {
    var q = fxAllocPuff();
    var ox = (Math.random() - 0.5) * TS * (big ? 0.9 : 0.7);
    var oz = (Math.random() - 0.5) * TS * (big ? 0.9 : 0.7);
    var y = 0.3 + Math.random() * (big ? 1.2 : 0.8);
    var size = big ? 1.5 + Math.random() * 0.9 : 0.9 + Math.random() * 0.6;
    var tint = opts.color !== undefined ? opts.color : pal[Math.floor(Math.random() * pal.length)];
    fxConfigPuff(q, c.x + ox, y, c.z + oz, size, life + Math.random() * 0.15, boss ? 0.8 : 0.72, tint);
    var sp = (big ? 1.1 : 0.7) + Math.random() * 0.6;
    var d = Math.sqrt(ox * ox + oz * oz) || 1;
    q.vx = (ox / d) * sp;
    q.vz = (oz / d) * sp;
    q.vy = 0.9 + Math.random() * 0.9;          // comedy gas rises
  }
}
function fxExplosionAt(tiles, opts) {
  // one call per blast: big mushroom cluster on the origin tile, smaller
  // wisps along the arms, plus proximity camera shake for every human
  opts = opts || {};
  for (var i = 0; i < tiles.length; i++) {
    spawnFartCloud(tiles[i][0], tiles[i][1], { big: i === 0, boss: opts.boss, color: opts.color });
  }
  fxShakeFromTiles(tiles, opts.boss ? 0.42 : 0.3);
}
function fxGroundGlow(gx, gz, boss) {
  // pooled soft glow plane — the explosions[] entry mesh. main.js keeps
  // ownership: it scene.remove()s the mesh when timer expires, which is
  // exactly how the pool marks a slot free (mesh.parent === null).
  var c = tileCenter(gx, gz);
  var m = null;
  for (var i = 0; i < fxGlowPool.length; i++) {
    if (!fxGlowPool[i].parent) { m = fxGlowPool[i]; break; }
  }
  if (!m) {
    m = new THREE.Mesh(fxGlowGeo, fxGlowMat);
    m.rotation.x = -Math.PI / 2;
    if (fxGlowPool.length < FX_MAX_GLOWS) fxGlowPool.push(m);
    // beyond the cap (extreme chains) the mesh is unpooled and GC'd later
  }
  m.material = boss ? fxGlowBossMat : fxGlowMat;
  m.position.set(c.x, 0.07, c.z);
  scene.add(m);
  return m;
}
function spawnDutchSwirl(wx, wz, dur) {
  // swirling puffs orbiting inside the dutch-oven dome (world coords)
  if (fxEmitters.length >= 8) fxEmitters.shift();
  fxEmitters.push({ cx: wx, cz: wz, timer: dur || 4.5, acc: 0, interval: 0.16 });
}
function fxSpawnSwirlPuff(em) {
  var q = fxAllocPuff();
  var tint = FX_DUTCH_TINTS[Math.floor(Math.random() * FX_DUTCH_TINTS.length)];
  var ang = Math.random() * Math.PI * 2;
  var rad = 1.6 + Math.random() * 1.0;
  fxConfigPuff(q, em.cx + Math.cos(ang) * rad, 0.25 + Math.random() * 0.4,
               em.cz + Math.sin(ang) * rad, 0.8 + Math.random() * 0.5,
               1.3 + Math.random() * 0.3, 0.5, tint);
  q.mode = 1;                                   // orbit mode
  q.cx = em.cx; q.cz = em.cz;
  q.ang = ang;
  q.angVel = 1.6 + Math.random() * 1.2;         // all one direction: a real swirl
  q.rad = rad;
  q.vy = 0.55 + Math.random() * 0.5;
}
function spawnMiniPuff(wx, wz, color) {
  // tiny toot wisp at world coords (bean trail, little gags)
  for (var i = 0; i < 2; i++) {
    var q = fxAllocPuff();
    var tint = color !== undefined ? color : FX_FART_TINTS[Math.floor(Math.random() * FX_FART_TINTS.length)];
    fxConfigPuff(q, wx + (Math.random() - 0.5) * 0.4, 0.35 + Math.random() * 0.25,
                 wz + (Math.random() - 0.5) * 0.4, 0.45 + Math.random() * 0.25,
                 0.5, 0.55, tint);
    q.vx = (Math.random() - 0.5) * 0.4;
    q.vz = (Math.random() - 0.5) * 0.4;
    q.vy = 0.8 + Math.random() * 0.5;
  }
}

// ---- camera shake (state lives on the player object: p.shakeT/p.shakeMag) ----
function addShake(p, mag) {
  if (!p) return;
  p.shakeT = FX_SHAKE_DUR;
  p.shakeMag = Math.max(p.shakeMag || 0, Math.min(mag, 0.45));
}
function fxShakeFromTiles(tiles, baseMag) {
  if (typeof humans !== 'function') return;
  humans().forEach(function (p) {
    if (!p.alive) return;
    var best = Infinity;
    for (var i = 0; i < tiles.length; i++) {
      var c = tileCenter(tiles[i][0], tiles[i][1]);
      var dx = c.x - p.x, dz = c.z - p.z;
      var d2 = dx * dx + dz * dz;
      if (d2 < best) best = d2;
    }
    var k = 1 - Math.sqrt(best) / 10;           // full punch up close, gone by 10 units
    if (k > 0) addShake(p, baseMag * k);
  });
}
var fxShakeScratch = { x: 0, y: 0, z: 0 };
function getShakeOffset(p, dt) {
  fxShakeScratch.x = 0; fxShakeScratch.y = 0; fxShakeScratch.z = 0;
  if (!p || !p.shakeT || p.shakeT <= 0) return fxShakeScratch;
  p.shakeT = Math.max(0, p.shakeT - dt);
  if (p.shakeT === 0) p.shakeMag = 0;
  if (!fxShakeEnabled) return fxShakeScratch;
  var k = p.shakeT / FX_SHAKE_DUR;
  var a = (p.shakeMag || 0) * k * k;             // quadratic decay, done in <=0.2s
  var t = performance.now();
  fxShakeScratch.x = a * Math.sin(t * 0.055);
  fxShakeScratch.y = a * 0.6 * Math.sin(t * 0.082 + 1.7);
  fxShakeScratch.z = a * Math.sin(t * 0.047 + 3.9);
  return fxShakeScratch;
}
function applyShake(cam, p, dt) {
  // one-liner for main.js: nudge a camera AFTER placeCam resolved collision
  var sh = getShakeOffset(p, dt);
  if (sh.x || sh.y || sh.z) {
    cam.position.x += sh.x;
    cam.position.y += sh.y;
    cam.position.z += sh.z;
  }
}

// ---- per-frame advance (called from animate() with the frame dt) ----
function updateFX(dt) {
  var now = performance.now();
  // shared heartbeat pulse on the blast ground glows (one material, all tiles)
  var pulse = 0.34 + 0.16 * Math.abs(Math.sin(now * 0.012));
  fxGlowMat.opacity = pulse;
  fxGlowBossMat.opacity = pulse;
  // dutch-oven swirl emitters
  for (var ei = fxEmitters.length - 1; ei >= 0; ei--) {
    var em = fxEmitters[ei];
    em.timer -= dt;
    if (em.timer <= 0) { fxEmitters.splice(ei, 1); continue; }
    em.acc += dt;
    while (em.acc >= em.interval) {
      em.acc -= em.interval;
      fxSpawnSwirlPuff(em);
    }
  }
  // blind clouds: three puffs chasing each other over the victim's head
  for (var bi = fxBlindList.length - 1; bi >= 0; bi--) {
    var be = fxBlindList[bi];
    if (!be.v || be.v.blindMesh !== be.group) { fxBlindList.splice(bi, 1); continue; }
    be.t += dt;
    var kids = be.group.children;
    for (var ci = 0; ci < kids.length; ci++) {
      var a = be.t * 2.2 + ci * 2.09;
      kids[ci].position.set(Math.cos(a) * 0.34,
                            Math.sin(be.t * 3.1 + ci * 1.7) * 0.14,
                            Math.sin(a) * 0.34);
    }
  }
  // the puff pool
  if (!fxPool) return;
  var damp = 1 / (1 + 1.6 * dt);
  for (var i = 0; i < FX_MAX_PUFFS; i++) {
    var q = fxPool[i];
    if (!q.active) continue;
    q.age += dt;
    if (q.age >= q.life) { q.active = false; q.sprite.visible = false; continue; }
    if (q.mode === 1) {                          // orbit (dutch-oven swirl)
      q.ang += q.angVel * dt;
      q.rad += 0.25 * dt;
      q.y += q.vy * dt;
      q.x = q.cx + Math.cos(q.ang) * q.rad;
      q.z = q.cz + Math.sin(q.ang) * q.rad;
    } else {                                     // billow-drift
      q.vx *= damp; q.vz *= damp;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
    }
    q.mat.rotation = q.rot0 + q.spin * q.age;
    var sc, op;
    if (q.age < q.sw) {                          // phase 1: burst-swell
      var k1 = q.age / q.sw; k1 = k1 * (2 - k1);
      sc = q.size * (0.3 + 0.7 * k1);
      op = q.peak * k1;
    } else if (q.age < q.life - q.fd) {          // phase 2: billow-drift
      var k2 = (q.age - q.sw) / Math.max(0.001, q.life - q.fd - q.sw);
      sc = q.size * (1 + 0.35 * k2);
      op = q.peak * (1 - 0.1 * k2);
    } else {                                     // phase 3: linger-fade
      var k3 = (q.life - q.age) / q.fd;
      sc = q.size * (1.35 + 0.3 * (1 - k3));
      op = q.peak * 0.9 * k3;
    }
    q.sprite.position.set(q.x, q.y, q.z);
    q.sprite.scale.set(sc, sc, 1);
    q.mat.opacity = op;
  }
}

// ---- instant teardown for quit / endGame / level change ----
function resetFX() {
  if (fxPool) {
    for (var i = 0; i < FX_MAX_PUFFS; i++) {
      fxPool[i].active = false;
      fxPool[i].sprite.visible = false;
    }
  }
  fxEmitters.length = 0;
  fxBlindList.slice().forEach(function (be) { if (be.v) removeBlindCloud(be.v); });
  fxBlindList.length = 0;
  if (typeof humans === 'function') {
    humans().forEach(function (p) { p.shakeT = 0; p.shakeMag = 0; });
  }
  // pooled ground glows are owned by explosions[] entries; main.js
  // scene.remove()s them, which frees their pool slots automatically.
}

// ---- upgraded legacy effects (same signatures main.js already calls) ----
function addBlindCloud(v) {
  if (v.blindMesh) return;
  var g = new THREE.Group();
  for (var i = 0; i < 3; i++) {
    var s = new THREE.Sprite(fxBlindMat);       // shared material: no clones
    s.scale.set(0.55, 0.55, 1);
    g.add(s);
  }
  g.position.y = 2.4;
  v.mesh.add(g);
  v.blindMesh = g;
  fxBlindList.push({ v: v, group: g, t: Math.random() * 6 });
}
function removeBlindCloud(v) {
  if (v.blindMesh && v.mesh) {
    v.mesh.remove(v.blindMesh);
    for (var i = fxBlindList.length - 1; i >= 0; i--) {
      if (fxBlindList[i].group === v.blindMesh) fxBlindList.splice(i, 1);
    }
    v.blindMesh = null;
  }
}
function spawnStinkPuff(x, z) {
  // stink dome contract unchanged: pushes into domes[] so main.js fades it
  var c = tileCenter(x, z);
  var m = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8),
    new THREE.MeshLambertMaterial({ color: 0x8bc34a, transparent: true, opacity: 0.55, depthWrite: false }));
  m.position.set(c.x, 1, c.z);
  scene.add(m);
  domes.push({ mesh: m, timer: 1.2 });
  // plus a burst of fresh minty puffs from the pool
  for (var i = 0; i < 5; i++) {
    var q = fxAllocPuff();
    var tint = FX_MINT_TINTS[Math.floor(Math.random() * FX_MINT_TINTS.length)];
    fxConfigPuff(q, c.x + (Math.random() - 0.5) * 1.2, 0.5 + Math.random() * 0.9,
                 c.z + (Math.random() - 0.5) * 1.2, 0.7 + Math.random() * 0.5,
                 0.7, 0.55, tint);
    q.vx = (Math.random() - 0.5) * 1.2;
    q.vz = (Math.random() - 0.5) * 1.2;
    q.vy = 1.1 + Math.random() * 0.6;
  }
}
