// =============================================================================
// THE WANING CANOPY · the four synthesised voices.
// Sub-bass drone, canopy voice, health shimmer, dieback pulse, all through one
// low-pass filter. voicesFor() in mapping.js decides what they play.
// =============================================================================

export function createVoices(ac) {
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass'; filter.frequency.value = 650; filter.Q.value = 0.7;
  const master = ac.createGain(); master.gain.value = 0.11;
  const volume = ac.createGain(); volume.gain.value = 0.8;
  filter.connect(master); master.connect(volume); volume.connect(ac.destination);

  const make = type => {
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = type; g.gain.value = 0; osc.connect(g); g.connect(filter); osc.start();
    return { osc, g };
  };
  const V = { sub: make('sine'), pad: make('sine'), shimmer: make('sine'), pulse: make('triangle') };
  const T = 0.35;   // glide time constant (s)

  return {
    play(v) {
      const now = ac.currentTime;
      for (const k of Object.keys(V)) {
        V[k].osc.frequency.setTargetAtTime(v[k].freq, now, T);
        V[k].g.gain.setTargetAtTime(v[k].gain, now, T);
      }
      V.pulse.osc.detune.setTargetAtTime(v.pulse.detune, now, T);
    },
    silence() { const now = ac.currentTime; Object.values(V).forEach(x => x.g.gain.setTargetAtTime(0, now, 0.08)); },
    setVolume(x) { volume.gain.setTargetAtTime(x, ac.currentTime, 0.05); },
  };
}
