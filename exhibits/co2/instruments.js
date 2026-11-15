// =============================================================================
// CARBON CURRENTS · the instrument. A synthesised piano whose loudness AND
// brightness follow intensity (like hitting the keys harder), plus the output
// chain (compressor + soft echo).
// =============================================================================
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

export function createAudio({ volume = 0.8, echoTime = 60 / 84 / 2 * 3 } = {}) {
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 2.5; comp.knee.value = 8;
  const master = ac.createGain(); master.gain.value = volume; master.connect(comp); comp.connect(ac.destination);
  const dl = ac.createDelay(1.5), fb = ac.createGain(), wet = ac.createGain(), lp = ac.createBiquadFilter();
  dl.delayTime.value = echoTime; fb.gain.value = 0.22; wet.gain.value = 0.16; lp.type = 'lowpass'; lp.frequency.value = 2400;
  master.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(comp);
  const inst = ac.createGain(); inst.connect(master);

  // partials: [harmonic, waveform, level(I)]
  const PARTIALS = [[1, 'sine', () => 1], [2, 'sine', I => 0.08 + 0.4 * I], [3, 'triangle', I => 0.02 + 0.22 * I], [4, 'sine', I => 0.12 * I * I]];

  function piano(m, t, I = 0.62, pan = 0, accent = false) {
    const f = mtof(m), g = ac.createGain(), flt = ac.createBiquadFilter();
    const amp = 0.2 * Math.pow(10, (-34 + 34 * I) / 20) * (accent ? 1.5 : 1); // 34 dB range: whisper → forte
    flt.type = 'lowpass'; flt.frequency.value = 450 + 6500 * Math.pow(I, 1.4) + (accent ? 1500 : 0); flt.Q.value = 0.5;
    const dur = 0.9 + 1.4 * I;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), t + 0.006);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, amp * 0.3), t + 0.22); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const [h, type, lvl] of PARTIALS) {
      const o = ac.createOscillator(), og = ac.createGain(); o.type = type; o.frequency.value = f * h; og.gain.value = lvl(I);
      o.connect(og); og.connect(flt); o.start(t); o.stop(t + dur + 0.05);
    }
    flt.connect(g);
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(inst); } else g.connect(inst);
  }

  return { ac, master, piano, setVolume: v => master.gain.setTargetAtTime(v, ac.currentTime, 0.05) };
}
