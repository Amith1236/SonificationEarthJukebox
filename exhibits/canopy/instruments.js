// =============================================================================
// THE WANING CANOPY · instruments: a funeral bell, a low toll with a dissonant
// cluster, a falling sigh, and the breathing drone beneath everything.
// =============================================================================
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

export function createRequiem({ volume = 0.8 } = {}) {
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
  const master = ac.createGain(); master.gain.value = volume; master.connect(comp); comp.connect(ac.destination);
  // long, cathedral-like reverb
  const conv = ac.createConvolver(), len = Math.floor(ac.sampleRate * 5.5), ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  conv.buffer = ir; const wet = ac.createGain(); wet.gain.value = 0.55; conv.connect(wet); wet.connect(master);
  const bus = ac.createGain(); bus.connect(master); bus.connect(conv);
  const out = pan => { const g = ac.createGain(); if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(bus); } else g.connect(bus); return g; };

  // church-bell partials (ratios of a minor-third bell): hum, prime, tierce, quint, nominal…
  const BELL = [[0.5, 0.5, 1.6], [1, 1, 1.0], [1.183, 0.55, 0.8], [1.506, 0.35, 0.6], [2, 0.4, 0.55], [2.5, 0.16, 0.35], [3.0, 0.1, 0.25]];
  function bell(m, t, { vel = 0.7, sustain = 1, bright = 1, pan = 0 } = {}) {
    const f = mtof(m), g = out(pan);
    BELL.forEach(([r, a, d]) => {
      const o = ac.createOscillator(), og = ac.createGain(); o.frequency.value = f * r;
      const amp = 0.06 * vel * a * (r > 2 ? bright : 1), dur = (1.2 + 3.2 * sustain) * d;
      og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(amp, t + 0.004); og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.05);
    });
  }
  // the forest is gone: a low muffled toll with a minor-second cluster above it
  function toll(m, t, { vel = 0.7, pan = 0 } = {}) {
    const g = out(pan), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(g);
    [0, 1, 6].forEach((iv, k) => {
      const o = ac.createOscillator(), og = ac.createGain(); o.type = k ? 'triangle' : 'sine'; o.frequency.value = mtof(m + iv);
      og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.07 * vel / (k + 1), t + 0.02); og.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      o.connect(og); og.connect(lp); o.start(t); o.stop(t + 3.3);
    });
  }
  // a falling sigh when the canopy drops sharply
  function sigh(m, t, { pan = 0 } = {}) {
    const g = out(pan), o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(mtof(m), t); o.frequency.exponentialRampToValueAtTime(mtof(m - 4), t + 1.2);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(g); o.start(t); o.stop(t + 1.7);
  }
  // biomass: a soft sub under the bell
  function sub(m, t, weight) {
    const g = out(0), o = ac.createOscillator(); o.frequency.value = mtof(m);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08 * weight, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    o.connect(g); o.start(t); o.stop(t + 1.9);
  }
  // the drone: root + fifth + minor third, slowly breathing; life 0..1 opens/closes it
  let drone = null;
  function startDrone(rootMidi) {
    if (drone) return;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; lp.Q.value = 2;
    const g = ac.createGain(); g.gain.value = 0; lp.connect(g); g.connect(bus);
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 120; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    const os = [0, 7, 12, 15].map((iv, k) => { const o = ac.createOscillator(); o.type = k < 2 ? 'sawtooth' : 'sine'; o.frequency.value = mtof(rootMidi + iv); o.detune.value = (k % 2 ? 5 : -5); o.connect(lp); o.start(); return o; });
    drone = { lp, g, os, lfo };
  }
  function setDrone(level, life) {
    if (!drone) return; const t = ac.currentTime;
    drone.g.gain.setTargetAtTime(0.05 * level, t, 0.8);
    drone.lp.frequency.setTargetAtTime(160 + 900 * life, t, 1.2);
  }

  return { ac, master, bell, toll, sigh, sub, startDrone, setDrone, setVolume: v => master.gain.setTargetAtTime(v, ac.currentTime, 0.05) };
}
