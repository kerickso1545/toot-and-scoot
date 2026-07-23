# Toot and Scoot — Design Decision Log

Decisions made by Otto (designer) and Kevin (producer). Future sessions:
respect these unless Kevin explicitly changes them.

## Identity
- **Name**: "Toot and Scoot" (from their Xbox gamertag). Bombs are farts;
  keep the fart theme in all naming ("blast radius" is fine).
- Characters are *players/rivals*, not robots. Six named rivals with signature
  hats and unique synthesized fart voices: Sir Toots-a-Lot (top hat, long low
  regal), Stinky Pete (brown cowboy, wet sputter), Windy Wendy (propeller,
  high whistly), Princess Poot (crown, dainty squeak), Gassy Gus (hard hat,
  deep rumble), Captain Cheeks (captain's cap, machine-gun putt-putt).
- Player picks color (blue/red/teal/magenta) and hat (cowboy/party/ball
  cap/TP roll) on the setup screen. P2 green, P3 magenta-or-orange, auto hats.
- Bathroom theme: porcelain tile walls, cylindrical TP-roll crates with dark
  cardboard tube on top, frosted-glass trap walls, steamy sky. Theme system
  (`applyTheme`) built for future per-level themes — a stated future wish.

## Controls (Switch-style layout)
- B/bottom or right trigger = fart; A/right = use held item; X/top = super;
  L3 or LT = sprint; + = pause. Keyboard: WASD/mouse, Space, E, Q, Shift, Esc.
- Third-person camera ("up and behind"), mouse/right-stick orbit. Aiming for
  directional abilities follows CAMERA yaw (changed from mesh facing —
  deliberate).
- **Lego-style raised camera (2026-07-22)**: pitch floor raised 0.25 → 0.6
  (`PITCH_MIN`) after research into Minecraft (pull-in, disliked) vs TT Lego
  games (raised follow angle). At 0.6+ the 6.5-unit boom clears the 2-unit
  walls essentially always (61k-case sim: zero pull-ins), so the camera stops
  fighting the player. When something DOES briefly occlude, the player's own
  viewport shows a see-through colored silhouette ("ghost") of their character
  through the wall instead of zooming in. Kevin's call after the low-pan
  annoyance; don't lower the floor without re-checking occlusion.
- Everything controller-navigable (they cast to a TV). Menus: d-pad + A.

## Mechanics decisions (with rationale)
- **Bombs are walk-through** (no bomb-body collision). Otto found getting
  stuck on your own bomb unfun. The classic trap-yourself rule was rejected.
- **Blasts punch through crates** (stop only at permanent/trap walls) so blast
  reach looks consistent in all four directions — a fairness complaint fix.
- **One held item at a time** (A to use). Grabbing while full LEAVES the floor
  item and shows "Item slot full" (changed from destroy-on-grab).
- **Passive upgrades apply instantly** with caps (MAX_GAS 4, MAX_BLAST 5,
  MAX_SPEED 7.0). Super Scoot was briefly deleted as redundant with sprint,
  then restored as the third passive with caps.
- **Superpower on X: one use per level**, rotating Gas Mask → S.B.D. →
  Dutch Oven → Pyroflatulence by level. (A 30s-cooldown version was tried
  and reverted.)
- **Pyroflatulence (Otto, 2026-07-22)**: fire-charged toot — normal fuse and
  cloud, then ignites a FAT plus: the blast also burns one tile sideways off
  both arms. Balance rails: once per level; the toot is unmistakably orange
  so alert humans can read it; rivals' danger sense only reads the normal
  cross (flanks are the surprise, same precedent as S.B.D.); the step-aside
  dodge fails for the OWNER too — real self-gas risk is the counterweight.
- **Legendaries are indestructible floor items**: Can of Beans (10% of drops;
  6s fart trail at NORMAL speed — Otto changed this from double speed
  2026-07-21; the trail toots pop in drop order and never chain, so you can
  outrun them) and rainbow
  **Extra Life** (2%; auto-revive with 2s invincible double-speed escape;
  carrier's avatar shimmers rainbow; fully automatic, no button).
- **Turbo Toot** blind = PITCH BLACK screen for human victims (5s), random
  stumbling for bots. Explicitly requested full black, not tinted.
- **Trap wall**: 10s barrier, blocks everyone AND blasts; "fart + wall = trap"
  is intended strategy. Players can always walk OUT of a solid they overlap
  (unstick rule) but traps still hold because you can't pass through.
- **Emergency teleporters were REMOVED** (tried on levels 2/5, then 3/5, then
  everywhere). Replaced by the proper fix: flood-fill connectivity guarantee
  at maze generation (isolated pockets sealed). Do not re-add teleporters.
- **Sprint + stamina**: 100 stamina, only sprint drains it (10/s), refill
  20/s, exhausted below 0 until 30 (can still walk). Plain movement is free.
- **Six maze shapes** cycle by level: Classic, Octagon, Circle, Triangle,
  Diamond, Open floor — Otto wanted real shape variety, not just crate
  reshuffles. Every 5th level is the boss arena (changed from 10th,
  2026-07-21).
- **Boss (The Big Stinker)**: 600/800/1000 HP by difficulty (Easy/Med/Hard —
  6/8/10 hits, scaled 2026-07-22 after the 10-hit fight proved too long),
  100/hit, crown, 2.2× scale, deepest fart voice. Phase 2 at half health:
  enrage tint, faster, telegraphed cardinal-cross stink attack (1.2s
  warning). **Otto's sneak-attack rule (2026-07-21): he can't see farts
  dropped behind his back** — his one exploitable weakness; keep it.
  Abilities must keep working on him — never make him immune to player tools.
- **Chain rules (2026-07-21/22)**: a blast never detonates a same-owner bomb
  (Extra Gas double-toots keep their own fuses), never a bean-trail toot, and
  never a hidden S.B.D. (the surprise stays secret until its own fuse).
  Different-owner visible farts still chain — crossfire is intended.
- **Retry continues (2026-07-22)**: the results panel's "Retry same setup"
  resumes at the level you died on (fresh score/stats). Title-screen starts
  always begin at level 1 (or the boss-mode pick). Rationale: losing 15
  minutes of campaign to one blast was the top kid frustration.
- **Difficulty**: Easy/Medium/Hard start tiers; tier = difficulty*2+(level-1)
  scales bot count/speed/range/aggression (capped). Bots collect passive
  upgrades too (parity decision, keeps late levels challenging).

## Multiplayer decisions
- Local split screen only (no online). 2P = vertical halves; 3P = quadrants
  with a bird's-eye view in the fourth quadrant (minimap hidden in 3P).
- Free-for-all: humans vs humans vs rivals. Round winner gets +500 and a win
  tally; **everyone advances to the next level together** (knocked-out
  players return). Only a total human wipe ends the campaign.
- Knocked-out players spectate (A cycles targets, including bots).
- Controller assignment locked by index at match start; disconnect
  auto-pauses with a named message. 2P needs ≥1 pad, 3P needs ≥2 (P1 may use
  keyboard). Start is blocked until requirements are met.
- Scoring works identically in multiplayer (plus 200 for gassing a player);
  the persistent leaderboard remains 1P-only.

## UI decisions
- Kart-racer style HUD: chunky outlined text, corner panels, A/X item boxes
  with button-coin labels, bottom stat chips, minimap bottom-right (1P/2P).
- Setup screen is COMPACT: pickers + difficulty + controller status only.
  All rules live on the separate scrollable "How to play" panel. Keep it
  that way.
- Old-school 3-initial leaderboard entry (d-pad cycles letters).
- Naming: "Air Freshener" (not air spray), "Extra Life" (not Extalife —
  a dictation artifact that got fixed), "Super Scoot", "Turbo Toot",
  "Silent But Deadly", "Dutch Oven", "The Big Stinker".

## Distribution (2026-07-21)
- **Local web server via `play.py`** (double-click → serve on fixed port
  8765 → auto-open browser, vite-style) replaces plain `file://`
  double-click as the standard way to run. Rationale: `file://` blocks
  fetch/XHR of local sidecar files (CORS), which ruled out `.glb` models and
  multi-file layout; serving over HTTP removes that wall while staying 100%
  local/offline. Port is FIXED so the localStorage leaderboard origin is
  stable (changing it would wipe high scores). One-time cost: scores from the
  `file://` era don't carry over.
- Public/remote hosting (GitHub Pages, Tailscale) considered and deferred —
  local server is enough for now.
- **LAN play (2026-07-22, Kevin)**: server binds 0.0.0.0 so other devices on
  the home network can open the game; console prints the LAN URL. The host
  computer still opens 127.0.0.1 so ITS leaderboard origin never changes;
  each device has its own localStorage scores. Still fully local — nothing
  leaves the network.
- **No build step remains sacred**: plain files served as-is,
  edit-and-refresh. Multi-file and local assets are allowed but not required;
  procedural-in-code stays the default aesthetic and workflow.

## Rejected / reverted ideas (don't resurrect without asking)
- Online multiplayer (out of scope for a single file).
- Emergency teleporters (all variants) — replaced by connectivity guarantee.
- Superpower cooldown model — replaced by once-per-level.
- Super Scoot deletion — restored with caps instead.
- Bomb-blocking movement (classic Bomberman rule) — rejected as unfun.
