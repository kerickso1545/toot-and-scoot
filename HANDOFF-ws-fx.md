# HANDOFF — WS-A Fart Cloud FX Engine

Everything in `js/fx.js` is done, syntax-checked, and self-tested. This file
lists the EXACT changes the integrator must apply in `js/main.js` (and one
proposed toggle in `js/ui.js`). Old/new blocks are verbatim — match on the
code text, not line numbers. All changes are visual/feel only; the
`explosions[]` entry shape `{gx, gz, timer, mesh, owner}` and every timer
value are untouched, so bot AI danger maps, `explosionAt()`, kill checks, and
the boss special behave identically.

New globals provided by fx.js (loads before main.js, nothing executes against
main.js state at load time):

| Global | Purpose |
|---|---|
| `spawnFartCloud(gx, gz, opts)` | cluster of gas puffs at a tile; opts `{big, boss, color}` |
| `fxExplosionAt(tiles, opts)` | one call per blast: big cloud on `tiles[0]`, wisps on the arms, proximity camera shake for every human; opts `{boss, color}` |
| `fxGroundGlow(gx, gz, boss)` | pooled additive glow plane to use as the `explosions[]` entry mesh (replaces the flat green box) |
| `spawnDutchSwirl(wx, wz, dur)` | swirling puff emitter around the dutch-oven dome (world coords) |
| `spawnMiniPuff(wx, wz, color)` | tiny toot wisp (bean trail) |
| `updateFX(dt)` | advances all particles/emitters/blind clouds — call once per frame |
| `resetFX()` | instant FX teardown — call from `resetTransientUI()` |
| `addShake(p, mag)` / `getShakeOffset(p, dt)` | per-player shake state (stored as `p.shakeT`/`p.shakeMag`, decays in ≤0.2s) |
| `applyShake(cam, p, dt)` | convenience: adds `getShakeOffset` to a camera position |
| `fxShakeEnabled` | boolean flag for the Settings "Screen shake" toggle (default `true`) |

`addBlindCloud` / `removeBlindCloud` / `spawnStinkPuff` keep their exact
signatures and contracts (`spawnStinkPuff` still pushes `{mesh, timer: 1.2}`
into `domes[]`) — no caller changes needed for those.

---

## (a) `explode()` — spawn clouds per blast tile

The lethal entry keeps a mesh; it becomes a pooled ground-glow plane instead
of the flat box. The pool frees a glow when main.js `scene.remove()`s it in
the existing cleanup loop — no cleanup change needed. Note the boss's normal
bombs also get boss tinting via `b.owner.boss`.

OLD (in `explode(b)`):
```js
  tiles.forEach(function (t) {
    var c = tileCenter(t[0], t[1]);
    var m = new THREE.Mesh(boomGeo, matBoom);
    m.position.set(c.x, TS * 0.45, c.z);
    scene.add(m);
    explosions.push({ gx: t[0], gz: t[1], timer: 0.45, mesh: m, owner: b.owner });
```

NEW:
```js
  fxExplosionAt(tiles, { boss: !!(b.owner && b.owner.boss) });
  tiles.forEach(function (t) {
    var m = fxGroundGlow(t[0], t[1], b.owner && b.owner.boss);
    explosions.push({ gx: t[0], gz: t[1], timer: 0.45, mesh: m, owner: b.owner });
```
(The rest of the forEach — power-up burn-up loop, closing lines — unchanged.
`c` was only used for the mesh position, so its declaration goes away.)

## (b) Explosion update loop in `animate()` — remove the material reset

The old loop re-assigned `matBoom` every frame; the glow planes carry their
own pooled materials (pulsed centrally in `updateFX`), so that line must go.
Timer decrement and cleanup are UNCHANGED.

OLD:
```js
    // explosions
    for (var i = explosions.length - 1; i >= 0; i--) {
      explosions[i].timer -= dt;
      explosions[i].mesh.material = matBoom;
      if (explosions[i].timer <= 0) {
```

