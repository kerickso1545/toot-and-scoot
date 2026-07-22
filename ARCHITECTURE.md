# Toot and Scoot — Architecture

Plain multi-file layout, no build step. `toot-and-scoot.html` is the shell
(markup + ordered `<script src>` tags); `css/style.css` holds all CSS; the game
JS (ES5 style) is split into classic scripts that share ONE global scope — NOT
ES modules, no import/export. Three.js r128 from cdnjs is the only external
dependency. Load order is `constants → theme → audio → meshes → world → fx →
ui → main`; files before `main.js` contain only declarations (plus simple `var`
initializers), and ALL load-time side effects (scene/renderer setup, event
listener registration, `applyTheme('bathroom')`, `buildWorld()`, `animate()`
kickoff) live at the bottom of `js/main.js`, loaded last. Function declarations
hoist within a file but not across files — keep it that way.

- `js/constants.js` — balance constants, `PU_NAME`/`PU_COLOR`, `FARTS`, `MAZES`
- `js/theme.js` — `THEMES` (5 packs), `canvasTex`, `applyTheme`,
  `themeForLevel` + `THEME_ROTATION`/`BOSS_THEME`
- `js/audio.js` — `fart()`, `snd()`, `ownerProfile`, `actx`
- `js/meshes.js` — `HATMAP`, `makeHat`, `buildCharacter` (rig + anchors),
  `makeBot`, `makePlayerMesh`, `updateCharacterAnim`, `charSquash`, `charSpin`
- `js/world.js` — `buildWorld` (instanced floor/walls), `insideShape`,
  `pillarAt`, `findSpawn`, `tileCenter`, `tileOf`, `collides`,
  `overlappingSolids`, `removeCrate`
- `js/fx.js` — fart-cloud particle pool (`fxExplosionAt`, `fxGroundGlow`,
  `spawnFartCloud`, `spawnDutchSwirl`, `spawnMiniPuff`, `updateFX`,
  `resetFX`), camera shake (`addShake`/`applyShake`, `fxShakeEnabled`),
  aim-preview visuals (`updatePreviews`, `clearPreview`), blind clouds,
  `spawnStinkPuff`
- `js/ui.js` — title menu + navigation, rules, initials/leaderboard,
  pause/settings menus, pad status, `showLevelMsg`/`showPMsg`, HUD html helpers
- `js/main.js` — everything else: state globals, lifecycle, bombs/explosions,
  bot AI, boss, abilities, input, cameras, `animate()` loop

## The 30-second mental model

Bomberman-style rules on a 15×13 tile grid, rendered in 3D with third-person
cameras. `grid[z][x]` holds tile types: `0` floor, `1` permanent wall,
`2` crate (TP roll, destructible), `3` temporary trap wall. Entities (humans,
bots, bombs, power-ups) live in world coordinates; `tileOf(p)` maps to grid.
Everything runs in one `animate()` requestAnimationFrame loop: gamepad polling →
per-human control/camera → timers (bombs, walls, domes, effects) → bot AI →
kill/win checks → HUD → render (1-3 viewports via scissor).

## HTML/UI elements (ids)

- `overlay` — title/setup screen: `scoreboard`, `diffbtns` containing
  `modebtns` (1/2/3P), `colorbtns`, `hatbtns`, `startbtns` (Easy/Med/Hard =
  start), `rulesrow` (How to play), `padstatus` (controller readiness)
- `rulespanel` — separate scrollable How-to-play page
- `pausemenu` / `settingsmenu` (`pausemsg` for controller-disconnect notices)
- `initials` — 3-letter high-score entry
- HUD (`hudroot`): `hudTL`, `hudTR`, `hudP3` panels, `hudGame` (multiplayer
  game tile: level/difficulty/rivals — top-center in 2P, bottom-right over
  the bird's-eye quadrant in 3P; positioned by startLevel), `slots` (A/X item
  boxes, 1P only), `hudBL` chips (1P), `stambar`, `bossbar`, `minimap` canvas,
  `levelmsg` banner, `maskoverlay` (goggles SVG), `blind0-2` (STINKED covers),
  `pmsg0-2` (per-player contextual messages)

