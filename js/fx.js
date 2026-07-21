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
function addBlindCloud(v) {
  if (v.blindMesh) return;
  var m = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x6b8e23, transparent: true, opacity: 0.8 }));
  m.position.y = 2.4;
  v.mesh.add(m);
  v.blindMesh = m;
}
function removeBlindCloud(v) {
  if (v.blindMesh && v.mesh) { v.mesh.remove(v.blindMesh); v.blindMesh = null; }
}
function spawnStinkPuff(x, z) {
  var c = tileCenter(x, z);
  var m = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8),
    new THREE.MeshLambertMaterial({ color: 0x8bc34a, transparent: true, opacity: 0.55, depthWrite: false }));
  m.position.set(c.x, 1, c.z);
  scene.add(m);
  domes.push({ mesh: m, timer: 1.2 });
}
