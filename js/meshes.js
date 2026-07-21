// ---------- entities ----------
// ---------- hats ----------
var HATMAP = {
  'The Big Stinker': 'crown',
  'Sir Toots-a-Lot': 'tophat',
  'Stinky Pete': 'cowboy2',
  'Windy Wendy': 'propeller',
  'Princess Poot': 'crown',
  'Gassy Gus': 'hardhat',
  'Captain Cheeks': 'captain'
};
function makeHat(type, group) {
  var y = 1.72;
  function lam(col) { return new THREE.MeshLambertMaterial({ color: col }); }
  if (type === 'cowboy' || type === 'cowboy2') {
    var col = type === 'cowboy' ? 0xc19a6b : 0x6d4c2f;
    var brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 16), lam(col));
    brim.position.y = y; group.add(brim);
    var top = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.33, 0.3, 14), lam(col));
    top.position.y = y + 0.17; group.add(top);
  } else if (type === 'tophat') {
    var b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 16), lam(0x263238));
    b2.position.y = y; group.add(b2);
    var t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 14), lam(0x263238));
    t2.position.y = y + 0.27; group.add(t2);
    var band = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.1, 14), lam(0xd32f2f));
    band.position.y = y + 0.08; group.add(band);
  } else if (type === 'party') {
    var cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.55, 12), lam(0xff5da2));
    cone.position.y = y + 0.26; group.add(cone);
    var pom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), lam(0xfff176));
    pom.position.y = y + 0.56; group.add(pom);
  } else if (type === 'cap') {
    var dome = new THREE.Mesh(new THREE.SphereGeometry(0.44, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lam(0xd32f2f));
    dome.position.y = y - 0.06; group.add(dome);
    var peak = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.32), lam(0xb71c1c));
    peak.position.set(0, y + 0.02, 0.46); group.add(peak);
  } else if (type === 'tproll') {
    var roll = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.32, 14), lam(0xfdfdf9));
    roll.position.y = y + 0.16; group.add(roll);
    var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 10), lam(0xc8b995));
    tube.position.y = y + 0.16; group.add(tube);
  } else if (type === 'crown') {
    var band2 = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 12), lam(0xffd700));
    band2.position.y = y + 0.09; group.add(band2);
    for (var i = 0; i < 4; i++) {
      var a = i / 4 * Math.PI * 2;
      var spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 6), lam(0xffd700));
      spike.position.set(Math.cos(a) * 0.28, y + 0.26, Math.sin(a) * 0.28);
      group.add(spike);
    }
  } else if (type === 'propeller') {
    var dome2 = new THREE.Mesh(new THREE.SphereGeometry(0.44, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lam(0x42a5f5));
    dome2.position.y = y - 0.06; group.add(dome2);
    var stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 6), lam(0x90a4ae));
    stick.position.y = y + 0.42; group.add(stick);
    var bl1 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.09), lam(0xef5350));
    bl1.position.y = y + 0.5; group.add(bl1);
    var bl2 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.04, 0.55), lam(0xffee58));
    bl2.position.y = y + 0.5; group.add(bl2);
  } else if (type === 'hardhat') {
    var dome3 = new THREE.Mesh(new THREE.SphereGeometry(0.46, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lam(0xfdd835));
    dome3.position.y = y - 0.04; group.add(dome3);
    var brim3 = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.04, 16), lam(0xfdd835));
    brim3.position.y = y - 0.02; group.add(brim3);
  } else if (type === 'captain') {
    var band3 = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.14, 14), lam(0x1a3a6b));
    band3.position.y = y + 0.05; group.add(band3);
    var top3 = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 14), lam(0xf5f5f5));
    top3.position.y = y + 0.17; group.add(top3);
    var peak3 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.26), lam(0x263238));
    peak3.position.set(0, y + 0.02, 0.42); group.add(peak3);
  }
}