NEW:
```js
    // explosions
    for (var i = explosions.length - 1; i >= 0; i--) {
      explosions[i].timer -= dt;
      if (explosions[i].timer <= 0) {
```

After (a)+(b), `boomGeo` and `matBoom` in main.js become unused. Safe to
leave; delete if you prefer tidy (they have no other references).

## (c) `updateBossSpecial()` — boss cross detonation

OLD (inside the `bot.telegraph <= 0` branch):
```js
      var org = bot.warnOrigin || [bot.gx, bot.gz];
      bossCrossTiles(org[0], org[1]).forEach(function (t) {
        var x = t[0], z = t[1];
        if (grid[z][x] === 2) removeCrate(x, z);
        var c = tileCenter(x, z);
        var m = new THREE.Mesh(boomGeo, matBoom);
        m.position.set(c.x, TS * 0.45, c.z);
        scene.add(m);
        explosions.push({ gx: x, gz: z, timer: 0.5, mesh: m, owner: bot });
        var other = bombAt(x, z);
        if (other) explode(other);
      });
```

NEW:
```js
      var org = bot.warnOrigin || [bot.gx, bot.gz];
      var btiles = bossCrossTiles(org[0], org[1]);
      fxExplosionAt(btiles, { boss: true });
      btiles.forEach(function (t) {
        var x = t[0], z = t[1];
        if (grid[z][x] === 2) removeCrate(x, z);
        var m = fxGroundGlow(x, z, true);
        explosions.push({ gx: x, gz: z, timer: 0.5, mesh: m, owner: bot });
        var other = bombAt(x, z);
        if (other) explode(other);
      });
```
(timer stays 0.5; owner stays the boss; telegraph planes untouched.)

## (d) `dutchOven()` — swirling puffs around the dome

One line, right after the dome is pushed. The emitter self-expires with the
dome's 4.5s timer.

OLD:
```js
  scene.add(dm);
  domes.push({ mesh: dm, timer: 4.5 });
  return true;
```

NEW:
```js
  scene.add(dm);
  domes.push({ mesh: dm, timer: 4.5 });
  spawnDutchSwirl(c2.x, c2.z, 4.5);
  return true;
```

## (e) `resetTransientUI()` — FX teardown

Add `resetFX();` as the LAST statement of the function (after the bots
forEach). It releases every pooled puff, kills swirl emitters, strips any
remaining blind-cloud groups (idempotent with the `removeBlindCloud` calls
above it), and zeroes `shakeT`/`shakeMag` on all humans.

OLD:
```js
  if (bots) bots.forEach(function (b) {
    b.blindTime = 0;
    removeBlindCloud(b);
  });
}
```

NEW:
```js
  if (bots) bots.forEach(function (b) {
    b.blindTime = 0;
    removeBlindCloud(b);
  });
  resetFX();
}
```

## (f) Camera shake application — after `placeCam`

Recommended form: NO `placeCam` signature change. Apply the offset at the
three live-player call sites in `animate()` (shake is applied AFTER placeCam's
collision resolution and lookAt, magnitude ≤0.45 world units, well inside the
0.7 camera-collision margin). Spectators intentionally don't shake — their
`tmp` object never gets shake state, and no `applyShake` call is added there.

OLD / NEW (three edits):
```js
      placeCam(camera, player);
```
→
```js
      placeCam(camera, player); applyShake(camera, player, dt);
```
```js
        placeCam(camera2, player2);
```
→
```js
        placeCam(camera2, player2); applyShake(camera2, player2, dt);
```
```js
        placeCam(camera3, player3);
```
→
```js
        placeCam(camera3, player3); applyShake(camera3, player3, dt);
```

(Alternative if WS-D's `updateCameraFeel(p, dt)` lands: call
`applyShake(cam, p, dt)` at the end of that hook instead — same effect, one
call site. Coordinate whichever is cleaner post-merge.)

## (g) `animate()` — call `updateFX(dt)`

