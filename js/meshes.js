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

function makeBot(gx, gz, color, name) {
  var group = new THREE.Group();
  var body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.1, 12), new THREE.MeshLambertMaterial({ color: color }));
  body.position.y = 0.55;
  group.add(body);
  var head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), new THREE.MeshLambertMaterial({ color: color }));
  head.position.y = 1.35;
  group.add(head);
  var eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  var pupMat = new THREE.MeshBasicMaterial({ color: 0x263238 });
  [-0.16, 0.16].forEach(function (ex) {
    var e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), eyeMat);
    e.position.set(ex, 1.42, 0.36); group.add(e);
    var p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), pupMat);
    p.position.set(ex, 1.42, 0.44); group.add(p);
  });
  makeHat(HATMAP[name], group);
  var c = tileCenter(gx, gz);
  group.position.set(c.x, 0, c.z);
  scene.add(group);
  return { gx: gx, gz: gz, tx: gx, tz: gz, moving: false, mesh: group, name: name,
    color: color, alive: true, speed: 3.4, maxBombs: 1, range: 2, timer: 0 };
}

function makePlayerMesh(color, hat) {
  var group = new THREE.Group();
  var blue = new THREE.MeshLambertMaterial({ color: color || 0x2979ff });
  var body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.1, 12), blue);
  body.position.y = 0.55; group.add(body);
  var head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), blue);
  head.position.y = 1.35; group.add(head);
  var eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  var pupMat = new THREE.MeshBasicMaterial({ color: 0x263238 });
  [-0.16, 0.16].forEach(function (ex) {
    var e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), eyeMat);
    e.position.set(ex, 1.42, 0.36); group.add(e);
    var p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), pupMat);
    p.position.set(ex, 1.42, 0.44); group.add(p);
  });
  makeHat(hat || playerHat, group);
  group.userData.mat = blue;
  scene.add(group);
  return group;
}
