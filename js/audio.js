// ---------- sounds ----------
var actx = null;
function ownerProfile(owner) {
  return (owner && owner.name && FARTS[owner.name]) || FARTS.player;
}

function fart(p, big) {
  if (!soundOn) return;
  p = p || FARTS.player;
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    var t0 = actx.currentTime;
    var dur = p.dur * (big ? 1.25 : 1);
    var f0 = p.base * (0.9 + Math.random() * 0.25) * (big ? 0.85 : 1);

    var o = actx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(28, f0 * 0.45), t0 + dur);

    // muffled body via lowpass filter
    var lp = actx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = p.tone;
    lp.Q.value = 5;

    var g = actx.createGain();
    var vol = big ? 0.3 : 0.22;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

    // putt-putt sputter (square LFO chopping the volume)
    var lfo = actx.createOscillator(), lg = actx.createGain();
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(p.sputter * (0.85 + Math.random() * 0.3), t0);
    lfo.frequency.linearRampToValueAtTime(p.sputter * 0.55, t0 + dur);
    lg.gain.value = vol * 0.55;
    lfo.connect(lg); lg.connect(g.gain);

    // wobbly pitch vibrato
    var vib = actx.createOscillator(), vg = actx.createGain();
    vib.type = 'sine';
    vib.frequency.value = 8 + Math.random() * 8;
    vg.gain.value = f0 * 0.13;
    vib.connect(vg); vg.connect(o.frequency);

    o.connect(lp); lp.connect(g); g.connect(actx.destination);
    o.start(t0); lfo.start(t0); vib.start(t0);
    o.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05); vib.stop(t0 + dur + 0.05);
  } catch (e) {}
}
function snd(freq, dur, type) {
  if (!soundOn) return;
  try {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    var o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.13, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur);
  } catch (e) {}
}
