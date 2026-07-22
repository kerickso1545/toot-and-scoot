function tileCenter(x, z) { return { x: x * TS + TS / 2, z: z * TS + TS / 2 }; }
function clearGroup(list) { list.forEach(function (m) { scene.remove(m); }); }
var currentMaze = MAZES[0];
var levelSpawns = [];

function insideShape(shape, x, z) {
  if (x <= 0 || z <= 0 || x >= COLS - 1 || z >= ROWS - 1) return false;
  var dx = Math.abs(x - 7), dz = Math.abs(z - 6);
  if (shape === 'octagon')  return dx + dz <= 8;
  if (shape === 'oval')     return 25 * dx * dx + 36 * dz * dz <= 950;
  if (shape === 'diamond')  return 5 * dx + 6 * dz <= 32;
  if (shape === 'triangle') return dx <= z * 0.62;
  return true;   // rect
}
function pillarAt(kind, x, z) {
  if (kind === 'none') return false;
  if (kind === 'grid') return x % 2 === 0 && z % 2 === 0;
  if (kind === 'dots') return x % 3 === 0 && z % 3 === 0;
  if (kind === 'diag') return (x + z) % 4 === 0 && x % 2 === 0;
  if (kind === 'ring') {
    var dx = Math.abs(x - 7), dz = Math.abs(z - 6);
    return ((dx === 4 && dz <= 3) || (dz === 3 && dx <= 4)) && (x + z) % 2 === 0;
  }
  return false;
}
function spawnEscape(x, z) {
  // A spawn must let you survive your own first toot: some neighbor N (not a
  // permanent wall) from which you can then step SIDEWAYS out of the blast
  // line — N's perpendicular neighbor also not a permanent wall. Crates don't
  // count as blockers here because buildWorld carves the chosen route clear
  // of crates. Returns the route [[nx,nz],[px,pz]] or null.
  var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (var i = 0; i < dirs.length; i++) {
    var nx = x + dirs[i][0], nz = z + dirs[i][1];
    if (nx < 1 || nz < 1 || nx > COLS - 2 || nz > ROWS - 2 || grid[nz][nx] === 1) continue;
    var perps = dirs[i][0] === 0 ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
    for (var j = 0; j < perps.length; j++) {
      var px = nx + perps[j][0], pz = nz + perps[j][1];
      if (px >= 1 && pz >= 1 && px <= COLS - 2 && pz <= ROWS - 2 && grid[pz][px] !== 1)
        return [[nx, nz], [px, pz]];
    }
  }
  return null;
}
function findSpawn(tx, tz, used, minDist, skipEscapeCheck, avoid, avoidDist) {
  // scans EVERY open tile; minDist is the required spacing from already-used
  // spawns and can be relaxed (down to 0) when the maze is tight.
  // Tiles without a survivable bomb-escape route (spawnEscape) are rejected
  // unless skipEscapeCheck is set (absolute last resort).
  // avoid/avoidDist: an extra keep-away list (used to hold bots clear of the
  // human spawns so nobody gets ambushed the instant the countdown ends).
  var best = null, bd = 1e9;
  for (var z = 1; z < ROWS - 1; z++) {
    for (var x = 1; x < COLS - 1; x++) {
      if (grid[z][x] === 1 || used[x + ',' + z]) continue;
      if (!skipEscapeCheck && !spawnEscape(x, z)) continue;
      var tooClose = false;
      for (var k in used) {
        var p = k.split(',');
        if (Math.abs(p[0] - x) + Math.abs(p[1] - z) < minDist) { tooClose = true; break; }
      }
      if (!tooClose && avoid) {
        for (var ai = 0; ai < avoid.length; ai++) {
          if (Math.abs(avoid[ai][0] - x) + Math.abs(avoid[ai][1] - z) < avoidDist) { tooClose = true; break; }
        }
      }
      if (tooClose) continue;
      var d = Math.abs(x - tx) + Math.abs(z - tz);
      if (d < bd) { bd = d; best = [x, z]; }
    }
  }
  return best;
}
var worldMeshes = [];
var floorTileGeo = null;   // shared floor-tile geometry, created once, reused every level
function buildWorld() {
  // free the previous level's instanced GPU buffers (instanceMatrix attribute).
  // Only the InstancedMesh itself is disposed — the geometries (shared
  // floorTileGeo / boxGeo) and the materials (shared matFloorA/matFloorB/
  // matWall, mutated in place by applyTheme) must NOT be disposed.
  worldMeshes.forEach(function (m) { if (m.isInstancedMesh) m.dispose(); });
  clearGroup(worldMeshes); worldMeshes = [];
  crateMeshes = {};
  currentMaze = (level % 10 === 0)
    ? { name: 'Boss arena', shape: 'rect', pillars: 'dots', crate: 0.4 }
    : MAZES[(level - 1) % MAZES.length];
  grid = [];
  for (var z = 0; z < ROWS; z++) {
    grid[z] = [];
    for (var x = 0; x < COLS; x++) {
      if (!insideShape(currentMaze.shape, x, z)) grid[z][x] = 1;
      else if (pillarAt(currentMaze.pillars, x, z)) grid[z][x] = 1;
      else grid[z][x] = Math.random() < currentMaze.crate ? 2 : 0;
    }
  }
  // connectivity guarantee: every walkable tile must reach every other one.
  // flood-fill regions of non-wall tiles; any pocket cut off from the biggest
  // region gets sealed into solid wall, so nobody can ever spawn or get stuck there.
  var seen = {}, regions = [];
  for (var fz = 1; fz < ROWS - 1; fz++) {
    for (var fx = 1; fx < COLS - 1; fx++) {
      if (grid[fz][fx] === 1 || seen[fx + ',' + fz]) continue;
      var region = [], queue = [[fx, fz]];
      seen[fx + ',' + fz] = true;
      while (queue.length) {
        var cur = queue.pop();
        region.push(cur);
        [[1,0],[-1,0],[0,1],[0,-1]].forEach(function (d) {
          var nx = cur[0] + d[0], nz = cur[1] + d[1];
          if (nx <= 0 || nz <= 0 || nx >= COLS - 1 || nz >= ROWS - 1) return;
          var k = nx + ',' + nz;
          if (!seen[k] && grid[nz][nx] !== 1) {
            seen[k] = true;
            queue.push([nx, nz]);
          }
        });
      }
      regions.push(region);
    }
  }
  regions.sort(function (a, b) { return b.length - a.length; });
  for (var ri = 1; ri < regions.length; ri++) {
    regions[ri].forEach(function (t) { grid[t[1]][t[0]] = 1; });
  }
  // find safe spawn pockets (corners may not exist in a circle or triangle).
  // TWO-PHASE selection so the humans always come first:
  //   Phase 1 — humans. An escape route (spawnEscape) is NON-NEGOTIABLE, and
  //   humans claim the best spacing (4 apart, relaxing only if the maze is
  //   genuinely tight) before any bot takes a tile.
  //   Phase 2 — bots. Besides spacing among themselves, bots must stay at
  //   least botGap tiles (Manhattan) from EVERY human spawn — no more getting
  //   tooted by a neighbor the instant the countdown ends. The gap relaxes
  //   pass by pass only when the arena runs out of room, and an escape-less
  //   tile is taken dead last (better a doomed bot than a missing one — 1P
  //   level-clear needs at least one rival).
  levelSpawns = [];
  var used = {};
  var spawnTargets = [[1,1],[COLS-2,ROWS-2],[COLS-2,1],[1,ROWS-2],[7,1],[7,ROWS-2],[COLS-2,6],[1,6]];
  var humanSpawns = [];
  var humanPasses = [4, 3, 2, 1, 0];
  for (var hp = 0; hp < humanPasses.length && humanSpawns.length < numPlayers; hp++) {
    for (var hti = 0; hti < spawnTargets.length && humanSpawns.length < numPlayers; hti++) {
      var hs = findSpawn(spawnTargets[hti][0], spawnTargets[hti][1], used, humanPasses[hp]);
      if (hs && !used[hs[0] + ',' + hs[1]]) {
        used[hs[0] + ',' + hs[1]] = true;
        humanSpawns.push(hs);
      }
    }
  }
  // extreme fallback for humans (no escape-valid tile anywhere — shouldn't
  // happen on any current maze): distinct open tiles still beat stacking
  for (var hf = 0; hf < humanPasses.length && humanSpawns.length < numPlayers; hf++) {
    for (var hfi = 0; hfi < spawnTargets.length && humanSpawns.length < numPlayers; hfi++) {
      var hx = findSpawn(spawnTargets[hfi][0], spawnTargets[hfi][1], used, humanPasses[hf], true);
      if (hx && !used[hx[0] + ',' + hx[1]]) {
        used[hx[0] + ',' + hx[1]] = true;
        humanSpawns.push(hx);
      }
    }
  }
  var botSpawns = [];
  var botsNeeded = 6;
  // [spacing among bots, min gap from any human] — relaxed in order
  var botPasses = [[3, 5], [2, 4], [2, 3], [1, 3], [1, 2], [0, 2]];
  for (var bp = 0; bp < botPasses.length && botSpawns.length < botsNeeded; bp++) {
    for (var bti = 0; bti < spawnTargets.length && botSpawns.length < botsNeeded; bti++) {
      var bs = findSpawn(spawnTargets[bti][0], spawnTargets[bti][1], used, botPasses[bp][0], false, humanSpawns, botPasses[bp][1]);
      if (bs && !used[bs[0] + ',' + bs[1]]) {
        used[bs[0] + ',' + bs[1]] = true;
        botSpawns.push(bs);
      }
    }
  }
  // absolute last resort for bots: escape-less tiles, human gap shrinking to 0
  var botLastPasses = [[0, 2], [0, 1], [0, 0]];
  for (var bl = 0; bl < botLastPasses.length && botSpawns.length < botsNeeded; bl++) {
    for (var bli = 0; bli < spawnTargets.length && botSpawns.length < botsNeeded; bli++) {
      var b2 = findSpawn(spawnTargets[bli][0], spawnTargets[bli][1], used, botLastPasses[bl][0], true, humanSpawns, botLastPasses[bl][1]);
      if (b2 && !used[b2[0] + ',' + b2[1]]) {
        used[b2[0] + ',' + b2[1]] = true;
        botSpawns.push(b2);
      }
    }
  }
  levelSpawns = humanSpawns.concat(botSpawns);
  // clear a safe pocket around every final spawn, and carve the crates off
  // the bomb-escape route so the first toot is always survivable
  levelSpawns.forEach(function (s) {
    [[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(function (d) {
      var x = s[0] + d[0], z = s[1] + d[1];
      if (grid[z] && grid[z][x] === 2) grid[z][x] = 0;
    });
    var esc = spawnEscape(s[0], s[1]);
    if (esc) esc.forEach(function (t) {
      if (grid[t[1]] && grid[t[1]][t[0]] === 2) grid[t[1]][t[0]] = 0;
    });
  });

  // ---- render meshes ----
  // Floor tiles and permanent walls (grid type 1) are static for the whole
  // level, so they render as three THREE.InstancedMesh (checker floor A,
  // checker floor B, walls): 3 draw calls instead of ~270+ individual meshes.
  // CRITICAL: the instanced meshes hold the SAME shared material objects
  // (matFloorA / matFloorB / matWall) that applyTheme() mutates in place —
  // theme swaps re-skin the instanced world for free. Never clone or replace
  // those materials here. Crates (type 2) stay individual meshes: they are
  // removed one at a time (removeCrate) and use the per-theme
  // crateGeoActive/crateMatActive. Trap walls (type 3) are placed at runtime
  // by placeWall() in main.js and are not built here.
  // (r128 InstancedMesh sets frustumCulled=false in its constructor, so the
  // single-tile geometry bounds can never wrongly cull the whole arena.)
  if (!floorTileGeo) floorTileGeo = new THREE.BoxGeometry(TS, 0.2, TS);
  var floorACount = 0, floorBCount = 0, wallCount = 0;
  for (var zc = 0; zc < ROWS; zc++) {
    for (var xc = 0; xc < COLS; xc++) {
      if ((xc + zc) % 2) floorACount++; else floorBCount++;
      if (grid[zc][xc] === 1) wallCount++;
    }
  }
  var instFloorA = new THREE.InstancedMesh(floorTileGeo, matFloorA, floorACount);
  var instFloorB = new THREE.InstancedMesh(floorTileGeo, matFloorB, floorBCount);
  var instWall = new THREE.InstancedMesh(boxGeo, matWall, wallCount);
  var m4 = new THREE.Matrix4();
  var ai = 0, bi = 0, wi = 0;
  for (var z2 = 0; z2 < ROWS; z2++) {
    for (var x2 = 0; x2 < COLS; x2++) {
      var c = tileCenter(x2, z2);
      m4.makeTranslation(c.x, -0.1, c.z);
      if ((x2 + z2) % 2) instFloorA.setMatrixAt(ai++, m4);
      else instFloorB.setMatrixAt(bi++, m4);
      if (grid[z2][x2] === 1) {
        m4.makeTranslation(c.x, TS / 2, c.z);
        instWall.setMatrixAt(wi++, m4);
      } else if (grid[z2][x2] === 2) {
        var cr = new THREE.Mesh(crateGeoActive, crateMatActive);
        cr.position.set(c.x, TS * 0.47, c.z);
        scene.add(cr); worldMeshes.push(cr);
        crateMeshes[x2 + ',' + z2] = cr;
      }
    }
  }
  instFloorA.instanceMatrix.needsUpdate = true;
  instFloorB.instanceMatrix.needsUpdate = true;
  instWall.instanceMatrix.needsUpdate = true;
  scene.add(instFloorA); worldMeshes.push(instFloorA);
  scene.add(instFloorB); worldMeshes.push(instFloorB);
  scene.add(instWall); worldMeshes.push(instWall);
}

function removeCrate(x, z) {
  grid[z][x] = 0;
  var k = x + ',' + z;
  if (crateMeshes[k]) { scene.remove(crateMeshes[k]); delete crateMeshes[k]; }
}
function tileOf(p) { return { x: Math.floor(p.x / TS), z: Math.floor(p.z / TS) }; }
function solidForPlayer(x, z) {
  if (x < 0 || z < 0 || x >= COLS || z >= ROWS) return true;
  if (grid[z][x] !== 0) return true;
  return false;
}
function collides(px, pz, ignore) {
  var r = 0.5;
  var minX = Math.floor((px - r) / TS), maxX = Math.floor((px + r) / TS);
  var minZ = Math.floor((pz - r) / TS), maxZ = Math.floor((pz + r) / TS);
  for (var x = minX; x <= maxX; x++)
    for (var z = minZ; z <= maxZ; z++)
      if (solidForPlayer(x, z) && !(ignore && ignore[x + ',' + z])) return true;
  return false;
}

function overlappingSolids(px, pz) {
  // tiles the player is ALREADY inside — you're allowed to walk back out of these
  var out = {};
  var r = 0.5;
  var minX = Math.floor((px - r) / TS), maxX = Math.floor((px + r) / TS);
  var minZ = Math.floor((pz - r) / TS), maxZ = Math.floor((pz + r) / TS);
  for (var x = minX; x <= maxX; x++)
    for (var z = minZ; z <= maxZ; z++)
      if (solidForPlayer(x, z)) out[x + ',' + z] = true;
  return out;
}
