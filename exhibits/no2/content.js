// =============================================================================
// NITROGEN DIOXIDE · all the words on this page.
// (The emotional "vibe" of this chapter is still open: the three moods and
//  their sounds live in mapping.js and instruments.js.)
// Narration supports | (beat) || (pause) … (dramatic pause) *word* (emphasis)
// =============================================================================

export const content = {
  title: 'Nitrogen Dioxide',
  kicker: 'NASA/GMAO GEOS-CF forecast · NO₂ column · 10 frames over 27 hours',
  lede: 'Nitrogen dioxide is the exhaust of our traffic, power plants and industry. This NASA GEOS-CF forecast follows it over 27 hours. Move the probe across the map: clean air plays a light, lively tune, and as the plumes darken the music slows into a heavy minor dirge.',
  intro: 'Nitrogen dioxide. || Every engine, | every chimney, | breathes it into the air we share. || Move across the map. | Where the air is clean, | the music dances. | Where the plumes gather… | listen to it *slow*.',
  startButton: 'Start audio',
  startTitle: 'Interactive sound ready',
  startText: 'Move over the map (or focus it and use the arrow keys) to hear each region sing.',

  presets: [
    { id: 'east-china', x: 583, y: 196, name: 'East China plume', hint: 'very dark, sad', emoji: '🌑' },
    { id: 'north-pacific', x: 145, y: 245, name: 'Tropical Pacific', hint: 'very light, lively', emoji: '☀️' },
    { id: 'europe', x: 378, y: 162, name: 'Northern Europe corridor', hint: 'dark, sombre', emoji: '🌆' },
    { id: 'atlantic-wave', x: 315, y: 345, name: 'South Atlantic diurnal wave', hint: 'shifts mood over time', emoji: '🌊' },
    { id: 'southern-ocean', x: 515, y: 405, name: 'Southern Ocean clean air', hint: 'bright', emoji: '🍃' },
  ],

  moodLine: (m, place, no2) => `${m.label}. ${place}, about ${no2.toFixed(1)} × 10¹⁵ molecules per square centimetre.`,
  about: '<strong>About the data:</strong> ten frames of the NASA/GMAO GEOS-CF atmospheric composition forecast, showing the nitrogen dioxide column from the 24-hour to the 51-hour forecast. Darker green means more NO₂. The page reads each pixel’s colour, ignores coastlines and borders, and estimates NO₂ on the forecast’s 0–18 × 10¹⁵ molecules/cm² colour bar.',
  footer: 'Data: NASA Global Modeling and Assimilation Office, GEOS-CF forecast imagery. Sound is synthesised live in your browser.',
  keys: '<kbd>←↑↓→</kbd> move probe (<kbd>Shift</kbd> faster) · <kbd>Enter</kbd> lock/unlock · <kbd>Space</kbd> play/pause frames · <kbd>,</kbd><kbd>.</kbd> frame · <kbd>D</kbd> describe · <kbd>T</kbd> transcript',
};

export const transcript = moods => [
  { heading: 'Introduction', text: content.lede },
  { heading: 'Narration', text: content.intro },
  ...moods.map(m => ({ heading: `${m.label} (${m.rangeText})`, text: m.description })),
  { heading: 'About the data', text: content.about.replace(/<[^>]+>/g, '') },
];
