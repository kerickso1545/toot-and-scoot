# HANDOFF — WS-B Characters 2.0 (js/meshes.js)

Branch: `next-level`. Only `js/meshes.js` was changed (plus this file).
`node --check js/meshes.js` passes. Everything below is for the integrator
(WS-E) to apply in `js/main.js` — WS-B did not touch main.js.

## What changed in meshes.js

- `HATMAP` and `makeHat` are byte-identical to before. Do not merge-conflict them.
- New: `buildCharacter(color, opts)` — modular low-poly body (torso, big head,
  stubby feet, mitt arms, eyes/pupils/brows/blush) as a `THREE.Group` with
  origin at ground, footprint ~0.5-0.6 radius, head center y=1.35, hat base
  y=1.72 — the exact envelope of the old cylinder+sphere, so cameras,
  `collides()` framing, blind clouds (`v.mesh.add(m)` at y=2.4 in fx.js) and
  boss scaling are unaffected.
- Named anchors via `group.getObjectByName`: `hatAnchor` (top of head),
  `faceAnchor` (nose), `backAnchor` (small of back). Hats attach to an inner
  `hatMount` node at y=-1.72 that cancels `makeHat`'s built-in y~1.72 offset,
  so **makeHat output is attached unchanged**.
- `makeBot(gx, gz, color, name)` — same signature, returns the exact same
  entity object `{gx, gz, tx, tz, moving, mesh, name, color, alive, speed,
  maxBombs, range, timer}`. Only the visual construction changed.
- `makePlayerMesh(color, hat)` — same signature, still returns the group,
  still sets `group.userData.mat`, still falls back to global `playerHat`.
