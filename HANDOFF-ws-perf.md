# HANDOFF — WS-D (Performance + Camera Feel)

Author: WS-D agent, 2026-07-21, branch `next-level`.
What already landed in my own file: `js/world.js` — InstancedMesh floor +
permanent walls (details in "What changed in world.js" below). Everything in
this document is the part I could NOT do myself: `js/main.js` is
integrator-owned, so the camera-feel work ships here as an exact diff.

---

## 1. Sprint-state finding (documented as requested)

"Is p sprinting?" lives only as a LOCAL variable inside `controlHuman`
(js/main.js line ~937):

```js
var sprinting = wantSprint && moving && !p.exhausted;
```

where `wantSprint` = Shift (keyboard) or L3/LT (`pd.buttons[10]` /
`pd.buttons[6]`), `moving` = any stick/WASD input, and `p.exhausted` is the
stamina-floor latch (stamina hit 0, stays exhausted until it refills to 30).
It is exactly the condition that drains stamina (`p.stamina -= 10*dt`) and
applies the ×1.6 speed. It is NOT stored on the player object, so the FOV
kick needs one line added to persist it (diff 2b below).

## 2. Camera approach (read before applying)

**Position smoothing — smooth the RESOLVED position, then re-march.**
The existing collision pipeline is untouched: camLift search → `camRayHit`
on the ACTUAL final ray → `camDist` snap-in/smooth-out. Only the final
resolved point `(p.x+dx*cd, 1.2+dy*cd, p.z+dz*cd)` is lerped into a
persistent `p.camPos` with a frame-rate-independent factor
`1 - Math.pow(0.002, dt)` (~0.11 s half-life at any FPS). Because a lerped
point can trail into a wall for a few frames right after a snap-in, a safety
clamp re-marches the head→smoothed ray with the same `camRayHit` and snaps
`camPos` onto the hit point if anything solid is in between. Net guarantee:
the camera can never be inside a wall, not even for one frame, while normal
orbit/movement motion gets the smoothing.

- `camLift` behavior: unchanged (it feeds the resolved point; smoothing just
  trails it and the clamp keeps it legal).
- Aim accuracy: unchanged — `aimDir` reads `p.yaw` (raw input) and
  `cam.lookAt(p.x, 1.1, p.z)` still targets the unsmoothed player position.
  Only the camera EYE position is smoothed.
