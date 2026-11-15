// =============================================================================
// THE STORY: edit this file to change the hub's words, order and chapters.
//
// - CHAPTERS sets the order of the journey. Reorder the array to reorder the story.
// - To add a chapter: add an entry here, then create exhibits/<id>/index.html
//   (copy an existing exhibit folder as a starting point).
// - Narration text supports the script marks from src/shared/narrator.js:
//     |  short beat   ||  long pause   …  dramatic pause   *word*  emphasis
// - Each exhibit's own words (intro, story stops, transcript) live in
//   exhibits/<id>/content.js.
// =============================================================================

export const SITE = {
  name: 'AirLab',
  tagline: 'Listening to the air from low Earth orbit',
  event: 'NASA Space Apps Challenge 2026',
};

export const CHAPTERS = [
  {
    id: 'aerosols',
    path: '/exhibits/aerosols/',
    title: 'Aerosols',
    subtitle: 'A sombre orchestra',
    color: '#c9a6ff',
    thumb: '/thumbs/aerosols.jpg',
    dataset: 'NASA GEOS model aerosols · 19 August 2025',
    summary: 'A journey through the planet’s pollution hotspots: Saharan dust, wildfire smoke, sea salt and volcanic sulfates, each played by its own section of a sombre orchestra.',
    sound: 'Dust bows low strings, smoke crackles, sea salt breathes like a choir, sulfates ring like glass.',
    story: 'Below us, | the air itself is drifting. || Dust lifted from the Sahara, | smoke from burning forests, | salt flung from the waves, | sulfur breathed out by volcanoes. || Here, | each one plays its part | in a *sombre* orchestra… | and we travel from one hotspot to the next.',
  },
  {
    id: 'co2',
    path: '/exhibits/co2/',
    title: 'Carbon Currents',
    subtitle: 'Fast rivers of an invisible gas',
    color: '#ffb454',
    thumb: '/thumbs/co2.jpg',
    dataset: 'DYAMOND-style CO₂ simulation · January–March 2020',
    summary: 'Carbon dioxide pours out of cities, power plants and fires and races around the globe on the winds. Pick any place and listen to the currents arrive.',
    sound: 'One piano. It races when CO₂ is rising and crawls when it is falling.',
    story: 'Invisible, | yet everywhere. || Carbon dioxide pours from our cities and our fires, | and the winds carry it around the planet in *fast*, | restless currents. || Listen to the piano. | When a plume arrives, | it races. || When the air clears… | it slows, | almost to stillness.',
    note: 'Uses simulated data modelled on NASA’s DYAMOND visualisation.',
  },
  {
    id: 'canopy',
    path: '/exhibits/canopy/',
    title: 'The Waning Canopy',
    subtitle: 'A requiem for the forest, read by laser',
    color: '#43d692',
    thumb: '/thumbs/canopy.jpg',
    dataset: 'NASA GEDI L2B lidar on the ISS · one orbital track',
    summary: 'On one orbit, the GEDI laser on the space station measured 1,800 footprints from the Congo rainforest to the steppes of Central Asia. Hear where the canopy stands whole, and where it is dying back.',
    sound: 'Healthy forest plays in clear harmony with a bright shimmer. Where the canopy dies back, a detuned, dissonant voice takes over.',
    story: 'From this very orbit, | a laser on the space station reaches down through the forest, | measuring every tree it touches. || Where the canopy stands whole, | the harmony is clear. | But follow its path… | and you will hear the forest *sour*, | and thin away.',
  },
  {
    id: 'no2',
    path: '/exhibits/no2/',
    title: 'Nitrogen Dioxide',
    subtitle: 'The breath of our cities',
    color: '#5be37d',
    thumb: '/thumbs/no2.jpg',
    dataset: 'NASA GEOS-CF forecast · 27 hours, 10 frames',
    summary: 'The exhaust of traffic and industry, traced across 27 hours of a NASA forecast. Clean air plays bright and light; thick plumes play slow and heavy.',
    sound: 'Clean air plays a lively major tune. Dark, polluted plumes turn it into a slow minor dirge.',
    story: 'Nitrogen dioxide. | The exhaust of our traffic, | and our industry, | traced across twenty-seven hours by a NASA forecast. || Where the air runs clean, | the music is bright, | and full of life. | Where the plumes grow dark… | it turns slow, | and sorrowful.',
  },
];

// Words spoken and shown in the hub
export const HUB = {
  splash: {
    title: 'Air<em>Lab</em>',
    body: 'Four works of sound made from NASA observations of the air, hung in low Earth orbit.',
    begin: 'Enter the gallery',
    list: 'Text-only index',
    small: 'Best with headphones. A narrator guides you; press <kbd>N</kbd> to silence it.',
  },
  intro: 'Four hundred kilometres up, | the Earth turns slowly beneath us. || From here, | the air looks thin as a line of light | along the horizon. || Yet everything we breathe | is held inside it. || Around us | hang four windows. | Each one listens to that air | and turns what it hears into *music*. || Our journey begins with the first.',
  facing: (ch, i, n) => `Chapter ${i + 1} of ${n}. | ${ch.title}. || ${ch.story}${ch.note ? ' || ' + ch.note : ''} || Press Enter to step inside.`,
  entering: ch => `And so, | we descend into: | ${ch.title}.`,
  returning: (from, next) => next
    ? `Back in orbit. || You have heard ${from.title}. | Ahead of you waits the next chapter: | ${next.title}.`
    : `Back in orbit. || You have heard every chapter of the journey. | Below us, | the thin blue line of air holds all of it: | the dust, the gases, the forests. || Thank you for listening.`,
  listMode: 'List view open. Each chapter has an Open button. The built-in narrator is off; turn it on with the Narration button.',
  help: 'Drag to look around · arrow keys to move between works · Enter to step inside',
  credits: 'Earth: NASA Blue Marble and Black Marble. Data: NASA GMAO GEOS, GEOS-CF, GEDI and SVS DYAMOND.',
};

export const chapterIndex = id => CHAPTERS.findIndex(c => c.id === id);
export const chapterById = id => CHAPTERS.find(c => c.id === id);
