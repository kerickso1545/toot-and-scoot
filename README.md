# Toot and Scoot

A 3D fart-battle arena game in a bathroom-themed maze, designed by Otto and
built with Claude. Blast the toilet paper, out-toot your rivals, and be the
last one standing!

## Play it on the TV (NVIDIA Shield)

This is how Otto plays: an app on the Shield home screen, no laptop, no
browser, no internet.

Install it with ADB from a machine on the same network:

```
adb connect <shield-ip>:5555
adb install -r packaging/android/app/build/outputs/apk/debug/app-debug.apk
```

(Enable **Settings -> Device Preferences -> About -> Build** x7, then
**Developer options -> Network debugging** to get the IP. Accept the
authorization prompt on the TV.)

Then launch **Toot and Scoot** from the Shield home screen and pair your
controllers in Settings. The Shield handles four; the game seats three.
The whole game is inside the APK, so **it never needs internet**.

To rebuild after changing the game:

```
cd packaging
npm run apk
```

### Do not play this in a TV browser

It looks like it should work and it doesn't. Tested on TV Bro 2.1.6 with a
Nintendo Switch Pro Controller: the pad enumerates perfectly
(`map:standard`), buttons south and north reach the game -- and the sticks
read `0.00` forever, because the browser swallows the stick and d-pad to
drive its own on-screen cursor and maps the east button to Back. You get a
character who can fart but cannot walk.

Puffin TV is worse: it renders pages on its own servers and streams the
picture, so the game would run in a datacenter and never see your
controllers at all.

Pointing a TV browser at a LAN address fails differently and just as
confusingly: browsers only expose the Gamepad API on secure origins, so
`http://192.168.x.x` gives you a game that loads perfectly where no
controller does anything. The APK sidesteps all of this -- Capacitor serves
the bundled copy from `https://localhost`, which is a secure context, and
nothing sits between the pad and the game.

## Play it in a browser

**https://kerickso1545.github.io/toot-and-scoot/** -- works on a desktop or
laptop browser, and installs as an app on a phone or tablet
(*Install app* / *Add to Home screen*). Plays offline after the first load.
Controllers work anywhere the origin is https.

## Play it on a computer

**Double-click `play.py`** — it starts a tiny local server and opens the game
in your browser automatically (keep the console window open while playing;
press ESC or close it to stop). It also live-reloads the page whenever a game
file changes — waiting politely until you're back at the title screen if a
match is running. Needs Python 3 installed; **no internet required**, since
Three.js is vendored in `vendor/`.

Other devices on your wifi can load it too (the console prints the address),
but see the warning above — controllers will not work over a LAN address.
Each device keeps its own high scores.

**Boss mode**: `python play.py --boss` adds a "Start at level" picker to the
main menu (1 / 5 / 10 / 15 / 20 / 25 — bosses are every 5th level, and higher
levels are harder, just like getting there the long way). `--level N` also
still works to set a start level directly without the picker.

Best played with Bluetooth/USB controllers; keyboard + mouse also fully
supported.

## Modes
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

## Controls
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
the next player slot. Then:

| | Controller | Keyboard |
|---|---|---|
| Pick your character | ◀ ▶ | arrows |
| Get **READY** | south (**B** on Switch, **A** on Xbox) | Enter |
| Un-ready / leave | east (**A** on Switch, **B** on Xbox) | Esc |
| Mode / Difficulty / How to play / Exit | **D-pad Down**, then ◀ ▶ | Down, then arrows |
| **START** | south, once everyone is ready | Enter |

Everyone readies on their own card, then somebody presses **START** — it stays
greyed out until the whole group is ready, and tells you which player it's
still waiting on. Any player can reach the shared settings row, not just
Player 1; **Up** from the top of that row goes back to your card.

Every on-screen hint names the button **as it is labelled on your own
controller** — a Switch pad is told to press B where an Xbox pad is told to
press A. The mouse can still click anything directly.

## Core mechanics
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

## Tech notes
- Plain HTML/CSS/JS files (no build step): `toot-and-scoot.html` shell +
  `css/style.css` + ten `js/*.js` scripts loaded in order; Three.js r128
  vendored locally (no external references anywhere — the game is fully
  self-contained at about 1 MB); a service worker (`sw.js`) precaches
  everything so the installed app plays offline; Web Audio API for all sound (synthesized fart voices per
  character); Gamepad API; localStorage for the leaderboard
- All five themes drawn procedurally in code (canvas textures) — porcelain
  tile, mossy sewer brick, caution stripes, marble and gold, and themed
  crates (TP rolls, goo barrels, porta-potties); trap walls stay frosted and
  readable in every theme
- Fart clouds are a pooled particle system; floors and walls render as
  instanced meshes so 3-player split screen stays fast

## Development

Built iteratively in Claude sessions — Otto designs, Claude implements.
See `activitylog.md` and the git history for the feature-by-feature story,
`ARCHITECTURE.md` for the code map, and `DESIGN-DECISIONS.md` for why things
are the way they are.

This game used to live in the `otto-games` repo alongside other experiments;
it was split out (with its history) in November 2026 so it could be developed
and shipped on its own. `otto-games` still holds lake-town, chess-coach, and
the frozen 2D/3D prototypes.
