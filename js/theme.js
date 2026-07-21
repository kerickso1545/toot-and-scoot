// ---------- themes: textures painted in code, no image files needed ----------
function canvasTex(draw) {
  var cnv = document.createElement('canvas');
  cnv.width = 128; cnv.height = 128;
  draw(cnv.getContext('2d'));
  return new THREE.CanvasTexture(cnv);
}

var THEMES = {
  bathroom: {
    sky: 0xd7ecf2,
    trapWall: { color: 0x8fd8c0, opacity: 0.6 },   // frosted shower glass
    wall: function (c) {
      // porcelain tile with grout
      c.fillStyle = '#b8c6cc'; c.fillRect(0, 0, 128, 128);
      for (var tx = 0; tx < 2; tx++) for (var tz = 0; tz < 2; tz++) {
        c.fillStyle = '#f4f8fa';
        c.fillRect(tx * 64 + 3, tz * 64 + 3, 58, 58);
        c.fillStyle = 'rgba(255,255,255,0.85)';
        c.fillRect(tx * 64 + 9, tz * 64 + 9, 20, 10);
      }
    },
    crateShape: 'cylinder',
    crateSide: function (c) {
      // smooth white paper around the roll, with one loose-end seam
      c.fillStyle = '#fbfaf4'; c.fillRect(0, 0, 128, 128);
      c.fillStyle = 'rgba(210,205,190,0.35)';
      for (var s = 0; s < 30; s++) c.fillRect(Math.random() * 128, Math.random() * 128, 3, 3);
      c.fillStyle = 'rgba(175,170,155,0.7)';
      c.fillRect(88, 0, 4, 128);                          // the paper seam
      c.fillStyle = 'rgba(255,255,255,0.8)';
      c.fillRect(92, 0, 3, 128);
    },
    crateCap: function (c) {
      // wound paper rings with a big dark cardboard tube in the middle
      c.fillStyle = '#fbfaf4'; c.fillRect(0, 0, 128, 128);
      c.strokeStyle = 'rgba(200,195,178,0.6)'; c.lineWidth = 1.5;
      for (var r = 62; r > 36; r -= 4) {
        c.beginPath(); c.arc(64, 64, r, 0, 7); c.stroke();
      }
      c.beginPath(); c.arc(64, 64, 34, 0, 7);
      c.fillStyle = '#b09a72'; c.fill();                  // cardboard rim
      c.beginPath(); c.arc(64, 64, 27, 0, 7);
      c.fillStyle = '#6b6152'; c.fill();                  // dark tube
      c.beginPath(); c.arc(64, 64, 18, 0, 7);
      c.fillStyle = '#453e33'; c.fill();                  // deep shadow inside
    },
    floorA: function (c) {
      c.fillStyle = '#eef3f5'; c.fillRect(0, 0, 128, 128);
      c.strokeStyle = '#b8c6cc'; c.lineWidth = 6; c.strokeRect(0, 0, 128, 128);
      c.fillStyle = 'rgba(180,200,210,0.35)';
      for (var s = 0; s < 14; s++) c.fillRect(Math.random() * 120, Math.random() * 120, 4, 4);
    },
    floorB: function (c) {
      c.fillStyle = '#d3e4ec'; c.fillRect(0, 0, 128, 128);
      c.strokeStyle = '#aec4cf'; c.lineWidth = 6; c.strokeRect(0, 0, 128, 128);
      c.fillStyle = 'rgba(255,255,255,0.4)';
      for (var s = 0; s < 10; s++) c.fillRect(Math.random() * 120, Math.random() * 120, 4, 4);
    }
  }
};

function applyTheme(name) {
  var th = THEMES[name];
  matWall.map = canvasTex(th.wall);     matWall.color.setHex(0xffffff);   matWall.needsUpdate = true;
  if (th.crateShape === 'cylinder') {
    var sideMat = new THREE.MeshLambertMaterial({ map: canvasTex(th.crateSide) });
    var capMat  = new THREE.MeshLambertMaterial({ map: canvasTex(th.crateCap) });
    crateGeoActive = rollGeo;
    crateMatActive = [sideMat, capMat, capMat];   // side, top, bottom
  } else {
    matCrate.map = canvasTex(th.crate);
    matCrate.color.setHex(0xffffff);
    matCrate.needsUpdate = true;
    crateGeoActive = crateGeo;
    crateMatActive = matCrate;
  }
  matFloorA.map = canvasTex(th.floorA); matFloorA.color.setHex(0xffffff); matFloorA.needsUpdate = true;
  matFloorB.map = canvasTex(th.floorB); matFloorB.color.setHex(0xffffff); matFloorB.needsUpdate = true;
  matTempWall.transparent = true;
  matTempWall.opacity = th.trapWall.opacity;
  matTempWall.color.setHex(th.trapWall.color);
  matTempWall.needsUpdate = true;
  scene.background.setHex(th.sky);
  scene.fog.color.setHex(th.sky);
}