HUD panels swap innerHTML between 1P template (ids `hLevel`, `hDiff`, `hScore`,
`hRivals`) and multiplayer `twoPHudHtml()` strings — 1P ids only exist in 1P.
Multiplayer player tiles mirror the 1P panel structure (hlabel / hbig score /
hsub lines); game info never lives inside a player tile.

## Core state (globals)

- World: `grid`, `crateMeshes`, `bombs`, `explosions`, `powerups`, `walls`
  (temp trap walls), `domes` (visual effects), `bots`, `levelSpawns`
- Players: `player`, `player2`, `player3` (null when unused); `humans()`
  returns the active list. Per-player fields: `x,z`, `yaw,pitch` (camera),
  `speed,maxBombs,range`, `held` (active item), `score,wins,lives`,
  `superType,superUsed,maskTime`, `beansTime,reviveTime,blindTime`,
  `stamina,exhausted`, `camDist` (camera collision), `suppress` +
  `prevBomb/prevUse/prevMask` (button edges), `spec/specName` (spectating)
- Session: `running`, `gameOver`, `level`, `difficulty`, `numPlayers`,
  `twoPlayer` (means "multiplayer", true for 2P AND 3P), `transitioning`,
  `gameSession` + `pendingTimeouts` (see Safety rails)
- UI state: `menuOpen`, `rulesOpen`, `initialsActive`, `locked` (pointer lock),
  `padAssign` (controller-index assignment per match)

## Key systems and their functions

- **Lifecycle**: `startGame(retry)` → `startLevel(keepStats)` (rebuilds world +
  players; `carryStats()` persists score/wins/lives), `endGame(text)`,
  `menuAction('quit')`. Transitions between levels use `later()` timeouts.
  `endGame` snapshots `retryLevel` (results "Retry" resumes there) and sets
  `resultsPending` for 600ms — the pad Start path checks it so a Start press
  can't race the results/initials panel and eat a high score.
- **Safety rails**: `later(fn, ms)` + `bumpSession()` (session-ID-guarded
  timeouts, cleared on start/quit/end); `canStartGame()` (single gate for ALL
  start paths incl. pointerlockchange); `resetTransientUI()` (clears every
  overlay/banner/preview/effect).
- **Maze**: `MAZES` (6 shapes cycling by level; boss arena on `isBossLevel`
  levels), `insideShape`, `pillarAt`, `buildWorld()` (gen + flood-fill
  connectivity guarantee — isolated pockets get sealed). Spawn selection is
  TWO-PHASE: humans first (escape route via `spawnEscape` non-negotiable,
  spacing 4 relaxing to 0), then bots with a keep-away gap from every human
  spawn (5 relaxing to 2; escape-less tiles only as the dead-last bot
  fallback). `findSpawn(tx, tz, used, minDist, skipEscapeCheck, avoid,
  avoidDist)` scans every open tile. `spawnFacing` (main.js) orients each
  player's yaw + body toward their escape route at spawn. Floor tiles + permanent walls render as
  3 `InstancedMesh` (render-only — `grid[z][x]` stays the collision/AI truth;
  ~277-300 static draw calls → 3 per view). Crates and trap walls stay
  individual meshes.
- **Theme**: `THEMES` (bathroom, sewer, construction, royal, bossArena) +
  `applyTheme()` — canvas-painted textures (crate shape/material via
  `crateGeoActive`/`crateMatActive`). `themeForLevel(level)` rotates themes
  per level (L1 bathroom, bossArena on isBossLevel levels; rotation in `THEME_ROTATION`).
  `startLevel` calls `applyTheme(themeForLevel(level))` BEFORE `buildWorld()`.
  CONTRACT: `applyTheme` MUTATES the shared materials (`matWall`,
  `matFloorA/B`, `matTempWall`, `matCrate`) in place — never replaces them —
  so the instanced world meshes re-theme for free. Old canvas textures are
  disposed on swap. Optional per-theme keys (light/ambient/fog) default to
  bathroom values; ambient tinting uses the `ambient` global in main.js.
