// =============================================================================
// THE WANING CANOPY · all the words on this page.
// Narration supports | (beat) || (pause) … (dramatic pause) *word* (emphasis)
// =============================================================================

export const content = {
  title: 'The Waning Canopy',
  kicker: 'NASA GEDI lidar on the International Space Station · canopy height (RH100)',
  lede: 'GEDI is a laser on the International Space Station. On every pass it fires down through the forest and times the echo, measuring how tall the canopy stands, footprint by footprint. Follow the station’s paths over the Amazon. Where the giants still stand, bells ring high. Where the forest has fallen, the music sinks into a low, grieving drone.',
  startButton: '▶ Follow the station',
  startHint: 'Sound on · headphones recommended',

  intro: 'Four hundred kilometres above the Amazon, | the space station crosses the forest. || Its laser touches each tree | and listens for the echo. || Tall canopy rings out, | high and clear. || But listen closely… | for the places where the bells | fall *silent*.',
  passIntro: (p, n, from, to) => `Pass ${p} of ${n}. || The station crosses from ${from} | to ${to}.`,
  passSummary: (p, s) => `Along pass ${p}, | the tallest canopy reached ${s.max} metres. | ${s.lost} of ${s.count} footprints found the forest thinned below ${s.lossThreshold} metres.`,
  outro: 'The station moves on. || Behind it, | every footprint we heard has burned down to ash on the map: | a memory of the canopy, | measured once from orbit. || Forests like these hold the carbon of centuries. | When they fall, | it returns to the air we heard in the chapters before.',
  dropLine: (h0, h1) => `The canopy falls from ${h0} to ${h1} metres.`,
  tallLine: h => `A giant: ${h} metres tall.`,

  sampleNote: 'Sample data: illustrative footprints along three ISS passes, not real GEDI measurements. Replace public/data/canopy/gedi_canopy_data.json with the output of process_gedi_rh100.py.',
  about: '<strong>About the data:</strong> GEDI (Global Ecosystem Dynamics Investigation) measures RH100, the height of the tallest surface the laser reaches in each 25 m footprint. Footprints are binned along the ISS ground track. The ML predicted height comes from a spatial model trained on neighbouring footprints; RMSE and R² show how well it matches.',
  howItSounds: [
    '<b>Canopy height (RH100)</b> → bell pitch: the taller the trees, the higher the bell, in a dark minor mode.',
    '<b>Canopy cover</b> → how long the bell rings and how bright it is.',
    '<b>Biomass</b> → the weight of the low bass under each bell.',
    '<b>Thinned forest</b> (below the loss threshold) → a low toll with a dissonant cluster instead of a bell.',
    '<b>A sudden drop</b> between neighbouring footprints → a falling sigh.',
    '<b>The drone</b> follows the average canopy so far: it darkens and thins as the forest does.',
  ],
  footer: 'Data: NASA GEDI L2A/L2B (sample). Country outlines: Natural Earth. Sound is synthesised live in your browser.',
};

export const transcript = () => [
  { heading: 'Introduction', text: content.lede },
  { heading: 'Narration', text: content.intro },
  { heading: 'Ending', text: content.outro },
  { heading: 'About the data', text: content.about.replace(/<[^>]+>/g, '') + ' ' + content.sampleNote },
  { heading: 'How it sounds', text: content.howItSounds.map(h => h.replace(/<[^>]+>/g, '')).join(' ') },
];
