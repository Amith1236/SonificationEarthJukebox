// Hub ambience: a slow orbital pad, distant twinkles and a chime when you turn
// to a chapter. Edit PAD_CHORD / TWINKLES / CHIMES to retune it.
const PAD_CHORD = [38, 45, 50, 54, 57, 64];          // MIDI: D major add9, spread wide
const TWINKLES = [74, 76, 78, 81, 83, 86, 88];
const CHIMES = [74, 78, 81, 85, 88, 90];             // one per chapter (cycles if more)
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

export function createAmbience() {
  let ac = null, out = null, started = false, on = true, muted = false;
  const target = () => (on && !muted ? 1 : 0);

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ac.createDynamicsCompressor(); comp.connect(ac.destination);
    out = ac.createGain(); out.gain.value = 0; out.connect(comp);
    const dl = ac.createDelay(2), fb = ac.createGain(), wet = ac.createGain(), lp = ac.createBiquadFilter();
    dl.delayTime.value = 0.42; fb.gain.value = 0.45; wet.gain.value = 0.35; lp.type = 'lowpass'; lp.frequency.value = 2600;
    out.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(comp);
  }
  function bell(f, t, v) {
    const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), g2 = ac.createGain();
    o.frequency.value = f; o2.frequency.value = f * 2.76; g2.gain.value = 0.18;
    o2.connect(g2); g2.connect(g); o.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    o.start(t); o2.start(t); o.stop(t + 2.3); o2.stop(t + 2.3);
  }
  function start() {
    init(); if (started) return; started = true;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 650; f.Q.value = 0.6;
    const pg = ac.createGain(); pg.gain.value = 0.05; f.connect(pg); pg.connect(out);
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.04; lg.gain.value = 320; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    PAD_CHORD.forEach((m, k) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = k < 2 ? 'sine' : 'triangle'; o.frequency.value = mtof(m); o.detune.value = k % 2 ? 6 : -6;
      g.gain.value = k < 2 ? 0.5 : 0.22; o.connect(g); g.connect(f); o.start();
    });
    (function twinkle() {
      setTimeout(twinkle, 1600 + Math.random() * 2800);
      if (!on || muted || !ac) return;
      bell(mtof(TWINKLES[(Math.random() * TWINKLES.length) | 0]), ac.currentTime, 0.03);
    })();
    out.gain.setTargetAtTime(target(), ac.currentTime, 0.8);
  }
  return {
    start,
    get on() { return on; },
    setOn(v) { on = v; if (v) start(); if (ac) out.gain.setTargetAtTime(target(), ac.currentTime, v ? 0.8 : 0.25); },
    setMuted(v) { muted = v; if (ac) out.gain.setTargetAtTime(target(), ac.currentTime, v ? 0.25 : 0.8); },
    duck(d) { if (ac && on && !muted) out.gain.setTargetAtTime(d ? 0.35 : 1, ac.currentTime, 0.25); },
    chime(i) { if (!ac || !on || muted) return; const b = CHIMES[i % CHIMES.length]; bell(mtof(b), ac.currentTime + 0.02, 0.07); bell(mtof(b + 7), ac.currentTime + 0.14, 0.04); },
    fadeOut(s = 0.6) { if (ac) out.gain.setTargetAtTime(0, ac.currentTime, s / 3); },
  };
}
