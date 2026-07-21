# Toot and Scoot — "Next Level 3D" Plan (Multi-Agent Work Order)

Status: PROPOSED (awaiting Kevin/Otto approval)
Author: Claude, 2026-07-21

## 1. Context — correcting the premise

This plan started from an external (Gemini) proposal to "transition the game
from 2D Canvas to 3D WebGL." **That premise is wrong: Toot and Scoot is already
a full 3D Three.js game** — third-person cameras with collision, 6 procedural
maze shapes, split-screen multiplayer, canvas-painted textures. There is no 2D
port to do.

What "go next level" actually means here is a **visual/feel glow-up of the
existing 3D game**, keeping every mechanic, rule, and design decision intact.

### Disposition of the Gemini proposal

| Gemini idea | Verdict | Why |
|---|---|---|
| Three.js + WebGL renderer | Already done | Game is Three.js r128 |
| GLTFLoader + Poly Pizza models | **DEFERRED** | Unblocked by the `play.py` local-server decision (2026-07-21) — `.glb` loading now works. Still doing the glow-up procedurally first: parameterized colors/hats iterate faster and match the aesthetic. GLB is the fallback if WS-B's characters underwhelm. |
| 2D-array maze → 3D geometry | Already done (better) | 6 maze shapes + flood-fill connectivity guarantee |
| 3rd-person follow camera w/ lerp | Mostly done | Camera exists w/ collision; add position smoothing + FOV kick (WS-D) |
| InstancedMesh for walls/floor | **ADOPTED** | Real perf win, esp. 3P (4 renders/frame) (WS-D) |
| Modular character + anchor nodes | **ADOPTED (procedural)** | Characters are cylinder+sphere+hat today; upgrade to modular low-poly bodies with anchor points, no GLB (WS-B) |
| 3-phase fart-cloud particle FX | **ADOPTED** | Current blasts are flat-material tiles; gas-cloud particles are the single biggest visual upgrade for a fart game (WS-A) |
| Custom themes (dungeon/cyber/hedge) | **ADOPTED, re-themed** | `applyTheme()` was built for this ("stated future wish"), but themes must stay in the toilet-humor universe, not generic fantasy (WS-C) |

### Non-negotiable invariants (from CLAUDE.md — every agent must comply)

1. Fully local/offline, served via `play.py` (fixed port 8765). No build
   tools, no bundlers, no frameworks — plain files, edit-and-refresh.
   Multi-file and local assets permitted but not required; the game currently
   stays one self-contained file unless a workstream has a concrete reason.
2. All textures canvas-painted in code; all audio Web Audio synthesis.
3. ES5-flavored JS (`var`, function declarations).
4. Controller-first UI; keyboard+mouse always works for P1.
5. Kid-friendly tone. Delayed state via `later()`. All start paths through
   `canStartGame()`. Transient UI cleared via `resetTransientUI()`.
6. Do not resurrect anything in DESIGN-DECISIONS.md "Rejected/reverted".
7. **Gameplay rules do not change.** This work order is visuals, feel, and
   performance only.

## 2. The upgrades (what players will notice)

1. **Fart clouds, not flat tiles** — blasts become billowing green gas clouds
   that swell, drift, and dissipate; bigger blasts = bigger clouds; subtle
   camera shake on nearby explosions.
2. **Characters 2.0** — modular low-poly bodies (feet, arms, expressive eyes)
   with anchor points; waddle/lean animation while moving, squash-and-stretch
   on farting, spin-out on getting gassed. Hats and colors unchanged.
