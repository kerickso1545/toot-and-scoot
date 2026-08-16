# Otto's Games

Games designed by Otto, built with Claude.

## Toot and Scoot (`toot-and-scoot.html`)

A 3D fart-battle arena game in a bathroom-themed maze. **To play:
double-click `play.py`** — it starts a tiny local server and opens the game
in your browser automatically (keep the console window open while playing;
press ESC or close it to stop). Other devices on your wifi can play too —
the console prints the address to type into their browser (each device
keeps its own high scores; Windows Firewall may ask to allow Python once). It also live-reloads the page whenever a
game file changes — waiting politely until you're back at the title screen
if a match is running. Needs Python 3 installed, and internet the first time to
load the Three.js library. Opening `toot-and-scoot.html` directly also still
works, but the high-score leaderboard is saved separately per method — stick
with `play.py`. Best played with Bluetooth/USB controllers; keyboard + mouse
also fully supported.

**Boss mode**: `python play.py --boss` adds a "Start at level" picker to the
main menu (1 / 5 / 10 / 15 / 20 / 25 — bosses are every 5th level, and higher
levels are harder, just like getting there the long way). `--level N` also
still works to set a start level directly without the picker.

### Modes
- **1 player** — level campaign with rising difficulty, scoring, and a
  persistent local leaderboard (top 10, classic 3-initial entry; every entry
  shows the difficulty it was earned on)
- **2 player split screen** and **3 player quadrant view** (third-person
  cameras; the 3P fourth quadrant is a live bird's-eye view). Pick your style
  with the **Team up?** toggle on the setup screen:
  - **Free-for-all** (default) — battle royale, humans vs humans vs rivals;
    last one standing wins the round (+500).
  - **Team up! (co-op)** — you and your friends are on the same side against
    the rivals. Your farts **can't hurt teammates** (rivals and your own
    self-gas still can!). Clear every rival together to beat the level and
    split the +500. If a teammate gets gassed they go **DOWN** with a
    5-second timer — run to them to **revive** them (brief invincible
    speed-boost to escape). Miss the window and they spectate until the round
    ends. The team only loses when everyone is down at once.
  - Either way, everyone advances to the next level together; per-player win
    tally and score.
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

**In the character-select lobby:** press a face button on a controller to join
the next player slot, then **◀ ▶ pick your character** and a face button to
**READY** (the game starts once everyone's ready). To reach the shared **Mode**,
**Difficulty**, and **How to play** options, press **D-pad Down** to hop from
your card onto that row — ◀ ▶ change the setting, **Down/Up** move between rows,
and **Up** from the top row jumps back to your card. Any player can do this, not
just Player 1. (Keyboard: arrows pick character, Enter readies, Down reaches the
shared row; the mouse can click anything directly.)

### Core mechanics
- Farts linger, then spread fast in four directions; blasts punch through
  crates but stop at walls. Your own farts never set each other off (Extra
  Gas double-toots keep their own fuses) — but a rival's fart caught in your
  blast still chains — and now erupt as **billowing green gas clouds**
  that swell, drift, and fade (boss blasts get their own menacing tint),
  with a little screen shake when one goes off near you (toggle it off in
  Settings: "Screen shake")
- **Power-ups** (hold one, A to use): Extra Gas, Big Blast, Trap Wall,
  Air Freshener, Turbo Toot (blinds a victim for 5 s — pitch black screen for
  human victims)
- **Legendary finds** (indestructible): Can of Beans (10% of drops — 6 s fart
  trail; the toots pop one at a time in drop order, never all at once, so you
  can outrun your own trail), rainbow **Extra Life** (2% — auto-revive with 2 s
  invincible double-speed escape; avatar shimmers rainbow while carried)
- **Superpowers** (X, one per level, rotating): Gas Mask, Silent But Deadly,
  Dutch Oven, Pyroflatulence (a fire-charged orange toot whose blast also
  burns one tile sideways off both arms — the step-aside dodge doesn't work,
  not even for you)
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
- **Boss every 5th level**: The Big Stinker — 600/800/1000 HP by difficulty
  (6-10 hits), 100 damage per blast, health bar, boss arena. He dodges any
  fart he can see, but he **can't see farts dropped behind his back** — bait
  him, circle around, sneak-toot
- **Six rivals** with signature hats and synthesized fart voices; smarter,
  faster, and more numerous as levels climb — and they always spawn a safe
  distance from you (you spawn facing your escape route, never a wall)
- **"3, 2, 1, SCOOT!!" countdown** at every level start: everyone's frozen
  while big numbers count down in each player's viewport, with a P1/P2/P3
  badge floating over each player's head so nobody loses themselves after a
  split-screen level change
- **Results screen** after every run: score, level reached, rivals gassed,
  TP shredded, self-gasses, items used, and fastest level — with Retry same
  setup / Change setup / Main menu. **Retry continues from the level you
  died on** (fresh score); the title screen always starts a new campaign
- **Lego-style camera**: a raised follow angle that clears the maze walls, so
  the view never gets shoved into your character's face — and if a wall does
  briefly block your camera, you see your character glowing right through it
- **Scoring**: 10 per crate, 100 per rival, 200 per player KO, 500 per
  level/round win, boss hits 100 each + 1000 bonus
- HUD: kart-racer style panels, item boxes with button labels, minimap
  (1P/2P), stamina bar, boss bar; in split screen every player tile matches
  the 1P panel look, and level/difficulty/rivals get their own game tile

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