// ---------- Characters 2.0: modular low-poly bodies ----------
// buildCharacter(color, opts) -> THREE.Group with origin at GROUND level.
// Same envelope as the old cylinder+sphere body (footprint radius ~0.5-0.6,
// head center y=1.35, hat base y=1.72) so cameras, collision framing, blind
// clouds (added to the group at y=2.4) and boss scaling all behave identically.
//
// Hierarchy (group transform is OWNED by main.js — position, rotation.y facing,
// and scale (boss 2.2x pulse) are never touched by the animation code):
//   group
//     rig            <- squash-and-stretch scale + knockout spin ONLY
//       footL, footR <- waddle steps (position only)
//       torsoNode    <- bob / waddle roll / lean (position.y, rotation, breath scale)
//         torso, armL/armR (mitt swing pivots), backAnchor
//         headNode   <- head, eyes, pupils, brows, blush, faceAnchor
//           hatAnchor (named, at top of head, world y=1.72)
//             hatMount (y=-1.72: cancels makeHat's built-in y~1.72 offset so
//                       UNCHANGED makeHat output lands exactly on the head)
//
// Anchors retrievable via group.getObjectByName('hatAnchor' | 'faceAnchor' |
// 'backAnchor') for future accessories (sunglasses, backpacks...).
//
// Material contract: ONE shared Lambert material colors torso+head+arms+feet.
//   group.userData.mat = that material  (main.js shimmer/mask/reset pattern:
//                        p.mesh.userData.mat.color.setHex/setHSL — unchanged)
//   group.bodyMats     = [that material] (array for future multi-mat tinting)
// Face features (eyes/pupils/brows/blush) are Basic materials, untinted —
// same as the old eyes. enrageBoss() traverses and clones per-mesh, so the
// boss red tint works on this hierarchy with no changes.
function buildCharacter(color, opts) {
  opts = opts || {};
  var group = new THREE.Group();
  var bodyMat = new THREE.MeshLambertMaterial({ color: color || 0x2979ff });
  var darkMat = new THREE.MeshBasicMaterial({ color: 0x263238 });
  var whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  var blushMat = new THREE.MeshBasicMaterial({ color: 0xff8a80 });

  var rig = new THREE.Group();
  rig.name = 'rig';
  group.add(rig);

  // stubby feet (flattened spheres), pivots at ground so steps slide/lift
  function makeFoot(sx) {
    var node = new THREE.Group();
    node.name = sx < 0 ? 'footL' : 'footR';
    node.position.set(sx * 0.2, 0.09, 0.06);
    var m = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), bodyMat);
    m.scale.set(1, 0.55, 1.25);
    node.add(m);
    rig.add(node);
    return node;
  }
  var footL = makeFoot(-1), footR = makeFoot(1);

  var torsoNode = new THREE.Group();
  torsoNode.name = 'torsoNode';
  rig.add(torsoNode);

  // chunky egg torso (rounder + friendlier than the old cylinder)
  var torso = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 12), bodyMat);
  torso.scale.set(1, 1.1, 0.9);
  torso.position.y = 0.62;
  torsoNode.add(torso);

  // mitt arms, pivoted at the shoulders so they can swing
  function makeArm(sx) {
    var node = new THREE.Group();
    node.name = sx < 0 ? 'armL' : 'armR';
    node.position.set(sx * 0.44, 0.92, 0);
    var m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), bodyMat);
    m.position.set(sx * 0.07, -0.26, 0);
    node.add(m);
    torsoNode.add(node);
    return node;
  }
  var armL = makeArm(-1), armR = makeArm(1);

  // big head (same center/radius as before so every hat still fits)
  var headNode = new THREE.Group();
  headNode.name = 'headNode';
  headNode.position.y = 1.35;
  torsoNode.add(headNode);
  var head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), bodyMat);
  headNode.add(head);

  // expressive face: big eyes + pupils + cheerful brows + blush cheeks
  function makeEyePair(sx) {
    var refs = {};
    refs.eye = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), whiteMat);
    refs.eye.position.set(sx * 0.16, 0.07, 0.37);
    headNode.add(refs.eye);
    refs.pup = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), darkMat);
    refs.pup.position.set(sx * 0.16, 0.08, 0.45);
    headNode.add(refs.pup);
    var brow = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.035, 0.04), darkMat);
    brow.position.set(sx * 0.16, 0.26, 0.36);
    brow.rotation.z = -sx * 0.12;
    headNode.add(brow);
    var blush = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), blushMat);
    blush.scale.set(1, 0.7, 0.4);
    blush.position.set(sx * 0.3, -0.06, 0.31);
    headNode.add(blush);
    return refs;
  }
  var eyeL = makeEyePair(-1), eyeR = makeEyePair(1);

  // named anchors
  var hatAnchor = new THREE.Group();
  hatAnchor.name = 'hatAnchor';
  hatAnchor.position.set(0, 0.37, 0);          // top of head (world y = 1.72)
  headNode.add(hatAnchor);
  var hatMount = new THREE.Group();
  hatMount.name = 'hatMount';
  hatMount.position.y = -1.72;                 // compensates makeHat's y offset
  hatAnchor.add(hatMount);
  var faceAnchor = new THREE.Group();
  faceAnchor.name = 'faceAnchor';
  faceAnchor.position.set(0, 0.02, 0.42);      // nose tip (world y ~= 1.37)
  headNode.add(faceAnchor);
  var backAnchor = new THREE.Group();
  backAnchor.name = 'backAnchor';
  backAnchor.position.set(0, 0.85, -0.48);     // small of the back
  torsoNode.add(backAnchor);

  group.userData.mat = bodyMat;
  group.bodyMats = [bodyMat];
  group.userData.rigRefs = {
    rig: rig, torsoNode: torsoNode, headNode: headNode,
    footL: footL, footR: footR, armL: armL, armR: armR,
    eyeL: eyeL.eye, eyeR: eyeR.eye, pupL: eyeL.pup, pupR: eyeR.pup,
    hatMount: hatMount, footY: 0.09, footZ: 0.06
  };
  group.userData.anim = {
    phase: Math.random() * Math.PI * 2,   // desync so characters don't march in step
    move: 0, lean: 0, glance: 0,
    lastX: null, lastZ: null, lastYaw: null,
    squashT: 0, spinT: 0,
    blinkT: 1.5 + Math.random() * 3
  };
  return group;
}