3. **Per-level themes** — maze theme rotates by level (bathroom stays #1).
   Candidate themes for Otto to approve (all on-theme): Sewer Kingdom,
   Construction Site (porta-potty crates — Gassy Gus's home turf), Royal
   Throne Room (Princess Poot), Neon Arcade Restroom. Boss arena gets its own
   menacing variant.
4. **Smoother, punchier camera** — position lerp, small FOV kick when
   sprinting or caught in a blast radius.
5. **Faster** — instanced floor/wall rendering so 3P split screen stays at
   60 FPS as levels grow denser.

## 3. Parallelization strategy — REVISED 2026-07-21: modularize first

The single-file constraint is retired (see DESIGN-DECISIONS.md Distribution:
`play.py` serves the game over local HTTP). That flips the analysis: instead
of four agents fighting over one 2,717-line file with region-ownership rules,
we spend one serialized step splitting the file, then run genuinely parallel
workstreams with file-level ownership and near-zero merge conflicts.

### Phase 0 — Modularization (one agent, serialized, behavior-neutral)

Split `toot-and-scoot.html` into plain files loaded via ordered `<script>`
tags. **NOT ES modules** — the codebase is ES5 globals throughout; rewiring
~100 globals into import/export is high-risk churn for zero player value.
Plain script tags keep every function and variable exactly as-is (top-level
`var`/function declarations in classic scripts share one global scope), so
the refactor is mechanical cut-and-paste in dependency order. (Bonus: script
tags aren't subject to the `file://` fetch restriction, so even the direct
double-click fallback keeps working.)

Target layout (~8 files, each mapping to a workstream's territory):

| File | Contents (from ARCHITECTURE.md systems) | Owner after split |
|---|---|---|
| `index.html` | markup, overlay/HUD/menus DOM, ordered script tags | WS-E |
| `css/style.css` | the `<style>` block | WS-E |
| `js/constants.js` | balance constants, PU tables, `FARTS`, `MAZES` | shared (read-mostly) |
| `js/theme.js` | `THEMES`, `canvasTex`, `applyTheme` | WS-C |
| `js/audio.js` | fart synthesis, `snd()` | shared |
| `js/meshes.js` | `makeHat`, `makeBotMesh`, `makePlayerMesh` | WS-B |
| `js/world.js` | `buildWorld`, `insideShape`, `pillarAt`, `findSpawn`, grid helpers | WS-D |
| `js/fx.js` | explosion/dome/preview visuals (extracted), new FX pool | WS-A |
| `js/ui.js` | menus, rules, initials, leaderboard, HUD, pad status | WS-E |
| `js/main.js` | state globals, lifecycle, `animate()`, bots, players, cameras | WS-E (hooks by request) |

Rules for the Phase 0 agent: zero behavior change; no renames, no
reordering of logic, no "while I'm here" cleanups; preserve declaration
order across files (load order = old top-to-bottom order); `node --check`
every file; game must boot and play identically. `git mv`-style history
isn't possible for extraction, so the commit message documents the mapping.

**Gate: Kevin & Otto smoke-test the modularized game before any workstream
starts** (Claude can't playtest; this refactor is exactly the kind of change
that looks fine in code-trace and breaks at runtime via load order).

### Phase 1 — Parallel workstreams (revised mechanics)

- **Branch model**: `main` stays untouched/playable. Integration branch
  `next-level` is cut from main; Phase 0 lands on it first. Workstream
  branches (`ws-fx`, `ws-characters`, `ws-themes`, `ws-perf`) cut from
  post-Phase-0 `next-level`. Agents merge back to `next-level` (integrator
  reviews); `next-level` → `main` only after the final human playtest.
  Rollback at every level: main is always the last-good game.
- **File ownership replaces region ownership.** Each agent owns its files
  (table above) and may freely create new ones. `js/main.js` and
  `index.html` are integrator-owned: workstreams request hooks (the
  `updateFX(dt)` / `updateCharacterAnim(dt)` / `updateCameraFeel(p, dt)`
  contract from the briefs stands) via `HANDOFF-<ws>.md` + a proposed diff.
- **Merge order matters much less now.** Independent files merge in any
  order; only the `main.js` hook wiring is serialized (integrator applies
  all four in one pass). WS-C/WS-D still coordinate through the `THEMES` key
  contract, not code edits.
- **Verification per merge**: `node --check` per changed file, code-trace of
  contracts, boot check via `play.py` + curl (server returns 200 on all
  scripts — catches missing/renamed files), human playtest at the end.

## 4. Workstream briefs

### WS-A — Fart Cloud FX Engine

**Goal**: Replace flat explosion tiles with a particle gas-cloud system;
add camera shake; upgrade bean-trail and dome visuals to match.

**Owns**: `explode()` visual portion, explosion update loop in `animate()`
(timer/mesh section only — NOT kill logic), `domes` visuals, bean-trail visual
in bean handling. Adds: `FX` namespace (`spawnFartCloud(gx, gz, big)`,
`updateFX(dt)`, `shakeCamera(p, mag, dur)`).

**Contract**: `explosions[]` entries keep exact shape
`{gx, gz, timer, mesh, owner}` — bot AI danger map, `explosionAt()`, kill
checks, and boss special all read it. `timer` still drives lethality (0.45s
linger unchanged). Clouds are cosmetic children; lethal area stays exactly one
tile per entry. Boss telegraph planes unchanged in meaning (1.2s warning).

**Design**: pool of ~150 sprites (canvas-painted soft puff texture, additive
none/normal blend, green `#88aa33` family; boss stink tinted). 3-phase
lifecycle: burst-swell (0-0.15s), billow-drift (to 0.45s), linger-fade
(0.3s after lethality ends — purely visual). Sprite pool reused across
explosions; hard cap so 3P chain reactions can't blow the frame budget.
Camera shake ≤0.2s, magnitude scaled by blast proximity per player, applied in
`placeCam` AFTER collision resolution. Must respect `resetTransientUI()` —
add FX teardown there (document the one-line change for the integrator).

**Acceptance**: chain explosions look continuous; no change to kill timing or
bot flee behavior (code-trace `botThink` danger map); pool never exceeds cap;
`later()` used for any delayed visual state.

### WS-B — Characters 2.0 (modular procedural bodies + animation)

**Goal**: Upgrade the cylinder+sphere characters into modular low-poly bodies
with anchor points and life: waddle, lean into turns, squash-and-stretch on
fart, spin-out when gassed, victory wiggle.

**Owns**: `makePlayerMesh()`, `makeBotMesh()` (body construction only —
`makeHat()` output must attach unchanged to a `hatAnchor`). Adds:
`buildCharacter(color, opts)` returning a group with named anchors
(`hatAnchor`, `faceAnchor`, `backAnchor`), `updateCharacterAnim(dt)`.

**Contract**: mesh group origin, footprint radius (~0.5-0.6), and height stay
compatible with `collides()` and camera framing — collision is grid/position
math, not mesh-based, so DO NOT alter `x,z` movement, only visual transforms
on child nodes. Boss keeps 2.2× scale + crown + enrage tint hook. Rainbow
Extra Life shimmer and mask visuals must keep working (they mutate materials —
keep a `bodyMats` array reference on the group for them). All six rivals keep
their signature hats; player color/hat pickers unchanged.

**Design**: body = torso + head + stubby feet + mitt arms from Lambert-material
primitives; eyes with pupils that glance toward movement direction. Animation
is transform-only (no skeletons): feet alternate, torso bobs/leans, scale
squash 0.15s on `fart()` trigger, spin-out driven by existing knockout path.
Anchor system so future accessories (backpack, sunglasses — Otto ideas) drop
in later.

**Acceptance**: title-screen preview, all 6 rivals, boss, and 3 player colors
render correctly; shimmer/mask/enrage still work (code-trace); no gameplay
position change; per-frame cost trivial (transforms only).

### WS-C — Per-Level Theme Packs

**Goal**: 3-4 new themes rotating by level; bathroom remains level 1's theme;
boss arena variant. All textures canvas-painted, kid-friendly, on-theme.

**Owns**: `THEMES` object, `applyTheme()`, theme selection logic (one small
integrator-documented hook in `startLevel`: `applyTheme(themeForLevel(level))`).
Adds: `themeForLevel(level)`.

**Contract**: every theme supplies the full key set bathroom uses today
(`wall`, `crate`/`crateSide`+`crateCap`+`crateShape`, `floorA/B`, `trapWall`
{color, opacity}, `sky`) plus new optional keys with bathroom-equivalent
defaults (`lightColor`, `fogDensity`, `accent`). `crateShape` may vary per
theme but crates stay 1-tile destructibles worth 10 points. Trap walls stay
visually distinct from permanent walls in every theme (readability rule).

**Design**: proposed rotation — L1 Bathroom → L2 Sewer Kingdom (mossy stone,
glowy green water sky) → L3 Construction Site (porta-potty crates, caution
stripes) → L4 Royal Throne Room (gold + marble, throne crates) → repeat;
every 10th level Boss Arena variant (darker bathroom, red accents). **Theme
list needs Otto's sign-off before this workstream starts** — present names +
one-line descriptions, let him pick/rename/add.

**Acceptance**: cycling all levels shows correct themes; minimap still
readable on every floor palette; trap wall readable everywhere; theme swap
produces no leaked materials/textures (dispose old canvas textures).

### WS-D — Performance + Camera Feel

**Goal**: InstancedMesh floor and permanent walls; camera position smoothing
and FOV kick. Budget: hold 60 FPS in 3P on the densest late-game maze.

**Owns**: `buildWorld()` floor/wall mesh construction, `placeCam()`. Adds:
`updateCameraFeel(p, dt)`.

**Contract**: `grid[z][x]` stays the collision/AI source of truth — instancing
is render-only. Crates stay individual meshes (they're destroyed one at a
time and themed per-shape); only floor tiles and permanent walls (type 1)
instance. Theme system must still be able to swap instanced materials
(coordinate with WS-C's key set — this is the one cross-stream interface;
resolve via the shared `THEMES` key contract, not by editing WS-C code).
Camera smoothing must not break camera collision (`camBlockedAt` grid-march
runs on the TARGET position; lerp only the resolved position) or aim-preview
accuracy (`aimDir` reads yaw, which is unsmoothed input — keep it that way).
Spectate camera and 3P bird's-eye untouched.

**Acceptance**: draw-call count measurably reduced (log
`renderer.info.render.calls` before/after in handoff notes); no visual pop on
level rebuild; sprint FOV kick subtle (≤6°) and returns cleanly; camera never
clips through walls (code-trace collision path).

### WS-E — Integration + QA (runs last, serialized)

**Goal**: merge branches in order (C → D → B → A), resolve `animate()` wiring,
apply each workstream's documented one-line hooks, verify, document.

**Checklist per merge**: syntax check (CLAUDE.md command) · code-trace the
merged system against its contract · confirm no invariant broken · granular
commit with descriptive message.

**Final pass**: update README.md (player-facing features), ARCHITECTURE.md
(new systems: FX pool, character anchors, theme rotation, instancing),
activitylog.md entry; produce a human playtest checklist for Kevin & Otto
(Claude cannot playtest — explicit list of what to verify on real hardware:
3P FPS, controller nav, blind overlay + shake interaction, every theme,
boss fight, shimmer/mask on new bodies).

## 5. Agent kickoff prompts (condensed)

Each agent receives: CLAUDE.md, ARCHITECTURE.md, DESIGN-DECISIONS.md, this
plan (their brief + the invariants + the contract sections of adjacent
workstreams), and a branch cut from post-Phase-0 `next-level`. Standing
orders: ES5 only; edit only owned files (create new ones freely); request
`main.js`/`index.html` changes via `HANDOFF-<ws>.md` with a proposed diff;
`node --check` changed files before finishing; commit granularly; do not
push. Phase 0's agent additionally updates CLAUDE.md (workflow rules 1-2 and
file table) and ARCHITECTURE.md to describe the new layout.

## 6. Open questions for Otto & Kevin (answer before kickoff)

1. Theme lineup: approve/edit the four proposed themes? (Otto may have
   strong opinions — he usually does.)
2. Characters: keep current proportions (big head/small body) or go blockier?
   WS-B will build one preview character first for approval before doing all
   six rivals + boss.
3. Camera shake: some kids find it annoying — ship with a Settings toggle?
   (Recommend yes; settings menu already exists.)
4. Scope check: this is 4 dev workstreams + integration. If trimming, cut
   order is WS-D camera-feel half first, then WS-C to 2 themes. WS-A (fart
   clouds) is the heart of the upgrade — protect it.
