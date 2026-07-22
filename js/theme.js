// ---------- themes: textures painted in code, no image files needed ----------
function canvasTex(draw) {
  var cnv = document.createElement('canvas');
  cnv.width = 128; cnv.height = 128;
  draw(cnv.getContext('2d'));
  return new THREE.CanvasTexture(cnv);
}

// THEME KEY CONTRACT (WS-C <-> WS-D): every theme MUST supply
//   sky (hex), trapWall {color, opacity},
//   wall (painter), floorA (painter), floorB (painter),
//   and either  crate (painter, box crates)
//           or  crateShape:'cylinder' + crateSide + crateCap (painters).
// OPTIONAL keys (bathroom-equivalent defaults applied when absent):
//   lightColor (0xffffff), lightIntensity (0.9)      -> `sun` directional in main.js
//   ambientColor (0xbbbbbb), ambientIntensity (0.75) -> only if a global `ambient`
//                                                       light exists (see HANDOFF-ws-themes.md)
//   fog {near:30, far:70, color:sky}                 -> scene.fog overrides
// applyTheme MUTATES the shared materials (matWall, matFloorA, matFloorB,
// matTempWall, matCrate) — never replaces them — because instanced meshes hold
// references to those exact objects. Replaced canvas textures are disposed.
// Theme names/flavor are provisional pending Otto's review — renaming is just
// an object key + THEME_ROTATION/BOSS_THEME edit, no logic changes.

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
  },

  // ---- Sewer Kingdom: mossy stone bricks, murky green air, goo barrels ----
  sewer: {
    sky: 0x4c6152,
    trapWall: { color: 0xa4f26a, opacity: 0.55 },   // glowing slime pane (bright vs dark stone)
    lightColor: 0xdcf0da, lightIntensity: 0.8,
    ambientColor: 0xa8b8a4, ambientIntensity: 0.7,
    fog: { near: 22, far: 55 },                     // murkier than the bathroom
    wall: function (c) {
      // mossy stone bricks with dark mortar
      c.fillStyle = '#39463c'; c.fillRect(0, 0, 128, 128);
      for (var row = 0; row < 4; row++) {
        var off = (row % 2) ? -32 : 0;
        for (var bx = 0; bx < 3; bx++) {
          c.fillStyle = (bx + row) % 2 ? '#68786b' : '#5d6d60';
          c.fillRect(bx * 64 + off + 3, row * 32 + 3, 58, 26);
        }
      }
      c.fillStyle = 'rgba(104,158,72,0.55)';        // moss patches
      for (var m = 0; m < 12; m++) {
        c.beginPath(); c.arc(Math.random() * 128, Math.random() * 128, 3 + Math.random() * 6, 0, 7); c.fill();
      }
      c.fillStyle = 'rgba(78,120,64,0.4)';          // slow green drips
      for (var d = 0; d < 5; d++) c.fillRect(Math.random() * 120, 0, 3, 20 + Math.random() * 45);
    },
    crateShape: 'cylinder',
    crateSide: function (c) {
      // wooden goo barrel: planks + two metal bands
      c.fillStyle = '#8a5a33'; c.fillRect(0, 0, 128, 128);
      for (var p = 0; p < 128; p += 16) {
        c.fillStyle = 'rgba(58,36,18,0.6)'; c.fillRect(p, 0, 2, 128);       // plank seams
        c.fillStyle = 'rgba(255,220,160,0.15)'; c.fillRect(p + 6, 0, 3, 128); // grain highlight
      }
      c.fillStyle = '#4c5257'; c.fillRect(0, 18, 128, 12); c.fillRect(0, 98, 128, 12); // iron bands
      c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(0, 20, 128, 3); c.fillRect(0, 100, 128, 3);
    },
    crateCap: function (c) {
      // barrel lid: plank circle, iron rim, a cheeky green goo puddle
      c.fillStyle = '#7c5030'; c.fillRect(0, 0, 128, 128);
      c.strokeStyle = 'rgba(50,30,15,0.7)'; c.lineWidth = 2;
      for (var p = 16; p < 128; p += 16) { c.beginPath(); c.moveTo(p, 0); c.lineTo(p, 128); c.stroke(); }
      c.beginPath(); c.arc(64, 64, 58, 0, 7);
      c.strokeStyle = '#4c5257'; c.lineWidth = 7; c.stroke();               // iron rim
      c.beginPath(); c.arc(64, 64, 20, 0, 7); c.fillStyle = '#79b04a'; c.fill(); // goo
      c.beginPath(); c.arc(57, 57, 7, 0, 7); c.fillStyle = '#9ccf6e'; c.fill();  // goo shine
    },
    floorA: function (c) {
      c.fillStyle = '#5c6a5f'; c.fillRect(0, 0, 128, 128);
      c.strokeStyle = '#414c44'; c.lineWidth = 6; c.strokeRect(0, 0, 128, 128);
      c.fillStyle = 'rgba(60,72,60,0.5)';
      for (var s = 0; s < 12; s++) c.fillRect(Math.random() * 120, Math.random() * 120, 6, 3);
    },
    floorB: function (c) {
      c.fillStyle = '#505d53'; c.fillRect(0, 0, 128, 128);
      c.strokeStyle = '#3b463e'; c.lineWidth = 6; c.strokeRect(0, 0, 128, 128);
      c.fillStyle = 'rgba(150,205,160,0.25)';       // wet shine flecks
      for (var s = 0; s < 10; s++) c.fillRect(Math.random() * 120, Math.random() * 120, 4, 4);
    }
  },

  // ---- Construction Site: caution stripes, plywood floors, porta-potty crates ----
  construction: {
    sky: 0xead9b0,                                  // dusty work-site haze
    trapWall: { color: 0xff9e40, opacity: 0.55 },   // translucent safety mesh (vs opaque yellow/black walls)
    lightColor: 0xfff1d0, lightIntensity: 0.95,
    ambientColor: 0xc4b89e, ambientIntensity: 0.75,
    wall: function (c) {
      // caution-stripe barrier with bolt heads
      c.fillStyle = '#f4c22e'; c.fillRect(0, 0, 128, 128);
      c.fillStyle = '#3a3a3a';
      for (var s = -128; s < 256; s += 40) {
        c.beginPath();
        c.moveTo(s, 0); c.lineTo(s + 18, 0); c.lineTo(s - 110, 128); c.lineTo(s - 128, 128);
        c.closePath(); c.fill();
      }
      c.fillStyle = '#8f8f8f';
      var bx = [10, 118, 10, 118], bz = [10, 10, 118, 118];
      for (var b = 0; b < 4; b++) { c.beginPath(); c.arc(bx[b], bz[b], 5, 0, 7); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,0.3)';
      for (var b2 = 0; b2 < 4; b2++) { c.beginPath(); c.arc(bx[b2] - 1, bz[b2] - 1, 2, 0, 7); c.fill(); }
    },
    crate: function (c) {
      // porta-potty blue plastic with a door and moon vent — Gassy Gus's office
      c.fillStyle = '#2f7bd0'; c.fillRect(0, 0, 128, 128);
      c.fillStyle = '#2465ad'; c.fillRect(8, 6, 112, 118);          // recessed panel
      c.strokeStyle = '#1b4c85'; c.lineWidth = 4; c.strokeRect(26, 22, 76, 100); // door
      c.fillStyle = '#e9eef4';
      for (var v = 0; v < 3; v++) c.fillRect(40, 34 + v * 8, 48, 3); // vent slats
      c.beginPath(); c.arc(64, 84, 12, 0, 7); c.fillStyle = '#e9eef4'; c.fill();  // the moon
      c.beginPath(); c.arc(69, 81, 10, 0, 7); c.fillStyle = '#2465ad'; c.fill();  // crescent cut
      c.fillStyle = '#1b4c85'; c.fillRect(92, 68, 6, 14);           // handle
    },
    floorA: function (c) {
      // plywood sheet
      c.fillStyle = '#cfa060'; c.fillRect(0, 0, 128, 128);
      c.strokeStyle = '#a87c42'; c.lineWidth = 6; c.strokeRect(0, 0, 128, 128);
      c.fillStyle = 'rgba(130,90,45,0.35)';
      for (var g = 0; g < 10; g++) c.fillRect(Math.random() * 100, Math.random() * 124, 20 + Math.random() * 24, 2);
    },
    floorB: function (c) {
      // OSB board: flaky chips
      c.fillStyle = '#bd8f52'; c.fillRect(0, 0, 128, 128);
      c.strokeStyle = '#97703a'; c.lineWidth = 6; c.strokeRect(0, 0, 128, 128);
      for (var f = 0; f < 22; f++) {
        c.fillStyle = (f % 2) ? 'rgba(220,180,120,0.5)' : 'rgba(140,100,55,0.4)';
        c.fillRect(Math.random() * 116, Math.random() * 116, 6 + Math.random() * 8, 3 + Math.random() * 4);
      }
    }
  },

  // ---- Royal Throne Room: marble + gold, red carpet, golden TP — Princess Poot's palace ----
  royal: {
    sky: 0xf3e6cd,
    trapWall: { color: 0xc79fe0, opacity: 0.55 },   // frosted royal-purple glass
    lightColor: 0xfff0c8, lightIntensity: 1.0,
    ambientColor: 0xd6c8ae, ambientIntensity: 0.8,
    wall: function (c) {
      // marble slab with veins, gold trim top and bottom
      c.fillStyle = '#f4efe6'; c.fillRect(0, 0, 128, 128);
      c.strokeStyle = 'rgba(165,155,145,0.5)'; c.lineWidth = 2;
      for (var v = 0; v < 4; v++) {
        c.beginPath();
        var vx = Math.random() * 128; c.moveTo(vx, 0);
        for (var y = 16; y <= 128; y += 16) { vx += (Math.random() - 0.5) * 24; c.lineTo(vx, y); }
        c.stroke();
      }
      c.fillStyle = '#d9a92c'; c.fillRect(0, 0, 128, 12); c.fillRect(0, 116, 128, 12);
      c.fillStyle = '#f6d76b'; c.fillRect(0, 3, 128, 3); c.fillRect(0, 119, 128, 3);
    },
    crateShape: 'cylinder',
    crateSide: function (c) {
      // the royal golden TP roll
      c.fillStyle = '#e9c34f'; c.fillRect(0, 0, 128, 128);
      c.fillStyle = 'rgba(255,240,180,0.6)'; c.fillRect(24, 0, 14, 128);   // shine stripe
      c.fillStyle = 'rgba(170,125,30,0.4)';
      for (var s = 0; s < 24; s++) c.fillRect(Math.random() * 128, Math.random() * 128, 3, 3);
      c.fillStyle = 'rgba(150,105,20,0.8)'; c.fillRect(88, 0, 4, 128);     // the seam
      c.fillStyle = 'rgba(255,245,200,0.8)'; c.fillRect(92, 0, 3, 128);
    },
    crateCap: function (c) {
      // wound gold rings, regal purple tube
      c.fillStyle = '#e9c34f'; c.fillRect(0, 0, 128, 128);
      c.strokeStyle = 'rgba(170,125,30,0.6)'; c.lineWidth = 1.5;
      for (var r = 62; r > 36; r -= 4) {
        c.beginPath(); c.arc(64, 64, r, 0, 7); c.stroke();
      }
      c.beginPath(); c.arc(64, 64, 34, 0, 7); c.fillStyle = '#b8912e'; c.fill();
      c.beginPath(); c.arc(64, 64, 27, 0, 7); c.fillStyle = '#6a4a8a'; c.fill(); // purple tube
      c.beginPath(); c.arc(64, 64, 18, 0, 7); c.fillStyle = '#453058'; c.fill();
    },
    floorA: function (c) {
      // red carpet tile with gold border and dot
      c.fillStyle = '#a3202a'; c.fillRect(0, 0, 128, 128);
      c.strokeStyle = '#d9a92c'; c.lineWidth = 8; c.strokeRect(4, 4, 120, 120);
      c.fillStyle = 'rgba(120,20,26,0.6)';
      for (var s = 0; s < 12; s++) c.fillRect(Math.random() * 112 + 8, Math.random() * 112 + 8, 4, 4);
      c.beginPath(); c.arc(64, 64, 7, 0, 7); c.fillStyle = '#d9a92c'; c.fill();
    },
    floorB: function (c) {
      // pale marble tile with a thin gold edge
      c.fillStyle = '#efe9dc'; c.fillRect(0, 0, 128, 128);
      c.strokeStyle = '#cbb98f'; c.lineWidth = 6; c.strokeRect(0, 0, 128, 128);
      c.strokeStyle = 'rgba(160,150,135,0.5)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(20, 10); c.lineTo(52, 60); c.lineTo(44, 110); c.stroke();
      c.beginPath(); c.moveTo(100, 16); c.lineTo(84, 70); c.stroke();
    }
  },

  // ---- Boss Arena: the haunted bathroom — dim porcelain, red accents (every 10th level) ----
  bossArena: {
    sky: 0x2e2831,
    trapWall: { color: 0x84e8e0, opacity: 0.55 },   // icy frosted pane — NOT red/orange, so it
                                                    // never reads as the boss's warning tiles
    lightColor: 0xffd8c8, lightIntensity: 0.6,
    ambientColor: 0x8a7f88, ambientIntensity: 0.6,
    fog: { near: 18, far: 48 },
    wall: function (c) {
      // dim porcelain tile, red-lit sheen, a creeping crack
      c.fillStyle = '#3a3f46'; c.fillRect(0, 0, 128, 128);
      for (var tx = 0; tx < 2; tx++) for (var tz = 0; tz < 2; tz++) {
        c.fillStyle = '#5c646d';
        c.fillRect(tx * 64 + 3, tz * 64 + 3, 58, 58);
        c.fillStyle = 'rgba(255,110,100,0.18)';
        c.fillRect(tx * 64 + 9, tz * 64 + 9, 20, 10);
      }
      c.strokeStyle = 'rgba(229,57,53,0.45)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(24, 0); c.lineTo(44, 44); c.lineTo(34, 78); c.stroke();
    },
    crateShape: 'cylinder',
    crateSide: function (c) {
      // dusty old TP that has seen things
      c.fillStyle = '#b7b0a4'; c.fillRect(0, 0, 128, 128);
      c.fillStyle = 'rgba(90,80,70,0.4)';
      for (var s = 0; s < 34; s++) c.fillRect(Math.random() * 128, Math.random() * 128, 4, 3);
      c.fillStyle = 'rgba(110,60,50,0.5)'; c.fillRect(88, 0, 4, 128);   // grim seam
      c.fillStyle = 'rgba(220,215,205,0.7)'; c.fillRect(92, 0, 3, 128);
    },
    crateCap: function (c) {
      c.fillStyle = '#b7b0a4'; c.fillRect(0, 0, 128, 128);
      c.strokeStyle = 'rgba(90,82,72,0.6)'; c.lineWidth = 1.5;
      for (var r = 62; r > 36; r -= 4) {
        c.beginPath(); c.arc(64, 64, r, 0, 7); c.stroke();
      }
      c.beginPath(); c.arc(64, 64, 34, 0, 7); c.fillStyle = '#6e5148'; c.fill(); // rusty rim
      c.beginPath(); c.arc(64, 64, 27, 0, 7); c.fillStyle = '#4a3630'; c.fill();
      c.beginPath(); c.arc(64, 64, 18, 0, 7); c.fillStyle = '#2c211d'; c.fill();
    },
    floorA: function (c) {
      c.fillStyle = '#454a52'; c.fillRect(0, 0, 128, 128);
      c.strokeStyle = '#31353c'; c.lineWidth = 6; c.strokeRect(0, 0, 128, 128);
      c.fillStyle = 'rgba(229,80,70,0.25)';
      for (var s = 0; s < 8; s++) c.fillRect(Math.random() * 120, Math.random() * 120, 5, 3);
    },
    floorB: function (c) {
      c.fillStyle = '#383d44'; c.fillRect(0, 0, 128, 128);
      c.strokeStyle = '#282c32'; c.lineWidth = 6; c.strokeRect(0, 0, 128, 128);
      c.fillStyle = 'rgba(200,200,210,0.15)';
      for (var s = 0; s < 8; s++) c.fillRect(Math.random() * 120, Math.random() * 120, 4, 4);
    }
  }
};