- **FX pool + shake** (`js/fx.js`): explosions are pooled additive gas-puff
  sprites (~150 cap, 3-phase burst/billow/linger) + pooled ground-glow planes
  that serve as the `explosions[]` entry meshes — lethality is still 100%
  `explosions[].timer` on exact tiles; clouds are cosmetic. `updateFX(dt)`
  runs inside the running-check in `animate()` (pause freezes clouds with
  lethality); `resetFX()` is the last call in `resetTransientUI()`.
  Proximity camera shake per human (`applyShake` after each `placeCam`;
  spectators never shake), gated by the Settings "Screen shake" toggle
  (`fxShakeEnabled`, session-only like `soundOn`).
- **Characters**: `buildCharacter(color)` builds a modular low-poly rig
  (torso/head/feet/arms/eyes) with named anchors (`hatAnchor`, `faceAnchor`,
  `backAnchor`); hats mount unchanged via an inner `hatMount`. One shared
  body material at `group.userData.mat` (+ `group.bodyMats`) keeps the
  shimmer/mask/enrage mutations working. `updateCharacterAnim(dt)` (end of
  `animate()`, after movement) drives waddle/lean/blink/idle-breathing from
  actual world-position speed; `charSquash` on fart (never on S.B.D.),
  `charSpin` on knockout (bots always; humans only in multiplayer — removal
  delayed 650ms via `later()`). Animation is transform-only on rig children;
  the group's position/rotation.y/scale stay main.js-owned (boss 2.2× scale
  composes safely).
- **Bombs/blasts**: `dropBombFor`, `placeBomb(gx,gz,range,owner,opts)`
  (opts: `fuse`, `hidden` (S.B.D.), `quiet`/`trail` (bean trail)), `explode`
  (cross blast, punches through crates, stops at walls 1/3, drops power-ups,
  scores crates to `owner.score`). CHAIN RULES (both explode() and the boss
  special): a blast never detonates a same-owner bomb (Extra Gas double-toots
  keep their own fuses) and never detonates `b.trail` bombs; different-owner
  non-trail bombs chain. `explosions[]` entries carry `owner` for kill
  attribution.
- **Power-ups**: `spawnPowerup` (2% rainbow Extra Life, 10% beans, else
  passive gas/blast/scoot + active wall/spray/turbo). Passives apply instantly
  with caps `MAX_GAS/MAX_BLAST/MAX_SPEED` (capped → left on floor + message).
  Actives fill the single `held` slot (full → left on floor). Pickup loop is
  in `animate()`; bots collect passives only (`botWantsPU`).
- **Abilities**: `usePowerupFor` (A): `placeWall`, `sprayAir`, `turboToot`
  (blind 5s: bots wander, humans get black screen). `useSuperFor` (X, one per
  level, rotates by level): mask / S.B.D. / `dutchOven`. Aiming uses
  `aimDir(p)` from camera yaw; live previews via `updatePreviews` /
  `wallTargetInfo` / `turboLaneInfo`.
- **Bot AI**: `botThink` — danger-map flee (BFS) first, then blind-wander,
  `dangerMap(bot)` is per-bot: the boss can't sense bombs behind his back
  (`bombBehindBoss` — rear half-circle from mesh facing, own bombs exempt;
  hidden S.B.D. bombs invisible to all bots as before),
  passive-pickup seeking, bombing near crates/players, chase/wander;
  `levelParams` scales count/speed/range/aggression with
  `difficulty*2 + (level-1)`, capped.
- **Boss** (every `BOSS_EVERY`=5 levels — `isBossLevel()` in constants.js is
  the ONE cadence source for maze/theme/spawn/messages): one bot with
  `boss: true`, `hp`/`hpMax` = 600/800/1000 by difficulty, 100 dmg
  per blast hit (`hitCd` 0.6s i-frames; boss bar scales by `hpMax`).
  Blind spot: `dangerMap(bot)` skips bombs behind his facing
  (`bombBehindBoss`; own bombs exempt). Phase 2 at ≤`hpMax/2`: `enrageBoss`
  (tint, buffs) + `updateBossSpecial` (telegraphed cardinal-cross attack,
  1.2s warning planes, fires through the normal explosion system).
- **Movement**: `controlHuman` (stick/WASD relative to camera yaw; sprint
  Shift/L3/LT ×1.6 drains stamina; beans/revive ×2; suppress-until-release
  after resume), `collides`/`overlappingSolids` (can always walk OUT of a
  solid you overlap — trap-wall unstick).
