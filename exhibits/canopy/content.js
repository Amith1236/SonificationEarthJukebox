// =============================================================================
// THE WANING CANOPY · all the words on this page.
// Narration supports | (beat) || (pause) … (dramatic pause) *word* (emphasis)
// =============================================================================

export const content = {
  title: 'The Waning Canopy',
  kicker: 'NASA GEDI L2B lidar on the International Space Station · one orbital track',
  lede: 'GEDI is a laser on the International Space Station. On one orbit it fired down through the Congo rainforest, across the savanna and the Sahel, then over the steppes of Central Asia, timing each echo to measure how tall the canopy stands. A model predicts how tall each footprint should be; the gap between the two is the dieback. Healthy forest plays in clear harmony. Where the canopy is dying, the harmony turns dissonant.',
  startButton: 'Follow the laser',
  startHint: 'Sound on · headphones recommended',

  intro: 'Four hundred kilometres up, | a laser on the space station reaches down through the forest, | and listens for the echo. || Where the canopy stands tall and whole, | the harmony is clear. || Where it thins, | and dies… | listen to it *sour*.',
  outro: 'The track ends. || Every footprint the laser touched | is a small measure of a living forest, | or of what is left of one.',

  // spoken while playing, at most every few seconds (see RULES.speakEverySec)
  severeLine: (c, where) => `Severe dieback, ${where}. | The canopy reaches ${c.rh100_m.toFixed(0)} metres, | where ${c.pred_rh100_m.toFixed(0)} were expected.`,
  intactLine: (c, where) => `Intact canopy, ${where}. | ${c.rh100_m.toFixed(0)} metres tall, | ${Math.round(c.canopy_cover * 100)} percent cover.`,
  enterRegion: where => `Now crossing ${where}.`,
  status: { intact: 'Intact canopy', stress: 'Canopy thinning', severe: 'Severe dieback' },

  // rough place names along this track, for narration: [latMin, latMax, lonMin, lonMax, name]
  regions: [
    [-5, 3, 10, 20, 'the Congo Basin rainforest'],
    [3, 6, 15, 22, 'the northern Congo forest'],
    [6, 9.5, 15, 25, 'the Central African savanna'],
    [9.5, 16, 18, 30, 'the Sahel, in Sudan'],
    [38, 50.2, 50, 81, 'the Kazakh steppe'],
    [50, 53, 80, 91, 'the Altai foothills'],
    [48, 56, 91, 105, 'southern Siberia'],
  ],
  elsewhere: 'open country along the track',

  about: '<strong>About the data:</strong> one GEDI L2B granule (GEDI02_B, orbit 36105). RH100 is the height of the tallest surface the laser reaches in each footprint, binned along the ISS ground track. A spatial model predicts the expected height for each footprint (RMSE 3.8 m, R² 0.84); the dieback index combines the shortfall with canopy cover. Note that naturally treeless steppe also scores high: the index reads low, sparse canopy as stress.',
  howItSounds: [
    '<b>Terrain elevation</b> → a sub-bass drone.',
    '<b>Canopy height (RH100)</b> → the pitch of the main voice: taller forest, higher note.',
    '<b>Canopy health</b> → a bright octave shimmer that fades as dieback rises.',
    '<b>Dieback</b> → a detuned, dissonant pulse a minor third above, growing louder with stress.',
  ],
  footer: 'Data: NASA GEDI L2B (LP DAAC). Imagery: Esri World Imagery. Sound is synthesised live in your browser.',
};

export const transcript = () => [
  { heading: 'Introduction', text: content.lede },
  { heading: 'Narration', text: content.intro },
  { heading: 'Ending', text: content.outro },
  { heading: 'About the data', text: content.about.replace(/<[^>]+>/g, '') },
  { heading: 'How it sounds', text: content.howItSounds.map(h => h.replace(/<[^>]+>/g, '')).join(' ') },
];