// ---- level -> theme rotation (rename-friendly: edit these two vars only) ----
var THEME_ROTATION = ['bathroom', 'sewer', 'construction', 'royal'];
var BOSS_THEME = 'bossArena';
function themeForLevel(level) {
  if (isBossLevel(level)) return BOSS_THEME;
  return THEME_ROTATION[(level - 1) % THEME_ROTATION.length];
}

// shared cylinder-crate materials: created once on first use, then only their
// .map is swapped — world.js crate meshes can safely hold references to them.
var themeCrateSideMat = null, themeCrateCapMat = null;

// repaint a shared material in place, disposing the texture it replaces
function setThemeTex(mat, painter) {
  var old = mat.map;
  mat.map = canvasTex(painter);
  mat.color.setHex(0xffffff);
  mat.needsUpdate = true;
  if (old && old.dispose) old.dispose();
}

function applyTheme(name) {
  var th = THEMES[name] || THEMES.bathroom;
  setThemeTex(matWall, th.wall);
  if (th.crateShape === 'cylinder') {
    if (!themeCrateSideMat) {
      themeCrateSideMat = new THREE.MeshLambertMaterial({});
      themeCrateCapMat  = new THREE.MeshLambertMaterial({});
    }
    setThemeTex(themeCrateSideMat, th.crateSide);
    setThemeTex(themeCrateCapMat, th.crateCap);
    crateGeoActive = rollGeo;
    crateMatActive = [themeCrateSideMat, themeCrateCapMat, themeCrateCapMat];   // side, top, bottom
  } else {
    setThemeTex(matCrate, th.crate);
    crateGeoActive = crateGeo;
    crateMatActive = matCrate;
  }
  setThemeTex(matFloorA, th.floorA);
  setThemeTex(matFloorB, th.floorB);
  matTempWall.transparent = true;
  matTempWall.opacity = th.trapWall.opacity;
  matTempWall.color.setHex(th.trapWall.color);
  matTempWall.needsUpdate = true;
  scene.background.setHex(th.sky);
  // fog: color follows the sky unless overridden; near/far default to bathroom's 30/70
  var fog = th.fog || {};
  scene.fog.color.setHex(fog.color !== undefined ? fog.color : th.sky);
  scene.fog.near = fog.near !== undefined ? fog.near : 30;
  scene.fog.far  = fog.far  !== undefined ? fog.far  : 70;
  // lights: optional per-theme keys with bathroom-equivalent defaults.
  // `sun` is main.js's directional light. The ambient light is anonymous today;
  // the `typeof` guard makes this a no-op until main.js exposes it as `ambient`
  // (proposed diff in HANDOFF-ws-themes.md).
  sun.color.setHex(th.lightColor !== undefined ? th.lightColor : 0xffffff);
  sun.intensity = th.lightIntensity !== undefined ? th.lightIntensity : 0.9;
  if (typeof ambient !== 'undefined' && ambient && ambient.isLight) {
    ambient.color.setHex(th.ambientColor !== undefined ? th.ambientColor : 0xbbbbbb);
    ambient.intensity = th.ambientIntensity !== undefined ? th.ambientIntensity : 0.75;
  }
}
