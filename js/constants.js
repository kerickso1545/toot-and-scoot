var COLS = 15, ROWS = 13, TS = 2;           // tile size in world units
// The Big Stinker shows up every BOSS_EVERY levels (5, 10, 15, ...).
// THE one place the boss cadence lives — maze, theme, spawn, and level
// messages all ask isBossLevel().
var BOSS_EVERY = 5;
function isBossLevel(l) { return l % BOSS_EVERY === 0; }
// ---- boss mode / start level (set by play.py --boss / --level N) ----
// Parsed here (before ui.js builds the title-menu rows) — depends only on the
// browser's location global. bossMode shows the start-level picker row;
// startAtLevel is where every new game begins.
var startAtLevel = 1, bossMode = false;
(function () {
  if (typeof location === 'undefined') return;   // headless test harnesses
  bossMode = /[?&]boss=1/.test(location.search);
  var m = /[?&]level=(\d+)/.exec(location.search);
  if (m) startAtLevel = Math.max(1, Math.min(99, parseInt(m[1], 10) || 1));
})();
// ---- personas: players pick one of the game's characters (Mario-Kart style) ----
// name + body color; the hat comes from HATMAP[name] (meshes.js) and the fart
// voice from FARTS[name] (below). A persona a human takes is removed from the
// enemy pool that match (see startLevel), so you never fight your own character.
// Colors match the old enemy botDefs so the characters look identical whether
// human- or AI-controlled.
var PERSONAS = [
  { name: 'Sir Toots-a-Lot', color: 0xab47bc },
  { name: 'Stinky Pete',     color: 0xff7043 },
  { name: 'Windy Wendy',     color: 0xfdd835 },
  { name: 'Princess Poot',   color: 0xec407a },
  { name: 'Gassy Gus',       color: 0x26c6da },
  { name: 'Captain Cheeks',  color: 0xeceff1 }
];
var PU_NAME = { bomb: 'EXTRA GAS', range: 'BIG BLAST', speed: 'SUPER SCOOT', wall: 'TRAP WALL', spray: 'AIR FRESHENER', turbo: 'TURBO TOOT' };
var PU_COLOR = { bomb: '#ffab40', range: '#ff5252', speed: '#40c4ff', wall: '#66bb6a', spray: '#eceff1', turbo: '#ce93d8' };
// ---- balance caps for passive upgrades (players AND rivals) ----
var MAX_GAS = 4, MAX_BLAST = 5, MAX_SPEED = 7.0, SPEED_STEP = 0.5;
// ---- camera pitch limits (Lego-style raised follow angle) ----
// The floor is high enough that the 6.5-unit boom clears 2-unit walls in
// almost every situation, so the camera rarely needs to lift or pull in.
// (Research: Minecraft-style pull-in is the disliked model; Lego/TT games
// hold a raised angle instead.) Lower PITCH_MIN = more dramatic but more
// occlusion-prone.
var PITCH_MIN = 0.6, PITCH_MAX = 1.25;
// ---------- maze layouts: a different arena shape for every level ----------
var MAZES = [
  { name: 'Classic',    shape: 'rect',     pillars: 'grid', crate: 0.72 },
  { name: 'Octagon',    shape: 'octagon',  pillars: 'dots', crate: 0.7 },
  { name: 'Circle',     shape: 'oval',     pillars: 'ring', crate: 0.7 },
  { name: 'Triangle',   shape: 'triangle', pillars: 'diag', crate: 0.75 },
  { name: 'Diamond',    shape: 'diamond',  pillars: 'grid', crate: 0.65 },
  { name: 'Open floor', shape: 'rect',     pillars: 'none', crate: 0.82 }
];
// every character has their own fart voice:
// base = pitch, sputter = putt-putt speed, dur = length, tone = muffled vs bright
var FARTS = {
  player:            { base: 100, sputter: 18, dur: 0.55, tone: 420 },
  'Sir Toots-a-Lot': { base: 68,  sputter: 8,  dur: 0.95, tone: 350 },   // long, low, regal
  'Stinky Pete':     { base: 92,  sputter: 30, dur: 0.5,  tone: 300 },   // wet sputter
  'Windy Wendy':     { base: 185, sputter: 12, dur: 0.65, tone: 900 },   // high and whistly
  'Princess Poot':   { base: 240, sputter: 24, dur: 0.28, tone: 1100 },  // dainty little squeak
  'Gassy Gus':       { base: 52,  sputter: 6,  dur: 1.1,  tone: 260 },   // deep rumble
  'Captain Cheeks':  { base: 112, sputter: 42, dur: 0.6,  tone: 500 },   // machine-gun putt-putt
  'The Big Stinker': { base: 38,  sputter: 5,  dur: 1.5,  tone: 190 }    // the boss: an earthquake
};