Place it INSIDE the `if (running && !menuOpen && (locked || pad))` block,
immediately after `updatePreviews();` — so pausing freezes gas clouds in
lockstep with the explosion timers that drive lethality (a cloud must never
fade while its blast is frozen-but-lethal).

OLD:
```js
    // targeting previews for held Trap Wall / Turbo Toot
    updatePreviews();
```

NEW:
```js
    // targeting previews for held Trap Wall / Turbo Toot
    updatePreviews();
    // fart-cloud particles, dutch-oven swirls, blind-cloud bobbing
    updateFX(dt);
```

## (h) Proposed Settings toggle — "Screen shake: On/Off" (ui.js, integrator wires)

`fxShakeEnabled` (fx.js global, default `true`) already gates the effect —
when false, `getShakeOffset` still decays timers but returns zero offset.
Follow the existing `camspeed` pattern exactly:

1. In the settings menu markup (where `cambtn` lives), add a sibling button:
   `<div class="mbtn" id="shakebtn" data-act="shake">Screen shake: On</div>`
2. In `renderMenu()`, next to the cambtn label line, add:
   `document.getElementById('shakebtn').textContent = 'Screen shake: ' + (fxShakeEnabled ? 'On' : 'Off');`
3. In `menuAction()`, next to `else if (act === 'camspeed')`, add:
   `else if (act === 'shake') { fxShakeEnabled = !fxShakeEnabled; renderMenu(); }`

No persistence, matching `soundOn`/`camSpeedIdx` (session-only settings).
Controller nav comes free from the existing `.mbtn` menu walker.

## Optional garnish (nice-to-have, one line)

Bean trail: a tiny wisp where each trail toot is laid. In the bean-power block
in `animate()`:

OLD:
```js
        if (!bombAt(p.trailTile.x, p.trailTile.z)) {
          placeBomb(p.trailTile.x, p.trailTile.z, 1, p, { fuse: 1.3, quiet: true });
        }
```
NEW:
```js
        if (!bombAt(p.trailTile.x, p.trailTile.z)) {
          placeBomb(p.trailTile.x, p.trailTile.z, 1, p, { fuse: 1.3, quiet: true });
          var fc = tileCenter(p.trailTile.x, p.trailTile.z);
          spawnMiniPuff(fc.x, fc.z);
        }
```

---

## Wanted but couldn't do from fx.js (integrator/human decisions)

- **Delete `boomGeo`/`matBoom`** from main.js once (a)-(c) land — they become
  dead code. fx.js cannot remove them.
- **Fart-drop puff**: a mini puff at `placeBomb()` when a bomb is laid (the
  toot itself) would be cute — needs a `spawnMiniPuff` call inside
  `placeBomb`, skipped when `opts.hidden` (S.B.D. must stay invisible!).
  Left out of the required set to keep the diff minimal.
- **Pause-frozen visuals**: with (g) placed inside the running-check, puffs
  freeze mid-air on pause. That's the correct/consistent choice, just noting
  it so nobody "fixes" it into a lethality/visual mismatch.
- **Playtest items for Kevin & Otto** (Claude cannot playtest): chain
  explosions still read clearly as one continuous blast; boss cross is
  legible under the purple clouds; shake feels fun not sickening in 3P split
  screen; blind-cloud puffs sit right on the new WS-B character heads (they
  attach at y=2.4 on the entity mesh, same as before); glow plane doesn't
  z-fight any theme's floor (sits at y=0.07, boss warn planes at 0.12).

## Verification done by WS-A

- `node --check js/fx.js` — clean.
- Stubbed-THREE self-test (pool of exactly 150; 40 chained 5-tile blasts
  never exceed cap, oldest stolen; all puffs expire; glow pool reuses freed
  meshes and re-tints boss→normal; shake reaches near players only, decays
  to zero ≤0.2s, toggle-off returns zero offset; blind cloud add/remove
  idempotent; `resetFX()` clears puffs+emitters+blind list+shake;
  `spawnStinkPuff` still pushes `{mesh, timer: 1.2}` into `domes[]`) — all
  passed.
