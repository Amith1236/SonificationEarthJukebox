// =============================================================================
// AEROSOLS · data → sound mapping. One entry per particle type.
//   classify(r,g,b) → 0..1   how strongly this pixel colour means this particle
//   inst            → instrument name in instruments.js
//   bed             → optional continuous texture ('ocean' | 'drone') that follows coverage
//   reg [lo, hi]    → pitch range in scale degrees (0 = root A2, 7 ≈ one octave up in a 7-note scale)
//   every           → play on every Nth 16th-note step (1 = could play every step)
//   offbeat         → shift onto the off-beats
//   crackle         → add ember crackle on each note
// =============================================================================
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lumOf = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

export const LAYERS = [
  { id: 'salt', color: '#7fb6ff', inst: 'choir', bed: 'ocean', every: 4, reg: [5, 11],
    // blue/cyan tones; excludes lavender dust (red > green) and grey land
    classify: (r, g, b) => {
      const lum = lumOf(r, g, b), dust = clamp((Math.min(r, b) - g - 4) / 22) * clamp((lum - 0.05) / 0.6);
      return clamp((lum - 0.06) / 0.55) * clamp((b - r - 6) / 22) * clamp((b - g + 12) / 16) * clamp((g - r + 4) / 12) * (1 - dust);
    } },
  { id: 'dust', color: '#d59bff', inst: 'strings', every: 4, reg: [0, 7],
    classify: (r, g, b) => clamp((Math.min(r, b) - g - 4) / 22) * clamp((lumOf(r, g, b) - 0.05) / 0.6) },
  { id: 'smoke', color: '#ff8a5c', inst: 'pizz', crackle: true, every: 1, offbeat: true, reg: [3, 10],
    classify: (r, g, b) => clamp((r - Math.max(g, b) - 18) / 55) * clamp((r - b - 40) / 60) },
  { id: 'sulf', color: '#6dff7e', inst: 'glass', every: 1, reg: [10, 17],
    classify: (r, g, b) => clamp((g - Math.max(r, b) - 10) / 45) },
];

// Scales offered in the Sound panel (semitones above the root). The first one is the default.
export const SCALES = {
  'Aeolian (sombre)': [0, 2, 3, 5, 7, 8, 10],
  'Phrygian (darker)': [0, 1, 3, 5, 7, 8, 10],
  'Pentatonic minor': [0, 3, 5, 7, 10],
  'Dorian': [0, 2, 3, 5, 7, 9, 10],
  'Hirajoshi': [0, 2, 3, 7, 8],
};
export const ROOT = 45;   // A2

// Starting values for the Sound panel
export const DEFAULTS = { bpm: 66, thr: 0.6, rev: 0.68, vol: 0.75, fid: 0.4, lens: 16 };