- **Cameras**: Lego-style raised follow — pitch clamped to
  `PITCH_MIN`/`PITCH_MAX` (0.6-1.25, constants.js) so the 6.5 boom clears
  2-unit walls essentially always. Occlusion silhouette: `makeGhostFor(p)`
  clones the character (userData swapped around clone — rigRefs are circular),
  flat `MeshBasicMaterial` depthTest:false; `p.camOccluded` set in placeCam
  when the boom is blocked; `showGhostFor(viewP)` toggles per viewport right
  before each scissor render (own ghost only, never on bird's-eye/title);
  ghosts follow position/rotation.y/scale each frame, removed+disposed in
  startLevel via `removeGhost`. `placeCam(cam, p, dt)` per human with
  grid-march collision
  (`camBlockedAt`, smooth `camDist` recovery, `camLift` ride-over-walls;
  on/beyond the arena's outer ring anything below `CAM_EDGE_CLEAR` (TS+0.8)
  counts as blocked, so the camera can never duck low behind an outside
  wall — clearance sized to stay reachable within maxPitch when hugging the
  wall);
  the RESOLVED point is then position-smoothed (`p.camPos`, ~0.11s half-life)
  with a re-marched safety clamp so the eye can never sit inside a wall;
  sprint FOV kick +5° (`FOV_BASE`/`FOV_SPRINT_KICK`, reads `p.sprinting` set
  in `controlHuman`; `updateProjectionMatrix` only on real change). `aimDir`
  still reads raw yaw — aiming is unsmoothed. `spectate` for knocked-out
  players (A cycles; carries `fovCur` but never `sprinting`/`camPos`);
  split-screen scissor render at the end of `animate()` (2P halves; 3P
  quadrants + `cameraTop` bird's-eye, both untouched by smoothing).
- **Controllers**: title readiness (`connectedPads`, `requiredPads`,
  `updatePadStatus`); per-match lock `assignPads()` by gamepad index;
  disconnect → auto-pause with named message, `reclaimPads()` on reconnect.
- **Audio**: all Web Audio synthesis. `FARTS` per-character profiles →
  `fart(profile, big)`; `snd()` for UI beeps.
- **Leaderboard**: localStorage key `tootScootScores`, top 10, 1P only,
  initials entry UI (`initialsActive` state machine). Entries store
  `{initials, score, level, diff, mode}` — difficulty/mode snapshotted in
  `showInitials`; scoreboard rows render the difficulty tag.
- **Boss mode / start level**: `startAtLevel` + `bossMode` parsed from
  `?level=N` / `?boss=1` in constants.js (BEFORE ui.js builds MENU_ROWS);
  `startGame` starts every game at `startAtLevel`. With `?boss=1` the
  `levelrow` picker (`levelbtns`, `pickLevel`) is revealed at main.js load
  time and spliced into MENU_ROWS for gamepad nav. Set via `play.py --boss`
  and/or `--level N`.
- **Scoring**: 10 crate / 100 rival / 200 player KO / 500 level-or-round win /
  boss 100 per hit + 1000 kill. Credited to `explosion.owner.score` when the
  owner is a human (bots have no `score` field — guarded by
  `score !== undefined`).

## Balance constants (top of script, easy to tune)

`MAX_GAS=4, MAX_BLAST=5, MAX_SPEED=7.0, SPEED_STEP=0.5`; bomb fuse 2.2s,
blast linger 0.45s; trap wall 10s; Turbo Toot blind 5s; mask 8s; beans 6s at
normal speed, trail fuse 1.3s, trail bombs never chain-detonate (pop in drop
order — `b.trail` checked at both chain sites; same-owner and hidden S.B.D.
bombs never chain either); sprint ×1.6, stamina 100,
drain 10/s, refill 20/s, exhaustion floor 30;
beans 10% of drops, Extra Life 2%; boss special telegraph 1.2s, cooldown 7-9s;
boss HP 600/800/1000 by difficulty; camera PITCH_MIN 0.6 / PITCH_MAX 1.25.

## Known limitations

- Holding Space key-repeats farts (OS key repeat).
- Pause doesn't freeze `later()` transition countdowns (quit is safe).
- Aim previews are world meshes, visible in everyone's split-screen view.
- Leaderboard is per-browser localStorage, not a real file.
