# Otto's Games — Agent Instructions

This folder contains **Toot and Scoot**, a 3D fart-battle arena game designed by
Otto (Kevin's son) and built iteratively with Claude. Otto directs the design by
voice; Kevin relays it. Expect playful, kid-driven feature requests.

## Read these before making changes

- `ARCHITECTURE.md` — code map of the single-file game: state model, systems,
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
| `toot-and-scoot.html` | THE game. Single self-contained file (~2700 lines). |
| `play.py` | Launcher: double-click → local web server on port 8765 + auto-opens the game (vite-style). Close the console window to stop. |
| `boom-bots-arena.html` | Old 2D prototype. Frozen; don't maintain. |
| `ottos-block-world.html` | Old 3D block-world demo. Frozen; don't maintain. |

## Workflow rules

1. **Edit `toot-and-scoot.html` in place.** Never rewrite from scratch.
2. **Syntax-check after edits** (game JS is one inline script; ES5 style, no
   build step):
   `python3 -c "import re; open('/tmp/g.js','w').write(re.findall(r'<script>(.*?)</script>', open('toot-and-scoot.html').read(), re.S)[-1])" && node --check /tmp/g.js`
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
  since the game is served over HTTP, but don't split the file or add assets
  without a reason; today the game is still one self-contained file that also
  works from `file://`. Textures are painted in code onto canvas (`THEMES`),
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
