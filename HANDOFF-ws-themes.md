# HANDOFF — WS-C Per-Level Theme Packs

Branch: `next-level` · Owned file changed: `js/theme.js` only · `node --check js/theme.js` passes.

## What shipped in js/theme.js

- Four new `THEMES` entries alongside untouched `bathroom`:
  - `sewer` — Sewer Kingdom: mossy stone bricks, murky green sky/fog, wooden goo-barrel crates (cylinder).
  - `construction` — Construction Site: yellow/black caution-stripe walls, plywood + OSB floors, porta-potty blue box crates (Gassy Gus's turf).
  - `royal` — Royal Throne Room: veined marble walls with gold trim, red-carpet + marble floors, golden TP-roll crates with a purple tube (Princess Poot's palace).
  - `bossArena` — haunted-bathroom variant: dim porcelain with red-lit sheen and cracks, dark floors, dusty TP rolls, dark sky, tighter fog, dimmer warm light.
- `themeForLevel(level)` (global): L1 bathroom, then sewer → construction → royal → bathroom rotating (`(level-1) % 4`), every 10th level `bossArena`. Rotation data lives in `THEME_ROTATION` / `BOSS_THEME` vars — renames for Otto are a one-line edit.
- `applyTheme` still MUTATES the shared material objects (`matWall`, `matFloorA`, `matFloorB`, `matTempWall`, `matCrate`) — never replaces them — so WS-D's instanced meshes can hold references safely. Cylinder crate materials are now two persistent module-level materials (`themeCrateSideMat` / `themeCrateCapMat`) that get repainted, not recreated per call. Every replaced canvas texture is disposed (`old.map.dispose()`), fixing the pre-existing per-swap leak.
- New OPTIONAL theme keys, defaulting to bathroom-equivalent values when absent: `lightColor` (0xffffff) / `lightIntensity` (0.9) wired to the `sun` directional light (a reachable global — no main.js change needed); `ambientColor` (0xbbbbbb) / `ambientIntensity` (0.75) wired behind a `typeof ambient !== 'undefined'` guard (no-op until diff (b) below lands); `fog {near, far, color}` (30 / 70 / sky).

## (a) REQUIRED integrator diff — startLevel in js/main.js

Theme must be applied BEFORE `buildWorld()` so walls/floors/crates are built with the right materials and `crateGeoActive`/`crateMatActive`. In `startLevel` (~line 110):

```diff
   twoPlayer = numPlayers >= 2;
   setAspects();
+  applyTheme(themeForLevel(level));
   buildWorld();
```

Notes:
- Verify `level` is already set/incremented before each `startLevel(...)` call site (the two level-advance calls around main.js:1403/1420 and `startGame`). It is today; just confirm nothing reorders.
- The load-time `applyTheme('bathroom')` at main.js:43 stays as-is (it must run before the initial `buildWorld()`; `themeForLevel(1)` === 'bathroom' anyway).

## (b) OPTIONAL integrator diff — expose the ambient light

The ambient light is currently anonymous, so per-theme ambient tinting is dormant. To enable it, in js/main.js (~line 26):

```diff
-scene.add(new THREE.AmbientLight(0xbbbbbb, 0.75));
+var ambient = new THREE.AmbientLight(0xbbbbbb, 0.75);
+scene.add(ambient);
```

`applyTheme` detects it via `typeof` guard — safe to land before, after, or never. Recommended: without it, `sewer`/`bossArena` still work (sun + fog + sky carry the mood) but are a bit less atmospheric.

## (c) Minimap readability

The minimap (main.js ~1429-1463) draws with FIXED colors that ignore the theme entirely: wall `#7986cb`, crate `#efe8d8`, trap wall `#66bb6a`, bombs `#558b2f`, power-ups `#ffd54f`/`#a1662f`, players/bots by entity color. Because it never samples theme palettes, readability is unchanged in every new theme — no tweaks required. (Optional future polish, NOT proposed now: a per-theme `minimap` color key; skipping to avoid touching main.js hot loop.)

## (d) Other notes for the integrator / WS-D

- **Instancing contract**: WS-D's instanced floor/wall meshes must reference the `matWall`/`matFloorA`/`matFloorB` objects themselves; `applyTheme` only swaps `.map`, sets `.color`, flips `needsUpdate`. Instanced meshes retheme automatically on level change with zero rebuild.
- **Crates**: still individual meshes built from `crateGeoActive`/`crateMatActive` in `buildWorld` (world.js:129). With diff (a) applied before `buildWorld`, each level's crates get the right shape (cylinder for bathroom/sewer/royal/bossArena, box for construction) and materials. The persistent cylinder materials also mean any crate mesh alive across an `applyTheme` call repaints in place.
- **Trap-wall readability per theme** (frosted-pane look kept everywhere; all translucent at 0.55-0.6 vs fully opaque walls): bathroom mint 0x8fd8c0 · sewer glowing slime 0xa4f26a vs dark stone · construction safety-orange 0xff9e40 vs opaque yellow/black stripes · royal frosted purple 0xc79fe0 vs white marble · bossArena icy cyan 0x84e8e0 — deliberately NOT red/orange so it can never be confused with the boss's 0xff7043 telegraph tiles or the theme's red accents.
- `applyTheme` falls back to bathroom for unknown names (defensive; `themeForLevel` only returns valid names — self-tested).
- **Docs after merge** (WS-E final pass): README "per-level themes" blurb, ARCHITECTURE.md Theme bullet (rotation + optional light/fog keys), activitylog entry. Theme NAMES ARE PROVISIONAL pending Otto — rename via THEMES key + `THEME_ROTATION`/`BOSS_THEME`.
- **Human playtest checklist additions**: play levels 1-5 and level 10 (or temp-set `level`) to eyeball each theme; confirm trap wall obviously different from permanent walls in each; confirm construction crates are boxes and explode/score as usual (10 pts — unchanged, crates are still grid type 2); confirm boss telegraph tiles still read clearly on the dark bossArena floor.

## Verification done (Claude cannot playtest)

- `node --check js/theme.js` — clean.
- Throwaway stubbed-canvas node test (in /tmp, not committed): all 5 themes key-complete per contract; every painter runs using only supported 2D-context members; shared material objects verified never replaced across all theme swaps; old textures disposed; cylinder/box geo+mat swap correct; cylinder materials reused (identity-stable) across themes; `themeForLevel` verified for levels 1-11, 20, 30; rotation names all exist in `THEMES`. 86/86 assertions passed.