function makeBot(gx, gz, color, name) {
  var group = buildCharacter(color);
  makeHat(HATMAP[name], group.userData.rigRefs.hatMount);
  var c = tileCenter(gx, gz);
  group.position.set(c.x, 0, c.z);
  scene.add(group);
  return { gx: gx, gz: gz, tx: gx, tz: gz, moving: false, mesh: group, name: name,
    color: color, alive: true, speed: 3.4, maxBombs: 1, range: 2, timer: 0 };
}

function makePlayerMesh(color, hat) {
  var group = buildCharacter(color || 0x2979ff);
  makeHat(hat || playerHat, group.userData.rigRefs.hatMount);
  scene.add(group);
  return group;
}

// ---------- character animation (transform-only, zero gameplay effect) ----------
// charSquash(entity): 0.15s squash-and-stretch — call when a character farts
// (dropBombFor for humans, the botThink placeBomb path for bots; NOT the
// S.B.D. hidden bomb, which must stay silent AND invisible).
function charSquash(entity) {
  var g = entity && (entity.mesh || entity);
  if (g && g.userData && g.userData.anim) g.userData.anim.squashT = 0.15;
}
// charSpin(entity): optional 0.6s knockout spin-out. Only useful if the caller
// delays scene.remove(mesh) by ~650ms via later() — see HANDOFF-ws-characters.md.
function charSpin(entity) {
  var g = entity && (entity.mesh || entity);
  if (g && g.userData && g.userData.anim) g.userData.anim.spinT = 0.6;
}
// updateCharacterAnim(dt): call once per frame from animate(). Reads existing
// globals (running, humans(), bots) defensively; animates ONLY child nodes of
// each character's rig — never the group's position/rotation.y/scale, which
// main.js owns (movement, facing, boss 2.2x pulse).
function updateCharacterAnim(dt) {
  if (typeof running === 'undefined' || !running) return;
  if (!dt || dt <= 0) return;
  if (dt > 0.1) dt = 0.1;
  if (typeof humans === 'function') {
    humans().forEach(function (p) { animateCharacter(p, dt); });
  }
  if (typeof bots !== 'undefined' && bots && bots.forEach) {
    bots.forEach(function (b) { animateCharacter(b, dt); });
  }
}
function animateCharacter(ent, dt) {
  if (!ent || !ent.mesh) return;
  var g = ent.mesh;
  var ud = g.userData;
  if (!ud || !ud.anim || !ud.rigRefs) return;      // not a buildCharacter group
  var a = ud.anim, r = ud.rigRefs;
  if (!ent.alive && a.spinT <= 0) return;          // dead and not spin-outing
  if (!g.parent) return;                           // already removed from scene

  // actual movement speed from world position (humans sync mesh from x/z,
  // bots move the mesh directly — both covered, no gameplay fields touched)
  var spd = 0;
  if (a.lastX !== null) {
    spd = Math.sqrt((g.position.x - a.lastX) * (g.position.x - a.lastX) +
                    (g.position.z - a.lastZ) * (g.position.z - a.lastZ)) / dt;
  }
  a.lastX = g.position.x;
  a.lastZ = g.position.z;
  var moveTarget = Math.min(spd / 3.2, 1.25);
  a.move += (moveTarget - a.move) * Math.min(1, dt * 12);
  var mv = a.move;

  // turn rate (wrap-aware) -> sideways lean into turns
  var yaw = g.rotation.y, dy = 0;
  if (a.lastYaw !== null) {
    dy = yaw - a.lastYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
  }
  a.lastYaw = yaw;
  var leanTarget = mv > 0.05 ? Math.max(-0.3, Math.min(0.3, (dy / dt) * 0.06)) : 0;
  a.lean += (leanTarget - a.lean) * Math.min(1, dt * 10);

  // waddle phase advances with real speed
  if (mv > 0.03) a.phase += dt * (5 + 9 * mv);
  var s = Math.sin(a.phase), cs = Math.cos(a.phase);

  // feet alternate: slide fore/aft and lift
  r.footL.position.z = r.footZ + s * 0.16 * mv;
  r.footR.position.z = r.footZ - s * 0.16 * mv;
  r.footL.position.y = r.footY + Math.max(0, s) * 0.09 * mv;
  r.footR.position.y = r.footY + Math.max(0, -s) * 0.09 * mv;

  // mitt arms swing opposite the feet
  r.armL.rotation.x = -s * 0.7 * mv;
  r.armR.rotation.x = s * 0.7 * mv;

  // torso: bob, waddle roll, forward lean while running, idle breathing
  var breath = Math.sin(performance.now() / 450 + a.phase) * 0.02 * (1 - Math.min(mv, 1));
  r.torsoNode.position.y = Math.abs(cs) * 0.06 * mv;
  r.torsoNode.rotation.z = s * 0.1 * mv + a.lean;
  r.torsoNode.rotation.x = 0.1 * Math.min(mv, 1);
  r.torsoNode.scale.set(1 - breath * 0.5, 1 + breath, 1 - breath * 0.5);

  // head stays a bit more level than the torso; pupils glance into the turn
  r.headNode.rotation.z = -(s * 0.1 * mv + a.lean) * 0.5;
  var glanceTarget = Math.max(-0.05, Math.min(0.05, -a.lean * 0.3));
  a.glance += (glanceTarget - a.glance) * Math.min(1, dt * 8);
  r.pupL.position.x = -0.16 + a.glance;
  r.pupR.position.x = 0.16 + a.glance;

  // occasional blink
  a.blinkT -= dt;
  var blink = a.blinkT > 0 && a.blinkT < 0.1;
  if (a.blinkT <= 0) a.blinkT = 1.5 + Math.random() * 3.5;
  r.eyeL.scale.y = blink ? 0.12 : 1;
  r.eyeR.scale.y = blink ? 0.12 : 1;
  r.pupL.visible = !blink;
  r.pupR.visible = !blink;

  // fart squash-and-stretch: rig scales about the GROUND origin, so the
  // character scrunches downward; composes cleanly under the boss's
  // main.js-owned group.scale (relative child transform, no anchor drift)
  var sq = 0;
  if (a.squashT > 0) {
    a.squashT -= dt;
    if (a.squashT < 0) a.squashT = 0;
    sq = Math.sin((a.squashT / 0.15) * Math.PI);
  }
  r.rig.scale.set(1 + sq * 0.22, 1 - sq * 0.3, 1 + sq * 0.22);

  // optional knockout spin-out: two quick turns + a little hop, then reset
  if (a.spinT > 0) {
    a.spinT -= dt;
    if (a.spinT < 0) a.spinT = 0;
    var k = 1 - a.spinT / 0.6;
    r.rig.rotation.y = k * Math.PI * 4;
    r.rig.position.y = Math.sin(k * Math.PI) * 0.6;
    if (a.spinT === 0) { r.rig.rotation.y = 0; r.rig.position.y = 0; }
  }
}
