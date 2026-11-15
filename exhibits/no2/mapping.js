// =============================================================================
// NITROGEN DIOXIDE · data → music. The pixel's darkness (0 = clean, 1 = thick
// plume) picks one of three MOODS. To change the chapter's vibe, edit this table:
// thresholds, scales, melodic patterns, tempo, instruments and drone.
// =============================================================================

const N = (name, freq) => ({ name, freq });

export const MOODS = [
  {
    id: 'lively', upTo: 0.36, label: 'Lively and bright', emoji: '☀️', color: '#34d399', rangeText: '0–4 × 10¹⁵',
    scaleName: 'C Lydian major', chord: 'Cmaj9 / G6', timbre: 'Bright pluck', tempoWord: 'Upbeat',
    description: 'Light green, clean air: C Lydian and major pentatonic arpeggios, bright plucked harp with bell overtones, an airy major-seventh pad and an open filter.',
    notes: [N('C5', 523.25), N('D5', 587.33), N('E5', 659.25), N('G5', 783.99), N('A5', 880), N('B5', 987.77), N('C6', 1046.5), N('D6', 1174.66), N('E6', 1318.51)],
    pattern: [0, 2, 3, 4, 6, 4, 5, 3, 1, 3, 4, 7, 6, 4, 2, 3],
    instrument: 'pluck', stepBeats: 0.5,
    drone: { types: ['triangle', 'sine'], freqs: [261.63, 329.63], vibrato: 0.25, gain: 0.05 },
  },
  {
    id: 'reflective', upTo: 0.6, label: 'Reflective', emoji: '🌤️', color: '#fbbf24', rangeText: '4–9 × 10¹⁵',
    scaleName: 'D Dorian', chord: 'Dm7 / G9', timbre: 'Warm Rhodes', tempoWord: 'Moderate',
    description: 'Mid green: a D Dorian groove on a warm electric piano, gentle sixths and a balanced filter.',
    notes: [N('D4', 293.66), N('F4', 349.23), N('G4', 392), N('A4', 440), N('B4', 493.88), N('C5', 523.25), N('D5', 587.33), N('E5', 659.25)],
    pattern: [0, 2, 3, 5, 4, 3, 1, 2, 0, 3, 4, 6, 5, 3, 2, 1],
    instrument: 'rhodes', stepBeats: 0.65,
    drone: { types: ['triangle', 'triangle'], freqs: [146.83, 220], vibrato: 0.8, gain: 0.065 },
  },
  {
    id: 'sad', upTo: 1.01, label: 'Sad and heavy', emoji: '🌑', color: '#818cf8', rangeText: '9–18 × 10¹⁵',
    scaleName: 'A harmonic minor', chord: 'Am(maj7) / Dm', timbre: 'Bowed cello', tempoWord: 'Slow dirge',
    description: 'Dark green and black plumes: a slow A harmonic minor dirge on bowed cello and muted piano, with weeping minor seconds, vibrato and a deep low-pass filter.',
    notes: [N('A3', 220), N('B3', 246.94), N('C4', 261.63), N('D4', 293.66), N('E4', 329.63), N('F4', 349.23), N('G#4', 415.3), N('A4', 440)],
    pattern: [4, 5, 4, 2, 1, 0, 2, 1, 4, 7, 5, 4, 3, 2, 1, 0],
    instrument: 'cello', stepBeats: 0.95,
    drone: { types: ['sawtooth', 'triangle'], freqs: [110, 164.81], vibrato: 2.4, gain: 0.085 },
  },
];
export const moodOf = d => MOODS.find(m => d < m.upTo);
export const bpmOf = d => Math.round(154 - d * 98);           // 154 BPM (clean) → 56 BPM (darkest)
export const cutoffOf = d => Math.round(4800 * Math.pow(1 - d, 1.65) + 460);
export const NO2_MAX = 18;                                    // ×10¹⁵ molecules/cm², top of the colour bar

// Map area inside the 721×541 forecast image (for coordinates and margins)
export const MAP_BOUNDS = { xMin: 33, xMax: 687, yMin: 80, yMax: 460 };

/** darkness 0..1 from an RGB colour on the GEOS-CF NO₂ green colour bar */
export function darknessOf(r, g, b) {
  const lum = 0.25 * r + 0.65 * g + 0.1 * b;
  return 1 - Math.max(0, Math.min(1, (lum - 28) / (205 - 28)));
}
/** ignore black coastline/border pixels and the white margin */
export function isIgnored(r, g, b, y) {
  const border = g < 55 && g - r < 10 && g - b < 10;
  const margin = r > 240 && g > 240 && b > 240 && (y < MAP_BOUNDS.yMin || y > MAP_BOUNDS.yMax);
  return border || margin;
}
export function pixelToLatLon(px, py) {
  const nx = Math.max(0, Math.min(1, (px - MAP_BOUNDS.xMin) / (MAP_BOUNDS.xMax - MAP_BOUNDS.xMin)));
  const ny = Math.max(0, Math.min(1, (py - MAP_BOUNDS.yMin) / (MAP_BOUNDS.yMax - MAP_BOUNDS.yMin)));
  const lon = -180 + nx * 360, lat = 90 - ny * 180;
  return { lat, lon, text: `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}` };
}
