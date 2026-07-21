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
function findSpawn(tx, tz, used, minDist) {
  // scans EVERY open tile; minDist is the required spacing from already-used
  // spawns and can be relaxed (down to 0) when the maze is tight
  var best = null, bd = 1e9;
  for (var z = 1; z < ROWS - 1; z++) {
    for (var x = 1; x < COLS - 1; x++) {
      if (grid[z][x] === 1 || used[x + ',' + z]) continue;
      var tooClose = false;
      for (var k in used) {
        var p = k.split(',');
        if (Math.abs(p[0] - x) + Math.abs(p[1] - z) < minDist) { tooClose = true; break; }
      }
      if (tooClose) continue;
      var d = Math.abs(x - tx) + Math.abs(z - tz);
      if (d < bd) { bd = d; best = [x, z]; }
    }
  }
  return best;
}
var worldMeshes = [];
function buildWorld() {
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
  // guarantee enough unique spawns for every human + up to 6 bots on ANY maze
  // shape: preferred corner/edge targets first at the normal spacing, then
  // progressively relax the min-distance rule (3 -> 2 -> 1 -> 0); findSpawn
  // itself scans every remaining open tile, so if the arena has open floor
  // we will find it.
  levelSpawns = [];
  var used = {};
  var spawnTargets = [[1,1],[COLS-2,ROWS-2],[COLS-2,1],[1,ROWS-2],[7,1],[7,ROWS-2],[COLS-2,6],[1,6]];
  var spawnsNeeded = numPlayers + 6;
  var spacingPasses = [3, 2, 1, 0];
  for (var spi = 0; spi < spacingPasses.length && levelSpawns.length < spawnsNeeded; spi++) {
    for (var sti = 0; sti < spawnTargets.length && levelSpawns.length < spawnsNeeded; sti++) {
      var s = findSpawn(spawnTargets[sti][0], spawnTargets[sti][1], used, spacingPasses[spi]);
      if (s && !used[s[0] + ',' + s[1]]) {
        used[s[0] + ',' + s[1]] = true;
        levelSpawns.push(s);
      }
    }
  }
  // clear a safe pocket around every final spawn
  levelSpawns.forEach(function (s) {
    [[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(function (d) {
      var x = s[0] + d[0], z = s[1] + d[1];
      if (grid[z] && grid[z][x] === 2) grid[z][x] = 0;
    });
  });

  for (var z2 = 0; z2 < ROWS; z2++) {
    for (var x2 = 0; x2 < COLS; x2++) {
      var c = tileCenter(x2, z2);
      var f = new THREE.Mesh(new THREE.BoxGeometry(TS, 0.2, TS), (x2 + z2) % 2 ? matFloorA : matFloorB);
      f.position.set(c.x, -0.1, c.z);
      scene.add(f); worldMeshes.push(f);
      if (grid[z2][x2] === 1) {
        var w = new THREE.Mesh(boxGeo, matWall);
        w.position.set(c.x, TS / 2, c.z);
        scene.add(w); worldMeshes.push(w);
      } else if (grid[z2][x2] === 2) {
        var cr = new THREE.Mesh(crateGeoActive, crateMatActive);
        cr.position.set(c.x, TS * 0.47, c.z);
        scene.add(cr); worldMeshes.push(cr);
        crateMeshes[x2 + ',' + z2] = cr;
      }
    }
  }
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
