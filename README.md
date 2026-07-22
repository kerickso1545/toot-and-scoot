# Otto's Games

Games designed by Otto, built with Claude.

## Toot and Scoot (`toot-and-scoot.html`)

A 3D fart-battle arena game in a bathroom-themed maze. **To play:
double-click `play.py`** — it starts a tiny local server and opens the game
in your browser automatically (keep the console window open while playing;
press ESC or close it to stop). It also live-reloads the page whenever a
game file changes — waiting politely until you're back at the title screen
if a match is running. Needs Python 3 installed, and internet the first time to
load the Three.js library. Opening `toot-and-scoot.html` directly also still
works, but the high-score leaderboard is saved separately per method — stick
with `play.py`. Best played with Bluetooth/USB controllers; keyboard + mouse
also fully supported.

**Boss mode**: `python play.py --level 5` starts every new game at that level
— bosses are every 5th level, so `--level 5`, `10`, `15`... jumps straight to
the fight (higher levels are harder, just like getting there the long way).

### Modes
- **1 player** — level campaign with rising difficulty, scoring, and a
  persistent local leaderboard (top 10, classic 3-initial entry; every entry
  shows the difficulty it was earned on)
- **2 player split screen** and **3 player quadrant view** (third-person
  cameras; the 3P fourth quadrant is a live bird's-eye view) — battle royale
  with rival bots mixed in; when someone wins the round, everyone advances to
  the next level together; per-player win tally and score
- Knocked-out players **spectate** (A cycles who you watch)

### Controls
| Action | Controller | Keyboard |
|---|---|---|
| Move | left stick | WASD |
| Camera | right stick | mouse |
| Drop a fart | B / right trigger | Space or click |
| Use held power-up | A | E |
| Superpower | X | Q |
| Sprint | left-stick click / LT | Shift |
| Pause menu | + / Start | Esc |
| Menus | d-pad + A | arrows + Enter |

### Core mechanics
- Farts linger, then spread fast in four directions; blasts punch through
  crates but stop at walls — and now erupt as **billowing green gas clouds**
  that swell, drift, and fade (boss blasts get their own menacing tint),
  with a little screen shake when one goes off near you (toggle it off in
  Settings: "Screen shake")
- **Power-ups** (hold one, A to use): Extra Gas, Big Blast, Trap Wall,
  Air Freshener, Turbo Toot (blinds a victim for 5 s — pitch black screen for
  human victims)
- **Legendary finds** (indestructible): Can of Beans (10% of drops — 6 s fart
  trail at double speed), rainbow **Extra Life** (2% — auto-revive with 2 s
  invincible double-speed escape; avatar shimmers rainbow while carried)
- **Superpowers** (X, one per level, rotating): Gas Mask, Silent But Deadly,
  Dutch Oven
- **Sprint + stamina**: 100 stamina, sprint drains 10/s, refills at rest;
  run dry and you can't sprint until it recovers
- **Six maze shapes** cycle per level (Classic, Octagon, Circle, Triangle,
  Diamond, Open floor) with varied pillar patterns; generation guarantees
  full connectivity (no sealed pockets)
- **Per-level themes** rotate as you climb: Bathroom (level 1) → Sewer
  Kingdom (mossy stone + glowing slime) → Construction Site (caution stripes
  + porta-potty crates) → Royal Throne Room (marble, gold, red carpet) →
  repeat — and every 5th level the boss fight happens in a dark, red-lit
  haunted-bathroom Boss Arena
- **Animated characters**: everyone waddles as they run, leans into turns,
  blinks, breathes when idle, scrunches down for a fart, and spins out when
  gassed (in multiplayer) — hats and colors as always
- **Boss every 5th level**: The Big Stinker — 1000 HP, 100 damage per blast,
  health bar, boss arena
- **Six rivals** with signature hats and synthesized fart voices; smarter,
  faster, and more numerous as levels climb — and they always spawn a safe
  distance from you (you spawn facing your escape route, never a wall)
- **"3, 2, 1, SCOOT!!" countdown** at every level start: everyone's frozen
  while big numbers count down in each player's viewport, with a P1/P2/P3
  badge floating over each player's head so nobody loses themselves after a
  split-screen level change
- **Results screen** after every run: score, level reached, rivals gassed,
  TP shredded, self-gasses, items used, and fastest level — with Retry same
  setup / Change setup / Main menu
- **Scoring**: 10 per crate, 100 per rival, 200 per player KO, 500 per
  level/round win, boss hits 100 each + 1000 bonus
- HUD: kart-racer style panels, item boxes with button labels, minimap
  (1P/2P), stamina bar, boss bar

### Tech notes
- Plain HTML/CSS/JS files (no build step): `toot-and-scoot.html` shell +
  `css/style.css` + eight `js/*.js` scripts loaded in order; Three.js r128
  from CDN; Web Audio API for all sound (synthesized fart voices per
  character); Gamepad API; localStorage for the leaderboard
- All five themes drawn procedurally in code (canvas textures) — porcelain
  tile, mossy sewer brick, caution stripes, marble and gold, and themed
  crates (TP rolls, goo barrels, porta-potties); trap walls stay frosted and
  readable in every theme
- Fart clouds are a pooled particle system; floors and walls render as
  instanced meshes so 3-player split screen stays fast

## Older prototypes

- `boom-bots-arena.html` — the original 2D top-down bomb arena
- `ottos-block-world.html` — first-person 3D block building demo

## Development

Built iteratively in Claude Cowork sessions — Otto designs, Claude implements.
See `activitylog.md` and the git history for the feature-by-feature story.
