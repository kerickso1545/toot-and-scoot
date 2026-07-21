# Otto's Games — Agent Instructions

This folder contains **Toot and Scoot**, a 3D fart-battle arena game designed by
Otto (Kevin's son) and built iteratively with Claude. Otto directs the design by
voice; Kevin relays it. Expect playful, kid-driven feature requests.

## Read these before making changes

- `ARCHITECTURE.md` — code map of the game: file layout, state model, systems,
  function inventory, where everything lives. **Do not spelunk the code for
  basics; read this first.**
- `DESIGN-DECISIONS.md` — decision log with rationale. Do not re-litigate or
  accidentally reverse these (e.g., do NOT re-add emergency teleporters, do NOT
  move the rules back onto the setup screen).
- `README.md` — player-facing feature documentation. Update it when features
  change.
- `activitylog.md` — append an entry for significant work (per the parent
  Projects/CLAUDE.md convention). This folder has no `timekeeping.md`:
  non-billable personal work.

## Files

| File | What |
|---|---|
| `toot-and-scoot.html` | THE game's shell: markup + ordered `<script src>` tags (load order matters — see ARCHITECTURE.md). |
| `css/style.css` | All game CSS. |
| `js/constants.js` | Balance constants, `PU_NAME`/`PU_COLOR`, `FARTS`, `MAZES`. |
| `js/theme.js` | `THEMES`, `canvasTex`, `applyTheme`. |
| `js/audio.js` | Web Audio synthesis: `fart()`, `snd()`, `ownerProfile`. |
| `js/meshes.js` | `HATMAP`, `makeHat`, `makeBot`, `makePlayerMesh`. |
| `js/world.js` | Maze gen + grid helpers: `buildWorld`, `insideShape`, `pillarAt`, `findSpawn`, `tileCenter`, `tileOf`, `collides`, `overlappingSolids`. |
| `js/fx.js` | Separable visual helpers: aim previews (`updatePreviews`), blind clouds, stink puffs. |
| `js/ui.js` | Title menu, rules, initials/leaderboard, pause/settings menus, pad status, HUD helpers. |
| `js/main.js` | Everything else: state globals, lifecycle, bombs/bots/players, cameras, `animate()`, all load-time side effects (loaded LAST). |
| `play.py` | Launcher: double-click → local web server on port 8765 + auto-opens the game (vite-style). Close the console window to stop. |
| `boom-bots-arena.html` | Old 2D prototype. Frozen; don't maintain. |
| `ottos-block-world.html` | Old 3D block-world demo. Frozen; don't maintain. |

## Workflow rules

1. **Edit the existing files in place.** Never rewrite from scratch. The js
   files are classic scripts sharing ONE global scope (NOT ES modules — no
   import/export, no "use strict"). Function declarations hoist within a file
   but not across files: any statement that EXECUTES at load time belongs in
   `js/main.js` (loaded last), or must only depend on files loaded before it.
2. **Syntax-check after edits** (ES5 style, no build step):
   `node --check js/<changed-file>.js` for every changed js file.
3. **Commit after each feature/fix** with a descriptive message
   (`git -c user.name="Kevin Erickson" -c user.email="kerickso1545@gmail.com" commit`).
   History is the changelog — keep commits granular.
4. **Pushing to GitHub** (`https://github.com/kerickso1545/otto-games`) must be
   done by Kevin from PowerShell (`git push`) — the sandbox has no credentials.
   Remind him after committing.
5. If git commands fail with lock-file/unlink errors in the sandbox, request
   delete permission (allow_cowork_file_delete) and remove stale `.git/*.lock`.
6. Claude cannot playtest. Verify by code-trace + syntax check, and be explicit
   with Kevin about what needs human testing.

## Hard invariants (do not break)

- Runs fully local and offline (except the Three.js r128 CDN `<script>` tag)
  via `play.py` (local server, port 8765 — fixed so the localStorage
  leaderboard origin never changes). No build tools, no bundlers, no
  frameworks — plain files served as-is, edit-and-refresh. Multi-file layout
  and local binary assets (e.g., embedded/fetched `.glb`) are now PERMITTED
  since the game is served over HTTP, but don't add more files or assets
  without a reason; today the game is plain `<script src>` files (no `fetch`ed
  assets), so it still also works from `file://`. Textures are painted in code
  onto canvas (`THEMES`),
  audio is Web Audio synthesis — keep procedural as the default, assets as
  the exception.
- ES5-flavored JS (var, function declarations) to match the existing codebase.
- Controller-first: every screen (title, pause, rules, initials) must be fully
  navigable by gamepad; keyboard+mouse always works for P1.
- Rules/instructions live on the separate "How to play" panel, never on the
  setup screen.
- Kid-friendly tone everywhere (it is a fart game; humor yes, edge no).
- Delayed state changes must go through `later()` (session-guarded timeouts).
- Every game-start path must pass `canStartGame()`.
- Transient UI (overlays, banners, previews) must be cleared via
  `resetTransientUI()` on quit/end/level-change.
