# Earth Information Jukebox

An accessible, interactive story of Earth's air told through sound, built from NASA data for the NASA Space Apps Challenge 2026. The visitor floats in low Earth orbit, in a gallery of four works; each is a sonification hung in its own room:

| # | Chapter | Data | Feel |
|---|---------|------|------|
| 1 | **Aerosols** | NASA GEOS aerosols, 19 Aug 2025 | A journey through pollution hotspots, played by a sombre orchestra |
| 2 | **Carbon Currents** | DYAMOND-style CO₂ simulation, Jan–Mar 2020 | Active, restless: fast glowing currents, a piano that races as CO₂ rises |
| 3 | **The Waning Canopy** | GEDI lidar canopy height (RH100) along ISS passes | Abstract requiem: footprints ring as bells, then burn to ash |
| 4 | **Nitrogen Dioxide** | NASA GEOS-CF NO₂ forecast, 10 frames | Mood still open: clean air bright, plumes slow and heavy |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve the production build
```

## Deploy on Vercel

Push the repo to GitHub, then import it at vercel.com/new. Vercel detects Vite automatically (`vercel.json` pins the build command and `dist/` output). Or, from this folder: `npx vercel` (preview) and `npx vercel --prod`.

## Where things live

```
index.html                  the hub (orbit)
src/content/story.js        ★ chapter order, titles, colours, hub narration
src/hub/                    hub scene: earth.js, sky.js, windows.js, ambience.js, main.js
src/shared/                 used by every page
  theme.css                 design tokens, buttons, the room layout (.room/.piece/.plinth/.drawer)
  shell.js                  exhibit frame: top bar, wall label, Controls drawer, transcript, settings popover
  narrator.js               one narrator voice for the whole site (+ screen-reader live region)
  prefs.js                  visitor settings saved across pages
  markov.js                 AI melody model (guided Markov decoding), reusable by any exhibit
  world.js                  country outlines loader
exhibits/<id>/
  index.html, style.css     page
  content.js                ★ every word on the page: intro, story stops, captions, transcript
  mapping.js / layers.js    ★ data → music rules (thresholds, scales, tempo, pitch ranges)
  instruments.js            ★ the synthesised instruments
  main.js                   the engine (sampling, scheduling, drawing, input)
  sim.js (CO₂ only)         the data source; swap for real GEOS output
public/data/                datasets (images, JSON, melody model, world map)
public/textures/            Earth and Moon textures for the hub
```

**To change words:** edit `content.js` (exhibit) or `src/content/story.js` (hub). Narration text supports script marks: `|` short beat, `||` long pause, `…` dramatic pause, `*word*` emphasis. Pronunciations (CO₂, GEDI, ppm…) are in `src/shared/narrator.js`.

**To tune the music:** `mapping.js`/`layers.js` hold the rules, `instruments.js` the sound design.

**To add a chapter:** copy an `exhibits/<id>/` folder, add an entry to `CHAPTERS` in `src/content/story.js`, and drop a thumbnail in `public/thumbs/`. Vite picks up the new page automatically. The hub arranges any number of windows around the orbit.

## Accessibility

- Every page works by keyboard; shortcuts are listed on each page.
- All narration goes to a screen-reader live region; the built-in voice is optional (🗣 / `N`).
- A full written transcript on every chapter (📄 / `T`).
- High contrast, reduced motion and larger text, remembered across pages.
- The hub has a list view that avoids the 3D scene entirely.

## Data notes

- CO₂ is a **simulation** modelled on NASA SVS #5196 (DYAMOND); replace `exhibits/co2/sim.js` with real gridded data.
- GEDI data is a **sample** file; replace `public/data/canopy/gedi_canopy_data.json` with the output of `process_gedi_rh100.py`.
- Earth textures: NASA Blue Marble / Black Marble (4K) via the three.js examples.
- Hub thumbnails in `public/thumbs/` are screenshots of each piece; recapture them when a piece changes.
