// =============================================================================
// CARBON CURRENTS · data → music rules. ONE piano, ONE melody, ONE volume;
// the TEMPO follows the RISE and FALL of CO₂ over the last 4 hours.
// =============================================================================
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const BPM_MIN = 28, BPM_MAX = 260;              // falling fast → rising fast
export const PHRASE = [62, 65, 69, 67, 65, 69, 74, 69]; // fixed melody (D minor); pitch never carries data
export const PPM_LO = 410, PPM_HI = 460;
export const RISE_WINDOW_H = 4;                        // hours over which the change is measured
export const TEMPO_GLIDE_S = 0.35;                     // how quickly the tempo follows a change
export const TEMPO = [[45, 'crawling'], [70, 'very slow'], [92, 'slow'], [125, 'walking pace'], [165, 'brisk'], [215, 'fast'], [999, 'racing']];

/** I = intensity 0..1 (how high CO₂ is), r = change in ppm over RISE_WINDOW_H. Rising ≥1 ppm → racing; falling ≥1 ppm → crawling. */
export function bpmOf(I, r) {
  const base = 85 + 30 * I, a = Math.abs(r), x = a < 0.12 ? 0 : (a - 0.12) / 0.88;
  const g = r > 0 ? 1.25 * Math.min(x, 1) + 0.3 * clamp(x - 1, 0, 1) : -1.65 * Math.min(x, 1) - 0.2 * clamp(x - 1, 0, 1);
  return clamp(base * Math.pow(2, g), BPM_MIN, BPM_MAX);
}
export function changeWord(r) {
  const a = Math.abs(r), amt = (r > 0 ? '+' : '−') + a.toFixed(1) + ' ppm in 4 h';
  if (a < 0.12) return 'steady';
  if (r > 0) return (a >= 1 ? 'rising fast ↑↑' : 'rising ↑') + ' (' + amt + ')';
  return (a >= 1 ? 'falling fast ↓↓' : 'falling ↓') + ' (' + amt + ')';
}
export const tempoWord = b => TEMPO.find(t => b < t[0])[1];
export const band = p => (p < 420 ? 0 : p < 430 ? 1 : p < 440 ? 2 : p < 450 ? 3 : 4);
/** blend of the absolute level and this place's own range, so local rises are always obvious */
export function intensityOf(p, local) {
  const abs = clamp((p - PPM_LO) / (PPM_HI - PPM_LO), 0, 1), rel = clamp((p - local.lo) / (local.hi - local.lo), 0, 1);
  return clamp(0.4 * abs + 0.6 * rel, 0, 1);
}

// NASA SVS #5196 colour bar: [ppm, r, g, b, alpha]
const STOPS = [[420, 245, 225, 150, 0.30], [430, 240, 190, 100, 0.55], [440, 232, 135, 74, 0.72], [450, 225, 95, 55, 0.82], [460, 210, 55, 42, 0.9]];
export function colorOf(p) {
  if (p < 418) return null;
  if (p < 420) return [245, 225, 150, (p - 418) / 2 * 0.3];
  if (p >= 460) return STOPS[4].slice(1);
  for (let i = 0; i < 4; i++) if (p < STOPS[i + 1][0]) {
    const a = STOPS[i], b = STOPS[i + 1], t = (p - a[0]) / (b[0] - a[0]);
    return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t, a[4] + (b[4] - a[4]) * t];
  }
}