- Spectate: `spectate()` builds a fresh `tmp` object each frame with no
  `camPos`, so positional smoothing self-disables there (initializes to the
  resolved point every frame = exactly today's behavior). Per the plan,
  spectate is excluded. `cameraTop` (3P bird's-eye) never goes through
  `placeCam` — untouched.

**FOV kick — +5° while sprinting** (plan allows ≤6°), smoothed in/out with
`1 - Math.pow(0.001, dt)` (~0.1 s half-life). Per-player `p.fovCur`, applied
to that player's own viewport camera inside `placeCam`.
`updateProjectionMatrix()` is only called when the fov actually changes by
more than 0.01 — once the value settles (base or base+kick) it costs nothing.
Spectate carries `fovCur` through the tmp object only so a sprint-kicked fov
eases back to 70 instead of popping when a player is knocked out; `sprinting`
is never set on the tmp, so spectating can't trigger the kick.

## 3. The diffs (js/main.js)

### 3a. New constants — insert immediately ABOVE `function camBlockedAt` (~line 955)

```js
var FOV_BASE = 70, FOV_SPRINT_KICK = 5;   // sprint widens FOV by 5° (subtle; plan cap 6°)
```

(All three player cameras are constructed with fov 70 at the top of main.js;
`cameraTop` is 60 and is never passed to `placeCam`.)

### 3b. controlHuman — persist the sprint state (one line)

OLD (line ~937):
```js
  var sprinting = wantSprint && moving && !p.exhausted;
```
NEW:
```js
  var sprinting = wantSprint && moving && !p.exhausted;
  p.sprinting = sprinting;   // read by placeCam for the sprint FOV kick
```

### 3c. placeCam — full function replacement

OLD (current on `next-level`, includes the fc33a25 camLift fix — lines ~970-995):
```js
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
```

NEW (everything above `var cd = p.camDist;` is byte-identical except the
signature; only the tail changes):
```js
function placeCam(cam, p, dt) {
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
  // position smoothing: lerp only the RESOLVED (already collision-marched)
  // point, frame-rate independent (same half-life at any FPS).
  var rpx = p.x + dx * cd, rpy = 1.2 + dy * cd, rpz = p.z + dz * cd;
  if (!p.camPos) p.camPos = { x: rpx, y: rpy, z: rpz };
  var sm = 1 - Math.pow(0.002, dt || 0.016);                     // ~0.11s half-life
  p.camPos.x += (rpx - p.camPos.x) * sm;
  p.camPos.y += (rpy - p.camPos.y) * sm;
  p.camPos.z += (rpz - p.camPos.z) * sm;
  // safety clamp: a lerped point can trail into a wall right after a snap-in,
  // so re-march the actual head->smoothed ray and snap onto any hit. The
  // camera can never sit inside a wall, not even for one frame.
  var ox = p.camPos.x - p.x, oy = p.camPos.y - 1.25, oz = p.camPos.z - p.z;
  var olen = Math.sqrt(ox * ox + oy * oy + oz * oz);
  if (olen > 0.001) {
    var hit = camRayHit(p, ox / olen, oy / olen, oz / olen, olen);
    if (hit < olen) {
      p.camPos.x = p.x + ox / olen * hit;
      p.camPos.y = 1.25 + oy / olen * hit;
      p.camPos.z = p.z + oz / olen * hit;
    }
  }
  cam.position.set(p.camPos.x, p.camPos.y, p.camPos.z);
  cam.lookAt(p.x, 1.1, p.z);
  // sprint FOV kick: +FOV_SPRINT_KICK° while sprinting, smoothed both ways.
  // updateProjectionMatrix only when the fov really changed (>0.01) — free at rest.
  if (p.fovCur === undefined) p.fovCur = FOV_BASE;
  var fovTarget = FOV_BASE + (p.sprinting ? FOV_SPRINT_KICK : 0);
  p.fovCur += (fovTarget - p.fovCur) * (1 - Math.pow(0.001, dt || 0.016));
  if (Math.abs(cam.fov - p.fovCur) > 0.01) {
    cam.fov = p.fovCur;
    cam.updateProjectionMatrix();
  }
}
```

(Note: the clamp measures from y=1.25 because that is `camRayHit`'s march
origin; the 0.05 offset vs the 1.2 eye base is within the march's 0.3
sampling step and matches how the pre-existing code mixes the two.)

### 3d. Call sites — pass dt (4 places)

In `animate()` (~lines 1121/1128/1136):
```js
placeCam(camera, player);      ->  placeCam(camera, player, dt);
placeCam(camera2, player2);    ->  placeCam(camera2, player2, dt);
placeCam(camera3, player3);    ->  placeCam(camera3, player3, dt);
```

In `spectate()` (~lines 1027-1030) — pass dt and carry `fovCur` (NOT
`sprinting`, NOT `camPos`) through the tmp object:
```js
OLD:
  var tmp = { x: pos.x, z: pos.z, yaw: p.yaw, pitch: p.pitch, camDist: p.camDist, camLift: p.camLift };
  placeCam(cam, tmp);
  p.camDist = tmp.camDist;
  p.camLift = tmp.camLift;
NEW:
  var tmp = { x: pos.x, z: pos.z, yaw: p.yaw, pitch: p.pitch, camDist: p.camDist, camLift: p.camLift, fovCur: p.fovCur };
  placeCam(cam, tmp, dt);
  p.camDist = tmp.camDist;
  p.camLift = tmp.camLift;
  p.fovCur = tmp.fovCur;
```

### Integrator apply-list (in order)

1. 3a — add `FOV_BASE`/`FOV_SPRINT_KICK` vars above `camBlockedAt`.
2. 3b — one line in `controlHuman` after the `var sprinting = ...` line.
3. 3c — replace `placeCam` wholesale (tail-only change; head must stay
   byte-identical to preserve the fc33a25 camLift fix).
4. 3d — four call-site edits (3 in `animate`, 1 in `spectate`).
5. `node --check js/main.js`.
6. Human playtest items: sprint in/out repeatedly (FOV eases, no pop), orbit
   against walls (no clip, camLift still rides over), die while sprinting and
   spectate (fov returns to 70 smoothly), 3P split screen.

No changes needed to `resetTransientUI`, `startLevel`, or player creation:
players are rebuilt per level, so `camPos`/`fovCur` reset naturally; the
`dt || 0.016` guards make the function safe if ever called without dt.

---

## 4. What changed in js/world.js (already committed-ready in my file)

`buildWorld()` now renders floor tiles and permanent walls (grid type 1) as
three `THREE.InstancedMesh`:

- `instFloorA` (matFloorA, 97 instances) + `instFloorB` (matFloorB, 98) —
  the 15×13 checker floor, split per material exactly as before.
- `instWall` (matWall, count = number of type-1 tiles that level).
- They hold the SAME shared material objects `matFloorA`/`matFloorB`/
  `matWall` — verified against WS-C's current `applyTheme` (js/theme.js
  `setThemeTex`), which mutates those materials in place and even documents
  the instancing contract at the top of the file. Theme swaps re-skin the
  instanced world for free. Materials are never cloned, replaced, or disposed
  by world.js.
- Geometry: walls reuse the existing shared `boxGeo` (main.js); floors use a
  new module-cached `floorTileGeo`, created once and reused every level.
  Bonus leak fix: the old code created a fresh `new THREE.BoxGeometry` PER
  FLOOR TILE per level (195 geometries every `startLevel`, never disposed).
- Rebuild path: at the top of `buildWorld`, previous InstancedMeshes get
  `.dispose()` (frees the per-instance `instanceMatrix` GPU attribute — the
  r128-supported teardown; WebGLObjects listens for the dispose event), then
  the existing `clearGroup(worldMeshes)` removes them from the scene. Shared
  geometries and materials are intentionally NOT disposed.
- Crates (type 2) remain individual meshes in `crateMeshes` (removed one at a
  time by `removeCrate`); trap walls (type 3) remain `placeWall`-owned
  individual meshes in main.js. Both unchanged.
- r128 API check: `InstancedMesh(geo, mat, count)`, `setMatrixAt`,
  `instanceMatrix.needsUpdate`, `.dispose()`, `isInstancedMesh` all verified
  against the r128 source; the r128 constructor sets `frustumCulled = false`
  itself, so the single-tile geometry bounds can never wrongly cull the
  arena.

### Mesh-reference audit (does anything look up per-tile floor/wall meshes?)

Grepped all of `js/` for `worldMeshes`, `Raycaster`/`raycast`/`intersect`,
`scene.remove`, and per-tile mesh maps:

- `worldMeshes` is referenced ONLY inside world.js (build + clear). No other
  file iterates or indexes it.
- There is NO raycasting anywhere in the codebase (zero `THREE.Raycaster`
  usage) — camera collision is the `camBlockedAt` grid march, movement
  collision is `collides()` grid math. Instancing is purely render-side.
- Per-tile mesh lookups exist only for crates (`crateMeshes[x+','+z]`,
  world.js `removeCrate`) and trap walls (`walls[]` entries own their mesh,
  main.js placeWall/expiry ~lines 558/612/1223) — both stay individual.
- `resetTransientUI`/cleanup (main.js ~100-108) removes bombs/explosions/
  powerups/bots/players/walls/domes meshes — never floor/permanent-wall
  meshes.

Conclusion: nothing referenced the individual floor/wall meshes; no
adaptations were needed outside world.js.

### Draw-call math (static world geometry, per render)

Before: 195 floor meshes (97 A + 98 B) + permanent walls as individual
meshes — 82 on Classic (52 border ring + 30 grid pillars), ~106 on Circle,
more on shaped mazes with sealed pockets. Typical: **~277-300 draw calls**
for the static world alone, times 4 renders/frame in 3P (**~1,100-1,200**).

After: **3 draw calls** (floorA + floorB + walls), times 4 in 3P = **12**.
Crates (~60-90 at level start, shrinking as they pop) and dynamic entities
are unchanged in both columns.

Verification aid for the integrator: log `renderer.info.render.calls` once
per second in `animate()` on a throwaway line, before/after merging this
branch, on the Classic maze in 1P and 3P.

### Cross-stream note (WS-C)

`js/theme.js` on this branch already targets the instancing contract
("applyTheme MUTATES the shared materials … because instanced meshes hold
references to those exact objects"). No coordination action needed; just
merge in the planned C → D order and the instanced world re-themes
correctly. WS-C's optional `fog`/light keys don't touch world.js.
