// =============================================================================
// AEROSOLS · the orchestra. Pure Web Audio synthesis, no samples.
// Each instrument: (dest, freq, t, vel 0..1) → schedules one note.
// Tweak envelopes, filters and partials here to change the character.
// =============================================================================

export function createInstruments(ac) {
  const noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const osc = (type, f, det = 0) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det; return o; };
  const env = (dest, t) => { const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.connect(dest); return g; };

  const INSTRUMENTS = {
    // sulfates: cold glass celesta with an inharmonic shimmer
    glass(dest, f, t, vel) {
      const g = env(dest, t), pk = 0.15 * vel;
      const o = osc('sine', f), o2 = osc('sine', f * 3.01), o3 = osc('sine', f * 5.4), g2 = ac.createGain(), g3 = ac.createGain();
      g2.gain.value = 0.14; g3.gain.value = 0.04; o.connect(g); o2.connect(g2); g2.connect(g); o3.connect(g3); g3.connect(g);
      g.gain.exponentialRampToValueAtTime(pk, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      [o, o2, o3].forEach(x => { x.start(t); x.stop(t + 2.7); });
    },
    // smoke: low pizzicato strings, short and dry
    pizz(dest, f, t, vel) {
      const g = env(dest, t), pk = 0.13 * vel;
      const o = osc('sawtooth', f), o2 = osc('triangle', f / 2), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
      lp.frequency.setValueAtTime(500 + vel * 2600, t); lp.frequency.exponentialRampToValueAtTime(220, t + 0.35);
      o.connect(lp); o2.connect(lp); lp.connect(g);
      g.gain.exponentialRampToValueAtTime(pk, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      o.start(t); o2.start(t); o.stop(t + 0.75); o2.stop(t + 0.75);
    },
    // dust: a slow section of low bowed strings with vibrato
    strings(dest, f, t, vel) {
      const g = env(dest, t), pk = 0.09 * vel;
      const o = osc('sawtooth', f, -9), o2 = osc('sawtooth', f, 9), o3 = osc('triangle', f / 2);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380 + vel * 1100;
      const vib = osc('sine', 4.6), vg = ac.createGain(); vg.gain.value = f * 0.006; vib.connect(vg); [o, o2].forEach(x => vg.connect(x.frequency));
      [o, o2, o3].forEach(x => x.connect(lp)); lp.connect(g);
      g.gain.exponentialRampToValueAtTime(pk, t + 0.7); g.gain.setTargetAtTime(0.0001, t + 2.0, 0.6);
      [o, o2, o3, vib].forEach(x => { x.start(t); x.stop(t + 4.2); });
    },
    // sea salt: a distant, breathy choir ("ah" vowel formants over a soft saw)
    choir(dest, f, t, vel) {
      const g = env(dest, t), pk = 0.11 * vel, mix = ac.createGain(); mix.gain.value = 1;
      const src = [osc('sawtooth', f, -6), osc('sawtooth', f, 7)];
      src.forEach(s => s.connect(mix));
      [[800, 8, 1], [1150, 9, 0.6], [2900, 12, 0.25]].forEach(([fr, q, a]) => {
        const bp = ac.createBiquadFilter(), bg = ac.createGain(); bp.type = 'bandpass'; bp.frequency.value = fr; bp.Q.value = q; bg.gain.value = a;
        mix.connect(bp); bp.connect(bg); bg.connect(g);
      });
      g.gain.exponentialRampToValueAtTime(pk, t + 0.5); g.gain.setTargetAtTime(0.0001, t + 1.8, 0.7);
      src.forEach(s => { s.start(t); s.stop(t + 4); });
    },
    // simple soft sine (spare voice for new layers)
    soft(dest, f, t, vel) {
      const g = env(dest, t), pk = 0.13 * vel, o = osc('sine', f), o2 = osc('triangle', f * 2, 4), g2 = ac.createGain(); g2.gain.value = 0.12;
      o.connect(g); o2.connect(g2); g2.connect(g);
      g.gain.exponentialRampToValueAtTime(pk, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      o.start(t); o2.start(t); o.stop(t + 2.5); o2.stop(t + 2.5);
    },
  };

  // ember crackle (added on top of smoke notes)
  function crackle(dest, t, vel) {
    const n = 1 + Math.floor(vel * 4);
    for (let i = 0; i < n; i++) {
      const tt = t + Math.random() * 0.14, s = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = env(dest, tt);
      s.buffer = noise; bp.type = 'bandpass'; bp.frequency.value = 2500 + Math.random() * 5000; bp.Q.value = 2; s.connect(bp); bp.connect(g);
      g.gain.exponentialRampToValueAtTime(0.11 * vel, tt + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.03 + Math.random() * 0.03);
      s.start(tt, Math.random() * 1.5); s.stop(tt + 0.08);
    }
  }

  // continuous beds: return { set(level 0..1, t), stop() }
  const BEDS = {
    ocean(dest) {
      const src = ac.createBufferSource(); src.buffer = noise; src.loop = true;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
      const g = ac.createGain(); g.gain.value = 0;
      const lfo = osc('sine', 0.09), lg = ac.createGain(); lg.gain.value = 240; lfo.connect(lg); lg.connect(lp.frequency);
      src.connect(lp); lp.connect(g); g.connect(dest); src.start(); lfo.start();
      return { set: (lvl, t) => { g.gain.setTargetAtTime(lvl * 0.2, t, 0.5); lp.frequency.setTargetAtTime(320 + lvl * 800, t, 0.5); }, stop: () => { try { src.stop(); lfo.stop(); } catch {} } };
    },
    drone(dest, rootHz) {
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3; f.frequency.value = 200;
      const g = ac.createGain(); g.gain.value = 0;
      const os = [1, 1, 1.5].map((m, i) => { const o = osc(i < 2 ? 'sawtooth' : 'sine', rootHz * m, i === 1 ? 9 : 0); o.connect(f); o.start(); return o; });
      f.connect(g); g.connect(dest);
      return { set: (lvl, t) => { g.gain.setTargetAtTime(0.012 + lvl * 0.1, t, 0.25); f.frequency.setTargetAtTime(120 + lvl * 1800, t, 0.25); }, stop: () => os.forEach(o => { try { o.stop(); } catch {} }) };
    },
  };

  function impulse(dur, decay) {
    const len = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }

  return { INSTRUMENTS, crackle, BEDS, impulse };
}