- New: `updateCharacterAnim(dt)`, `charSquash(entity)`, `charSpin(entity)`
  (all guard against missing globals; transform-only on child nodes; the
  group's `position` / `rotation.y` / `scale` remain 100% main.js-owned).

## Material compatibility — VERIFIED, no main.js changes required

Checked every material-mutation site in main.js:

- **Rainbow shimmer** (main.js ~1191-1195): `p.mesh.userData.mat.color.setHSL(...)`
  — preserved. `userData.mat` is the ONE Lambert material shared by torso,
  head, arms, and feet, so the whole body shimmers (better than before, when
  only body+head shared it... they used the same material then too — behavior
  identical).
- **Gas-mask gray** (main.js ~1199-1208) and **resetTransientUI** (main.js
  ~260-263): `p.mesh.userData.mat.color.setHex(0x37474f / p.baseColor)` —
  preserved, same single-material pattern.
- **enrageBoss** (main.js ~675-690): `bot.mesh.traverse(...)` clones every
  mesh's material and lerps toward red — hierarchy-agnostic, works unchanged
  on the new deeper hierarchy (tints face features too, exactly as it tinted
  the old eyes).
- **Boss scale** (main.js 203 `scale.set(2.2,...)` and ~1307-1309 per-frame
  `bot.mesh.scale.setScalar(bscale)` flinch/pulse): untouched — animation
  never writes group.scale; squash/spin live on the inner `rig` node, which
  composes multiplicatively under the boss scale with no anchor drift.
- Also exposed `group.bodyMats = [bodyMat]` (array) for any future
  multi-material tinting; today `bodyMats[0] === userData.mat`.

## Apply-list (exact diffs for the integrator)

### (a) animate(): drive the animation — REQUIRED

In `js/main.js`, immediately before the render section (currently line ~1529):

```js
  }

  if (twoPlayer && player3 && running) {
```
becomes
```js
  }

  updateCharacterAnim(dt);

  if (twoPlayer && player3 && running) {
```
(`updateCharacterAnim` self-guards on `running`, so an unconditional call at
the end of animate() — after all human/bot movement for the frame — is correct.
Do not place it before the movement code or the waddle will lag a frame.)

### (b) fart squash-and-stretch — REQUIRED

Human path, in `dropBombFor` (main.js ~282):
```js
  placeBomb(t.x, t.z, p.range, p);
```
becomes
```js
  placeBomb(t.x, t.z, p.range, p);
  charSquash(p);
```

Bot path, in `botThink` (main.js ~456):
```js
    placeBomb(bot.gx, bot.gz, bot.range, bot);
    return;
```
becomes
```js
    placeBomb(bot.gx, bot.gz, bot.range, bot);
    charSquash(bot);
    return;
```

Do **NOT** add `charSquash` to the S.B.D. hidden-bomb path (main.js ~646,
`placeBomb(..., { hidden: true })`) — a visible squash would telegraph the
Silent But Deadly. The bean-trail quiet bombs (~1186) and dutchOven (~617)
should also stay squash-free (they're not "the character farts right now"
moments; dutchOven is the *target* getting bombed).

### (c) material-access adjustments — NONE

See "Material compatibility" above: all existing shimmer/mask/enrage/reset
code works as-is.

### (d) OPTIONAL knockout spin-out

Today death is instant `scene.remove(mesh)` (bots main.js ~1351-1352, humans
~1376-1377, boss ~1343-1344). To get the spin, delay the removal via the
session-guarded `later()`:

Non-boss bot death (~1351):
```js
          bot.alive = false;
          scene.remove(bot.mesh);
```
becomes
```js
          bot.alive = false;
          charSpin(bot);
          (function (deadBot) { later(function () { scene.remove(deadBot.mesh); }, 650); })(bot);
```

Human death (~1376) equivalently:
```js
        p.alive = false;
        charSpin(p);
        (function (deadP) { later(function () { scene.remove(deadP.mesh); }, 650); })(p);
```

Safety notes if adopting: `updateCharacterAnim` keeps animating a dead entity
while `spinT > 0` (then stops); `later()` is bumpSession-guarded and
`startLevel` already scene.removes all player/bot meshes (~100-108), so a
level change mid-spin leaks nothing. The dead entity's tile is already
non-blocking (bots use `alive` checks everywhere), so the lingering mesh is
purely visual for 0.65s. Caveat for the HUMAN hook in 1P: death immediately
calls `endGame` (main.js 873-875), which sets `running = false` (freezing the
animation, so no spin plays) AND calls `bumpSession()` (cancelling the pending
`later()` removal — the frozen mesh then sits until the next `startLevel`
sweep at ~100-108; no leak, just pointless). Recommendation: gate the human
hook on `twoPlayer`, or apply the bot hook only.

### (e) Nothing else needed

No changes required in html/css/ui/world/fx/constants/theme. No new assets,
no load-order changes (meshes.js still declaration-only at load time; it
references `scene`, `tileCenter`, `playerHat`, `running`, `humans`, `bots`
only at call time, all defensively guarded in the per-frame path).

## Animation summary (for README/ARCHITECTURE updates later)

- Waddle: feet alternate + lift, arms counter-swing, torso bobs and rolls —
  all scaled by ACTUAL world-position speed (cached per-frame in
  `group.userData.anim`), so beans/turbo/sprint automatically waddle faster.
- Lean: torso banks into turns (wrap-aware yaw-rate), head counter-tilts,
  pupils glance into the turn; occasional blink; idle breathing when still.
- Squash: 0.15s scrunch-down/pop-out on fart (`charSquash`).
- Spin: optional 0.6s two-turn hop-out on knockout (`charSpin`).
- All state lives on `group.userData.anim`; all writes are absolute
  assignments to rig child nodes each frame (no drift, trivially cheap,
  no skeletons). Entity fields and `x/z`/facing logic are never touched.

## Human playtest checklist (Claude cannot playtest)

1. Title -> start 1P: player waddles when moving, breathes when idle, blinks.
2. All 6 rivals + hats look right; hats sit exactly where they used to.
3. Fart (Space/A): quick squash; S.B.D. shows NO squash.
4. Extra Life shimmer rainbows the whole body; gas mask grays it and restores.
5. Level 10 boss: 2.2x size, crown on top (no drift), flinch pulse, enrage
   red tint all still work; squash on his bombs looks right at 2.2x.
6. Blind cloud still floats above heads (players and bots).
7. 3P split-screen frame rate unchanged (animation is transforms only).
