// =============================================================================
// AEROSOLS · all the words on this page. Edit freely; no code changes needed.
//   - journey.stops: the hotspots, in the order the journey visits them.
//     x, y = position in the 1500×1179 source image; r = lens radius (grid cells)
//     hl   = which particle layers are brought forward in the mix
//     text = caption shown on screen; narration = what is spoken (defaults to text)
//   - Narration supports | (beat) || (pause) … (dramatic pause) *word* (emphasis)
// =============================================================================

export const content = {
  title: 'Aerosols: a sombre orchestra',
  kicker: 'NASA GEOS model · aerosols · 19 August 2025, 20:00 UTC',
  lede: 'NASA’s GEOS model tracks the tiny particles that drift through our air: desert dust, wildfire smoke, sea salt and volcanic sulfates. Here each one is a section of an orchestra. Follow the journey from hotspot to hotspot, or take the lens and listen anywhere on Earth.',
  about: '<strong>About this frame:</strong> GEOS model aerosols on 19 August 2025. Hurricane Erin pulls in Saharan dust while more dust crosses the Atlantic; volcanic sulfate plumes rise from Kīlauea and Mount Etna; smoke drifts from agricultural burning in southern Africa and wildfires in Spain; sea salt is whipped up by storms over the Southern Ocean. Colours: <b style="color:#d59bff">dust</b> violet, <b style="color:#ff8a5c">smoke</b> orange-red, <b style="color:#7fb6ff">sea salt</b> blue, <b style="color:#6dff7e">sulfates</b> green.',
  image: { src: '/data/aerosols/aerosols.png', alt: 'World map of aerosols from the NASA GEOS model on 19 August 2025', width: 1500, height: 1179 },
  startButton: 'Begin the journey',
  startHint: 'Sound on · headphones recommended',
  idleCaption: 'Move over the map to hear what is in the air there.',

  modes: {
    story: { label: 'Journey', help: 'A guided journey through the hotspots. The lens glides to each one, its particles are brought forward in the orchestra, and the story is read aloud.' },
    lens: { label: 'Lens', help: 'Move over the map, or use the arrow keys. Each particle type under the lens plays its own instrument: more particles, louder and busier; thicker concentrations, higher notes.' },
    scan: { label: 'Sweep', help: 'A beam sweeps the map from west to east. Every band of the map plays at once: higher on the map means higher pitch, and each particle type keeps its instrument.' },
  },

  // Names and the voice description shown in the mixer (the sound itself is in layers.js / instruments.js)
  layers: {
    salt: { name: 'Sea salt', voice: 'distant choir + ocean swell' },
    dust: { name: 'Dust', voice: 'low bowed strings' },
    smoke: { name: 'Smoke', voice: 'pizzicato + crackle' },
    sulf: { name: 'Sulfates', voice: 'glass celesta' },
  },

  journey: {
    stopSeconds: 24,          // how long the lens rests on each hotspot
    loop: false,              // false: the journey ends with the outro
    intro: 'We begin over Africa. || Below us, | the air is thick with what the land, the fires and the sea | have given up to the wind. || Listen. | Each particle has its own voice | in this *sombre* orchestra.',
    outro: 'The journey ends here, | over the Southern Ocean. || Dust, smoke, salt and sulfur… | they do not stay where they began. | The wind carries them across every border, | into every breath. || Take the lens to explore on your own, | or continue to the next chapter.',
    stops: [
      { x: 1250, y: 425, r: 30, title: 'Over the Sahara', hl: ['dust'],
        text: 'This is where the dust is born. Hot desert winds lift fine sand and minerals high into the atmosphere, ready to travel thousands of kilometres. The low strings swell with every gust.' },
      { x: 900, y: 445, r: 26, title: 'The Saharan dust river', hl: ['dust'],
        text: 'A river of Saharan dust streams west across the Atlantic on the trade winds. The thicker the dust, the louder and higher the strings.' },
      { x: 665, y: 410, r: 22, title: 'Hurricane Erin', hl: ['salt', 'dust'],
        text: 'Hurricane Erin spins in the western Atlantic. Its winds whip sea salt into the air, the bright swirl, while its circulation drags the Saharan dust in from the east. Choir and strings, tangled together.' },
      { x: 1068, y: 322, r: 16, title: 'Wildfires in Spain', hl: ['smoke'],
        text: 'Wildfires in Spain send smoke north over Europe. Smoke plays as plucked strings and crackling embers: the brighter the plume, the sharper the crackle.' },
      { x: 1185, y: 345, r: 16, title: 'Mount Etna', hl: ['sulf'],
        text: 'Mount Etna in Sicily breathes out volcanic gases that become sulfate particles. They ring out like cold glass.' },
      { x: 1225, y: 630, r: 28, title: 'Southern Africa burning', hl: ['smoke'],
        text: 'Agricultural fires across southern Africa fill the air with the densest smoke in the frame. The embers never stop crackling here.' },
      { x: 140, y: 460, r: 22, title: 'Kīlauea’s plume', hl: ['sulf'],
        text: 'Far out in the Pacific, a sulfate plume streams away from Hawaiʻi’s Kīlauea volcano. Volcanic sulfates cool the climate, and foul the air downwind.' },
      { x: 555, y: 921, r: 30, title: 'The Southern Ocean', hl: ['salt'],
        text: 'Over the stormy Southern Ocean, the strongest winds on Earth fling sea spray into the sky. A constant, breathing wash of salt: the distant choir, and the swell beneath it.' },
    ],
  },

  // Region names for the lens (boxes in source-image pixels: x0, y0, x1, y1)
  regions: [
    [0, 0, 1500, 165, 'Arctic & Greenland'], [0, 1050, 1500, 1179, 'Antarctica'],
    [520, 375, 720, 520, 'Gulf of Mexico & Caribbean'], [380, 165, 770, 375, 'North America'],
    [0, 165, 380, 520, 'North Pacific'], [640, 520, 900, 900, 'South America'],
    [720, 375, 1030, 520, 'Tropical Atlantic (dust corridor)'], [770, 165, 1030, 375, 'North Atlantic'],
    [1030, 165, 1500, 335, 'Europe & Mediterranean'], [1030, 335, 1360, 520, 'Sahara & North Africa'],
    [1360, 165, 1500, 520, 'Middle East & Asia'], [1160, 520, 1360, 850, 'Central & Southern Africa'],
    [900, 520, 1160, 900, 'South Atlantic'], [1160, 520, 1500, 1050, 'Indian Ocean'],
    [0, 900, 1500, 1050, 'Southern Ocean'], [0, 520, 640, 900, 'South Pacific'],
  ],
  openOcean: 'Open ocean',

  howItSounds: [
    '<b>Each particle type</b> → its own section of the orchestra, in its own pitch range.',
    '<b>Concentration</b> (how vivid the colour is) → pitch within that range, and loudness.',
    '<b>Coverage</b> (how much of the lens or column holds that particle) → how often it plays.',
    '<b>West ↔ east</b> → left ↔ right in stereo. In Sweep, <b>north ↔ south</b> → high ↔ low.',
    'Every note is snapped to the chosen musical scale (a sombre minor mode by default).',
    '<b>AI melody model</b>: the data sets a <em>target</em> note; a model trained on thousands of real folk melodies picks the most musical next step near that target, and a learned rhythm model spaces the notes into phrases. The <b>Data ↔ Music</b> slider sets how strictly the notes follow the data.',
  ],
  modelInfo: m => `<b>AI melody model</b> · order-2 Markov model trained on <b>${m.tunes.toLocaleString()}</b> folk melodies (${m.notes.toLocaleString()} notes, Essen Folksong Collection). It learned that ${Math.round((m.P0[6] + m.P0[7] + m.P0[8]) * 100)}% of real melodic moves are a repeat or a single scale step, and uses that to turn data into phrases.`,
  footer: 'Imagery: NASA Scientific Visualization Studio / Earth Information Center, GEOS model. Sound is synthesised live in your browser (Web Audio API). Region labels are approximate.',

  // Spoken descriptions
  levelWords: ['trace', 'light', 'moderate', 'strong'],
  clearAir: 'Clear air here. Almost nothing detected.',
};

// The written transcript (📄 Transcript button) is built from the words above.
export const transcript = () => [
  { heading: 'Introduction', text: content.lede },
  { heading: 'The journey begins', text: content.journey.intro },
  ...content.journey.stops.map((s, i) => ({ heading: `${i + 1}. ${s.title}`, text: s.narration || s.text })),
  { heading: 'The journey ends', text: content.journey.outro },
  { heading: 'About the data', text: content.about.replace(/<[^>]+>/g, '') },
  { heading: 'How it sounds', text: content.howItSounds.map(h => h.replace(/<[^>]+>/g, '')).join(' ') },
];
