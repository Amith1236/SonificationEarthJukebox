// =============================================================================
// THE WANING CANOPY · data → colour and music rules. Tune the piece here.
// =============================================================================

export const RULES = {
  severe: 0.65,          // dieback index at or above this → "severe dieback"
  stress: 0.40,          // … at or above this → "canopy thinning"
  diebackCount: 0.55,    // threshold for the "degraded" percentage in the drawer
  stepMs: 120,           // playback: one footprint every stepMs
  panEvery: 15,          // playback: re-centre the map every N footprints
  speakEverySec: 14,     // playback: the narrator comments at most this often
  maxHeight: 45,         // m: top of the height colour scale and pitch range
};

// the musical scale for the canopy voice (Hz): C major pentatonic-ish, low to high
export const SCALE = [130.81, 146.83, 164.81, 196.00, 220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25];

/** footprint → the four voices (frequencies in Hz, gains 0..1) */
export function voicesFor(c) {
  const stress = c.dieback_index ?? 0;
  const hIdx = Math.min(SCALE.length - 1, Math.max(0, Math.floor((c.rh100_m / RULES.maxHeight) * SCALE.length)));
  const pad = SCALE[hIdx];
  return {
    stress,
    sub: { freq: 55 + Math.min(65, Math.max(0, (c.elev_m || 0) / 15)), gain: 0.24 },   // terrain drone
    pad: { freq: pad, gain: 0.22 },                                                   // canopy height
    shimmer: { freq: pad * 2, gain: Math.max(0.02, (1 - stress) * 0.16) },              // health
    pulse: { freq: pad * (stress > 0.5 ? 1.189 : 1.5), detune: stress * 14, gain: stress * 0.12 }, // dieback: minor third vs fifth
  };
}

export const statusOf = c => ((c.dieback_index ?? 0) >= RULES.severe ? 'severe' : (c.dieback_index ?? 0) >= RULES.stress ? 'stress' : 'intact');

// ---------- colour ----------
const ramp = (stops, t) => {
  t = Math.min(1, Math.max(0, t));
  const i = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1))), f = t * (stops.length - 1) - i;
  const a = stops[i], b = stops[i + 1];
  return `rgb(${Math.round(a[0] + f * (b[0] - a[0]))},${Math.round(a[1] + f * (b[1] - a[1]))},${Math.round(a[2] + f * (b[2] - a[2]))})`;
};
const HEALTH = [[16, 185, 129], [250, 204, 21], [249, 115, 22], [239, 68, 68]];   // intact → dieback
const GROWTH = [[239, 68, 68], [245, 158, 11], [16, 185, 129], [6, 182, 212]];    // low → high

/** what the map can colour by. `css` is the legend gradient. */
export const METRICS = {
  dieback_index: { label: 'Canopy health', css: 'linear-gradient(90deg,#10b981,#facc15,#f97316,#ef4444)', ticks: ['Intact', 'Thinning', 'Dieback'], color: v => ramp(HEALTH, v) },
  rh100_m: { label: 'Canopy height', css: 'linear-gradient(90deg,#ef4444,#f59e0b,#10b981,#06b6d4)', ticks: ['0 m', '22 m', '45+ m'], color: v => ramp(GROWTH, v / RULES.maxHeight) },
  canopy_cover: { label: 'Canopy cover', css: 'linear-gradient(90deg,#ef4444,#f59e0b,#10b981,#06b6d4)', ticks: ['0%', '50%', '100%'], color: v => ramp(GROWTH, v) },
  co2e_loss_t_ha: { label: 'Carbon deficit', css: 'linear-gradient(90deg,#10b981,#facc15,#f97316,#ef4444)', ticks: ['0', '', 'high tCO₂e/ha'], color: v => ramp(HEALTH, v / 20) },
};
