// =============================================================================
// Guided melody model (shared, any exhibit can use it).
//
// An order-2 Markov model over melodic steps in scale degrees, trained offline
// on folk tunes (public/data/models/essen-markov.json). Guided decoding:
//
//   score(step) = (1 − f) · log P_model(step | last two steps) − f · k · |degree − data target|
//
// f = "fidelity" (the Data ↔ Music slider): 1 → notes follow the data exactly;
// 0 → the model's own phrasing (kept inside the voice's range).
// =============================================================================

export async function loadMelodyModel(url = '/data/models/essen-markov.json') {
  try { const r = await fetch(url); if (!r.ok) throw new Error(r.status); return await r.json(); }
  catch (e) { console.warn('Melody model unavailable, falling back to pure data mapping', e); return null; }
}

export function createGuidedMelody(model, { temperature = 0.55, dataWeight = 1.6 } = {}) {
  const voices = {};               // per-voice state { deg, h1, h2, dur, next }

  function stepProbs(h2, h1) {
    const p0 = model.P0, p1 = h1 == null ? p0 : model.P1[h1], p2 = h1 != null && h2 != null ? model.P2[`${h2},${h1}`] : null;
    return p0.map((v, i) => (p2 ? 0.62 * p2[i] + 0.3 * p1[i] + 0.08 * v : 0.85 * p1[i] + 0.15 * v));
  }

  return {
    get model() { return model; },
    reset() { for (const k in voices) delete voices[k]; },

    /** Next scale degree for voice `id`, pulled toward `target`, kept inside [lo, hi]. */
    degree(id, target, [lo, hi], f) {
      let st = voices[id];
      if (!st || Math.abs(st.deg - target) > 9) st = voices[id] = { deg: Math.round(target), h1: null, h2: null, dur: 2, next: 0 };
      if (!model || f >= 0.99) { st.deg = Math.round(target); return st.deg; }
      const P = stepProbs(st.h2, st.h1), w = []; let sum = 0;
      model.steps.forEach((k, i) => {
        const d = st.deg + k;
        if (d < lo - 1 || d > hi + 1) { w.push(0); return; }
        const x = Math.exp(((1 - f) * Math.log(P[i]) - f * dataWeight * Math.abs(d - target)) / temperature);
        w.push(x); sum += x;
      });
      if (!sum) { st.deg = Math.round(Math.max(lo, Math.min(hi, target))); return st.deg; }
      let r = Math.random() * sum, i = 0; while (r > w[i]) { r -= w[i]; i++; }
      const k = model.steps[i]; st.h2 = st.h1; st.h1 = k; st.deg += k; return st.deg;
    },

    /** Learned rhythm: is voice `id` allowed to play on this step? */
    rhythmGate(id, step, f) { const m = voices[id]; return !model || f >= 0.99 || !m || step >= m.next; },

    /** After a note: wait a duration drawn from P(dur | previous dur). Dense data tightens the rhythm. */
    advanceRhythm(id, step, density) {
      const m = voices[id]; if (!model || !m) return;
      const p = model.D1[m.dur] || model.D0; let r = Math.random(), i = 0;
      while (i < p.length - 1 && r > p[i]) { r -= p[i]; i++; }
      m.dur = model.durs[i];
      m.next = step + Math.max(1, Math.round(m.dur * (1.5 - density)));
    },
  };
}
