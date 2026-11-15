// =============================================================================
// THE WANING CANOPY · data → music rules. Tune the requiem here.
// =============================================================================
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const RULES = {
  maxHeight: 50,          // m: canopy at or above this plays the top bell
  lossThreshold: 15,      // m: below this the forest counts as thinned/lost → toll instead of bell
  dropThreshold: 8,       // m: a fall this big between neighbours → a sigh
  giantThreshold: 40,     // m: announced as a giant
  stepSeconds: 0.5,       // time between footprints while the station sweeps (funereal pace)
  passGapSeconds: 3.5,    // silence between passes
  root: 33,               // MIDI A1: drone root
  scale: [0, 1, 3, 5, 7, 8, 10],   // Phrygian: dark, grieving
  bellLow: 57, bellHigh: 88,       // MIDI range for bells (A3 → E6)
};

/** canopy height → bell MIDI note, snapped to the scale */
export function bellNote(h) {
  const t = clamp(h / RULES.maxHeight, 0, 1), target = RULES.bellLow + t * (RULES.bellHigh - RULES.bellLow);
  let best = RULES.bellLow, bd = 99;
  for (let m = RULES.bellLow - 12; m <= RULES.bellHigh + 12; m++) {
    if (!RULES.scale.includes(((m - RULES.root) % 12 + 12) % 12)) continue;
    const d = Math.abs(m - target); if (d < bd) { bd = d; best = m; }
  }
  return best;
}

/** colour of a living footprint (bark brown → deep green → pale, luminous green for giants) */
export function heightColor(h) {
  const t = clamp(h / 55, 0, 1);
  if (t < 0.35) return [92 - t * 180, 64 + t * 85, 51 - t * 50];
  if (t < 0.75) return [27 + (t - 0.35) * 100, 94 + (t - 0.35) * 300, 32 + (t - 0.35) * 285];
  return [67 + (t - 0.75) * 750, 214 + (t - 0.75) * 160, 146 + (t - 0.75) * 430].map(v => Math.min(255, v));
}
export const ASH = [96, 92, 88];
