// =============================================================================
// CARBON CURRENTS · all the words on this page, plus the look of the currents.
// Narration supports | (beat) || (pause) … (dramatic pause) *word* (emphasis)
// =============================================================================

export const content = {
  heroTitle: 'Hear <span>carbon dioxide</span> race around the planet',
  heroText: 'Carbon dioxide pours out of cities, power plants and fires, and the winds tear it around the globe in fast, restless currents. One piano follows one rule: <b>when CO₂ rises, the piano races; when it falls, it crawls</b>. Pick any city, country or spot on the map and listen to the plumes arrive and clear.',
  intro: 'Carbon Currents. || The streaks you see are winds, | carrying carbon dioxide from our cities and fires | around the whole planet. || Choose a place, | and listen. | When a plume arrives, | the piano *races*.',
  banner: '<b>Simulated data.</b> The CO₂ and winds here come from a simplified simulation modelled on NASA’s DYAMOND CO₂ visualisation (January–March 2020). The page shows how the experience works and is not a source of real measurements. <a href="#data">About the data</a>',
  startButton: 'Start listening',
  guideButton: 'Audio guide: learn the 3 rules',
  welcome: 'Welcome. Search for a place or click the map to drop a pin.',

  quickPicks: [['Singapore', 'city'], ['Delhi', 'city'], ['Beijing', 'city'], ['Houston', 'city'], ['London', 'city'], ['Lagos', 'city'],
    ['Eastern United States', 'region'], ['Western United States', 'region'], ['Sahel fire belt', 'region'], ['Southeast Asia', 'region']],

  // the moving currents (the "intense visuals")
  visual: {
    particles: 4200,          // flow streaks on a wide screen (half on phones)
    trailFade: 0.94,          // 0.9 = short trails, 0.97 = long smeared trails
    speed: 1.7,               // how fast streaks move relative to the wind
    lineWidth: 1.5,
    glow: true,               // additive blending: overlapping currents glow brighter
  },
  defaultSpeed: 6,            // simulated hours per second (see the Speed menu)

  howIntro: 'There is <b>one piano</b> playing <b>one melody</b> at <b>one volume</b>. Only the <b>tempo</b> changes, and it follows whether CO₂ at your place is <b>rising or falling</b>:',
  howTable: [
    ['<b>Rising fast</b>: more than 1 ppm', 'Racing, about 240–260 beats per minute', 'A plume is arriving and CO₂ is building up quickly.'],
    ['<b>Rising slowly</b>', 'Brisk to fast, about 130–220 beats per minute', 'CO₂ is creeping up.'],
    ['<b>Steady</b>', 'Walking pace, about 85–115 beats per minute (a little faster where CO₂ is already high)', 'No big change.'],
    ['<b>Falling slowly</b>', 'Slow, about 45–80 beats per minute', 'CO₂ is easing off.'],
    ['<b>Falling fast</b>: more than 1 ppm', 'Crawling, about 30 beats per minute', 'The plume is clearing away.'],
  ],
  howOutro: 'The tempo glides quickly between speeds, so you hear the piano surge or slump as soon as CO₂ turns. The sound also <b>leans with the wind</b>: right when air moves east, left when it moves west. Use <b>Hear the range</b> to hear a crawl, a walk and a race one after another.',

  dataParas: [
    'This experience is modelled on NASA Scientific Visualization Studio’s <a href="https://svs.gsfc.nasa.gov/5196/">DYAMOND Global Carbon Dioxide</a> visualisation. It shows CO₂ concentrations from January to March 2020, simulated by the GEOS model at very high resolution, using the SVS colour scale (pale yellow around 420 ppm through red around 460 ppm).',
    '<b>What you see here is a simplified simulation, not the DYAMOND output.</b> Emission sources (major industrial regions and seasonal fires) release CO₂ that is carried by an idealised wind field: trade winds, mid-latitude westerlies and moving weather systems. Daytime plant uptake in the tropics pulls CO₂ down; winter respiration in the north pushes it up.',
    '<b>Swapping in real data:</b> the simulation (sim.js) only produces a CO₂ grid (2° cells, every 2 hours) and wind vectors. Replace it with real gridded CO₂ and winds from NASA GEOS model products, and the map, currents and music will follow automatically.',
  ],
  accessCards: [
    ['Built for listening', 'The music is the main experience, not an add-on. Every visual change has a sound, and “Describe now” turns the current view into a plain-language summary.'],
    ['Keyboard and screen readers', 'Everything works from the keyboard. The search is a standard combobox, the map can be explored with the arrow keys, and changes are announced through your screen reader.'],
    ['Your settings', 'Choose larger text, high contrast and reduced motion in the top bar, decide how often narration speaks, or turn the built-in voice on or off.'],
  ],
  footer: 'Carbon Currents: based on NASA SVS visualisation #5196 (DYAMOND Global Carbon Dioxide). Country borders from Natural Earth. The simulated data is for demonstration only.',

  // The audio guide: each step plays a demo state while the line is read
  guide: [
    { demo: { ppm: 430, rise: 0, u: 0 }, text: 'One piano, one melody, one volume. Only the tempo changes, and it follows whether CO₂ is rising or falling. This is steady CO₂: a calm walking pace…', dur: 7000 },
    { demo: { ppm: 432, rise: 0.5, u: 0 }, text: '…CO₂ rising slowly: the piano picks up speed…', dur: 4500 },
    { demo: { ppm: 440, rise: 1.4, u: 0 }, text: '…CO₂ rising fast, more than 1 part per million in four hours: the piano races. This is a plume arriving.', dur: 6000 },
    { demo: { ppm: 432, rise: -0.5, u: 0 }, text: 'Now CO₂ falling slowly: the piano slows…', dur: 5000 },
    { demo: { ppm: 424, rise: -1.4, u: 0 }, text: '…and falling fast: it crawls. The plume is clearing.', dur: 7000 },
    { demo: { ppm: 430, rise: 0, u: -14 }, text: 'One more thing: the sound leans in the direction the wind carries the CO₂. Westward air leans left…', dur: 5000 },
    { demo: { ppm: 430, rise: 0, u: 14 }, text: '…eastward air leans right.', dur: 4000 },
    { demo: null, text: 'Now you are hearing your chosen place live. Racing means CO₂ is building up; crawling means it is clearing.', dur: 100 },
  ],
  rangeIntro: 'Here is the full range. First, CO₂ falling fast: a crawl. Then steady. Then rising fast: racing.',
  bandWords: ['below the colour scale (clear air)', 'light (pale yellow)', 'moderate (yellow-orange)', 'heavy (orange)', 'very heavy (red)'],
  bandShort: ['clear', 'light', 'moderate', 'heavy', 'very heavy'],
};

export const transcript = () => [
  { heading: 'Introduction', text: content.heroText.replace(/<[^>]+>/g, '') },
  { heading: 'Narration', text: content.intro },
  { heading: 'How it sounds', text: [content.howIntro, ...content.howTable.map(r => r.join(': ')), content.howOutro].join(' ').replace(/<[^>]+>/g, '') },
  { heading: 'Audio guide', text: content.guide.map(g => g.text).join(' ') },
  { heading: 'About the data', text: content.dataParas.join(' ').replace(/<[^>]+>/g, '') },
];
