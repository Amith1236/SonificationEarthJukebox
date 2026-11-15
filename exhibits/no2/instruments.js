// =============================================================================
// NITROGEN DIOXIDE · instruments: bright pluck, warm Rhodes, bowed cello and a
// continuous drone that morphs with the mood. An analyser feeds the waveform view.
// =============================================================================

export function createNo2Audio({ volume = 0.75 } = {}) {
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const master = ac.createGain(); master.gain.value = volume;
  const analyser = ac.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.82;
  master.connect(analyser); analyser.connect(ac.destination);

  // drone
  const droneFilter = ac.createBiquadFilter(); droneFilter.type = 'lowpass'; droneFilter.frequency.value = 1200; droneFilter.Q.value = 2;
  const droneGain = ac.createGain(); droneGain.gain.value = 0;
  const d1 = ac.createOscillator(), d2 = ac.createOscillator(); d1.type = 'sawtooth'; d2.type = 'triangle'; d1.frequency.value = 261.63; d2.frequency.value = 329.63;
  const vib = ac.createOscillator(), vibGain = ac.createGain(); vib.frequency.value = 5; vibGain.gain.value = 0.5;
  vib.connect(vibGain); vibGain.connect(d1.frequency); vibGain.connect(d2.frequency);
  d1.connect(droneFilter); d2.connect(droneFilter); droneFilter.connect(droneGain); droneGain.connect(master);
  d1.start(); d2.start(); vib.start();

  function setDrone(mood, cutoff, darkness, active) {
    const now = ac.currentTime;
    if (!active) { droneGain.gain.setTargetAtTime(0, now, 0.12); return; }
    droneFilter.frequency.setTargetAtTime(cutoff, now, 0.08);
    d1.type = mood.drone.types[0]; d2.type = mood.drone.types[1];
    d1.frequency.setTargetAtTime(mood.drone.freqs[0], now, 0.08); d2.frequency.setTargetAtTime(mood.drone.freqs[1], now, 0.08);
    vibGain.gain.setTargetAtTime(mood.id === 'sad' ? mood.drone.vibrato * darkness : mood.drone.vibrato, now, 0.1);
    droneGain.gain.setTargetAtTime(mood.drone.gain, now, 0.1);
  }

  const voice = (types, freqs, t, filt, envPeak, attack, release, extra) => {
    const f = ac.createBiquadFilter(), env = ac.createGain(); f.type = 'lowpass';
    filt(f, t);
    env.gain.setValueAtTime(0.001, t); env.gain.linearRampToValueAtTime(envPeak, t + attack); env.gain.exponentialRampToValueAtTime(0.001, t + release);
    const os = types.map((ty, i) => { const o = ac.createOscillator(); o.type = ty; o.frequency.setValueAtTime(freqs[i], t); o.connect(f); o.start(t); o.stop(t + release + 0.03); return o; });
    f.connect(env); env.connect(master);
    if (extra) extra(os, t, release);
  };

  const INSTRUMENTS = {
    // bright harp/marimba with a sparkling octave
    pluck: (freq, t, d) => voice(['triangle', 'sine'], [freq, freq * 2], t, (f, t) => { f.frequency.setValueAtTime(3600 + (1 - d) * 2400, t); f.frequency.exponentialRampToValueAtTime(1400, t + 0.28); }, 0.22, 0.012, 0.3),
    // warm electric piano with gentle chorus detune
    rhodes: (freq, t) => voice(['sine', 'triangle'], [freq, freq * 1.003], t, (f, t) => { f.frequency.setValueAtTime(1900, t); f.frequency.exponentialRampToValueAtTime(800, t + 0.45); }, 0.2, 0.03, 0.5),
    // bowed cello with a sub-octave and weeping vibrato
    cello: (freq, t, d) => voice(['sawtooth', 'sine'], [freq, freq * 0.5], t, (f, t) => {
      const c = Math.max(420, Math.round(1150 * (1 - (d - 0.5) * 0.9))); f.frequency.setValueAtTime(c, t); f.frequency.exponentialRampToValueAtTime(c * 0.65, t + 0.85); f.Q.value = 2.5;
    }, 0.22, 0.16, 0.95, (os, t, rel) => {
      const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.setValueAtTime(4.8, t); lg.gain.setValueAtTime(3.2 * d, t); lfo.connect(lg); lg.connect(os[0].frequency); lfo.start(t); lfo.stop(t + rel + 0.03);
    }),
  };

  return { ac, analyser, setDrone, INSTRUMENTS, setVolume: v => master.gain.setTargetAtTime(v, ac.currentTime, 0.05),
    resume: () => ac.state === 'suspended' && ac.resume() };
}
