# Toot and Scoot — Architecture

Single self-contained HTML file (`toot-and-scoot.html`, ~2700 lines): CSS in
`<style>`, UI in HTML, one big inline `<script>` (ES5 style). Three.js r128 from
cdnjs is the only external dependency. No build step.

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
- HUD (`hudroot`): `hudTL`, `hudTR`, `hudP3` panels, `slots` (A/X item boxes,
  1P only), `hudBL` chips (1P), `stambar`, `bossbar`, `minimap` canvas,
  `levelmsg` banner, `maskoverlay` (goggles SVG), `blind0-2` (STINKED covers),
  `pmsg0-2` (per-player contextual messages)

HUD panels swap innerHTML between 1P template (ids `hLevel`, `hDiff`, `hScore`,
`hRivals`) and multiplayer `twoPHudHtml()` strings — 1P ids only exist in 1P.

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

- **Lifecycle**: `startGame()` → `startLevel(keepStats)` (rebuilds world +
  players; `carryStats()` persists score/wins/lives), `endGame(text)`,
  `menuAction('quit')`. Transitions between levels use `later()` timeouts.
- **Safety rails**: `later(fn, ms)` + `bumpSession()` (session-ID-guarded
  timeouts, cleared on start/quit/end); `canStartGame()` (single gate for ALL
  start paths incl. pointerlockchange); `resetTransientUI()` (clears every
  overlay/banner/preview/effect).
- **Maze**: `MAZES` (6 shapes cycling by level; boss arena every 10th),
  `insideShape`, `pillarAt`, `buildWorld()` (gen + flood-fill connectivity
  guarantee — isolated pockets get sealed; spawn generation with progressive
  distance relaxation), `findSpawn`.
- **Theme**: `THEMES.bathroom` + `applyTheme()` — canvas-painted textures
  (porcelain walls, TP-roll cylinder crates via `crateGeoActive`).
- **Bombs/blasts**: `dropBombFor`, `placeBomb(gx,gz,range,owner,opts)`
  (opts: `fuse`, `hidden` (S.B.D.), `quiet` (bean trail)), `explode` (cross
  blast, punches through crates, stops at walls 1/3, chains, drops power-ups,
  scores crates to `owner.score`), `explosions[]` entries carry `owner` for
  kill attribution.
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
  passive-pickup seeking, bombing near crates/players, chase/wander;
  `levelParams` scales count/speed/range/aggression with
  `difficulty*2 + (level-1)`, capped.
- **Boss** (every 10th level): one bot with `boss: true, hp: 1000`, 100 dmg
  per blast hit (`hitCd` 0.6s i-frames). Phase 2 at ≤500 HP: `enrageBoss`
  (tint, buffs) + `updateBossSpecial` (telegraphed cardinal-cross attack,
  1.2s warning planes, fires through the normal explosion system).
- **Movement**: `controlHuman` (stick/WASD relative to camera yaw; sprint
  Shift/L3/LT ×1.6 drains stamina; beans/revive ×2; suppress-until-release
  after resume), `collides`/`overlappingSolids` (can always walk OUT of a
  solid you overlap — trap-wall unstick).
- **Cameras**: `placeCam` per human with grid-march collision (`camBlockedAt`,
  smooth `camDist` recovery); `spectate` for knocked-out players (A cycles);
  split-screen scissor render at the end of `animate()` (2P halves; 3P
  quadrants + `cameraTop` bird's-eye).
- **Controllers**: title readiness (`connectedPads`, `requiredPads`,
  `updatePadStatus`); per-match lock `assignPads()` by gamepad index;
  disconnect → auto-pause with named message, `reclaimPads()` on reconnect.
- **Audio**: all Web Audio synthesis. `FARTS` per-character profiles →
  `fart(profile, big)`; `snd()` for UI beeps.
- **Leaderboard**: localStorage key `tootScootScores`, top 10, 1P only,
  initials entry UI (`initialsActive` state machine).
- **Scoring**: 10 crate / 100 rival / 200 player KO / 500 level-or-round win /
  boss 100 per hit + 1000 kill. Credited to `explosion.owner.score` when the
  owner is a human (bots have no `score` field — guarded by
  `score !== undefined`).

## Balance constants (top of script, easy to tune)

`MAX_GAS=4, MAX_BLAST=5, MAX_SPEED=7.0, SPEED_STEP=0.5`; bomb fuse 2.2s,
blast linger 0.45s; trap wall 10s; Turbo Toot blind 5s; mask 8s; beans 6s at
×2; sprint ×1.6, stamina 100, drain 10/s, refill 20/s, exhaustion floor 30;
beans 10% of drops, Extra Life 2%; boss special telegraph 1.2s, cooldown 7-9s.

## Known limitations

- Holding Space key-repeats farts (OS key repeat).
- Pause doesn't freeze `later()` transition countdowns (quit is safe).
- Aim previews are world meshes, visible in everyone's split-screen view.
- Leaderboard is per-browser localStorage, not a real file.
