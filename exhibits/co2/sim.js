// =============================================================================
// CARBON CURRENTS · data source. A stand-in for DYAMOND output: a 2° CO₂ grid
// every 2 hours (1 Jan – 31 Mar 2020) advected by an idealised wind field.
//
// To use REAL data, replace createSimulation with something that returns the
// same interface: { NX, NY, DT, HOURS, START, CELLS, wind(lon,lat,h), fieldAt(h,out),
// sample(field,lon,lat), meanAt(h,roi), readySteps(), start(onProgress), cellLat, cellLon,
// SOURCES, sourceRate, season, dayFactor }
// =============================================================================
import { geoEquirectangular, geoPath } from 'd3-geo';

const RAD = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const wrap180 = l => ((l + 180) % 360 + 360) % 360 - 180;

// emission sources: [name, lon, lat, strength (ppm per step at the centre), spread (cells), kind]
const SOURCE_TABLE = [
  ['North China Plain', 116, 37, 30, 2.0, 'urban'], ['Yangtze River Delta', 120.5, 31, 24, 1.5, 'urban'], ['Pearl River Delta', 113.5, 23, 16, 1.0, 'urban'],
  ['Sichuan Basin', 105, 30, 11, 1.2, 'urban'], ['Indo-Gangetic Plain', 80, 27, 24, 2.5, 'urban'], ['Mumbai and Gujarat', 73, 21, 11, 1.2, 'urban'],
  ['South Korea and Japan', 133, 36, 16, 2.0, 'urban'], ['US Northeast', -76, 40.5, 18, 1.6, 'urban'], ['US Midwest', -87, 41.5, 15, 1.6, 'urban'],
  ['US Gulf Coast', -94, 30, 13, 1.2, 'urban'], ['California', -119, 35, 9, 1.2, 'urban'], ['Western Europe', 6, 50.5, 18, 2.2, 'urban'],
  ['Northern Italy', 10, 45.4, 7, 0.8, 'urban'], ['Moscow region', 37.6, 55.7, 9, 1.2, 'urban'], ['Persian Gulf', 50.5, 26.5, 13, 1.5, 'urban'],
  ['Tehran', 51.4, 35.7, 6, 0.8, 'urban'], ['South African Highveld', 28.5, -26, 11, 1.0, 'urban'], ['São Paulo', -46.6, -23.5, 7, 1.0, 'urban'],
  ['Mexico City', -99.1, 19.4, 7, 0.8, 'urban'], ['Java', 108, -6.8, 11, 1.5, 'urban'], ['Bangkok', 100.5, 13.75, 6, 0.8, 'urban'],
  ['Cairo and the Nile Delta', 31, 30.3, 6, 0.8, 'urban'], ['Lagos', 3.4, 6.5, 5, 0.8, 'urban'], ['Eastern Australia', 150, -33, 5, 1.2, 'urban'],
  ['Sahel savanna fires', -12, 10, 9, 2.2, 'sahel'], ['Sahel savanna fires', -4, 9.5, 10, 2.2, 'sahel'], ['Sahel savanna fires', 4, 9.5, 10, 2.2, 'sahel'],
  ['Sahel savanna fires', 12, 9, 10, 2.2, 'sahel'], ['Sahel savanna fires', 20, 8.5, 9, 2.2, 'sahel'], ['Sahel savanna fires', 28, 8, 8, 2.2, 'sahel'],
  ['Southeast Asia fires', 97, 19, 10, 1.6, 'sea'], ['Southeast Asia fires', 101, 18, 10, 1.6, 'sea'], ['Southeast Asia fires', 104.5, 15.5, 9, 1.6, 'sea'], ['Southeast Asia fires', 99, 22, 8, 1.6, 'sea'],
  ['Venezuelan llanos fires', -67, 8, 8, 1.8, 'ven'], ['Northern Australia fires', 132, -14, 3, 2.0, 'aus'],
];

export function createSimulation(countries) {
  const NX = 180, NY = 90, DT = 2, HOURS = 91 * 24, STEPS = HOURS / DT, CELLS = NX * NY;
  const START = Date.UTC(2020, 0, 1);
  const snaps = new Uint8Array((STEPS + 1) * CELLS); // ppm = 400 + q/4
  let ready = -1;
  const cellLon = i => -180 + (i + 0.5) * 2;
  const cellLat = j => 90 - (j + 0.5) * 2;
  const bgPpm = lat => 411.5 + 4 / (1 + Math.exp(-(lat - 10) / 12));

  function wind(lon, lat, h) {
    const td = h / 24, la = Math.abs(lat), sg = lat >= 0 ? 1 : -1, lr = lon * RAD; let u = 0, v = 0, s;
    if (la < 30) { s = Math.sin(Math.PI * la / 30); u = -6.5 * s; v = -sg * 2.2 * s; }
    else if (la < 62) { s = Math.sin(Math.PI * (la - 30) / 32); u = (lat > 0 ? 18 : 14) * s; }
    else u = -4 * Math.sin(Math.PI * (la - 62) / 28);
    const env = Math.exp(-Math.pow((la - 45) / 13, 2));
    const ph1 = 5 * lr - 0.87 * td + (lat > 0 ? 0 : 1.7), ph2 = 3 * lr - 0.32 * td + (lat > 0 ? 0.6 : 2.4);
    v += env * (10 * Math.cos(ph1) + 6 * Math.cos(ph2));
    u += env * ((la - 45) / 13) * sg * (5 * Math.sin(ph1) + 3 * Math.sin(ph2));
    v += 2.2 * Math.sin(lr * 11 + lat * 0.21 + td * 1.3);
    u += 1.8 * Math.cos(lr * 7 - lat * 0.17 + td * 0.9);
    return [u, v];
  }

  const SOURCES = SOURCE_TABLE.map(s => {
    const cells = [], sig = s[4], ci = (s[1] + 180) / 2 - 0.5, cj = (90 - s[2]) / 2 - 0.5, R = Math.ceil(sig * 2.5); let tot = 0;
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      const i = Math.round(ci) + di, j = Math.round(cj) + dj; if (j < 0 || j >= NY) continue;
      const w = Math.exp(-0.5 * ((i - ci) ** 2 + (j - cj) ** 2) / (sig * sig)); if (w < 0.05) continue;
      cells.push(((i % NX) + NX) % NX + j * NX, w); tot += w;
    }
    for (let k = 1; k < cells.length; k += 2) cells[k] /= Math.max(1, tot / 3);
    return { name: s[0], lon: s[1], lat: s[2], A: s[3], kind: s[5], cells };
  });
  const dayFactor = (lon, h) => Math.max(0, Math.sin(Math.PI * ((((h % 24) + lon / 15 + 48) % 24) - 6) / 12));
  function season(kind, h) {
    const td = h / 24;
    if (kind === 'sahel') return clamp(1 - (td - 20) / 85, 0.25, 1);
    if (kind === 'sea') return clamp((td - 15) / 45, 0.1, 1);
    if (kind === 'ven') return clamp((td - 25) / 40, 0.1, 0.9);
    if (kind === 'aus') return 0.4;
    return 1;
  }
  function sourceRate(s, h) { const d = dayFactor(s.lon, h); return s.kind === 'urban' ? s.A * (0.72 + 0.4 * d) : s.A * season(s.kind, h) * (0.12 + 1.5 * Math.pow(d, 1.5)); }

  // land mask from country shapes
  const land = new Uint8Array(CELLS);
  {
    const c = document.createElement('canvas'); c.width = NX * 2; c.height = NY * 2;
    const x = c.getContext('2d', { willReadFrequently: true });
    const p = geoEquirectangular().scale(c.width / (2 * Math.PI)).translate([c.width / 2, c.height / 2]);
    x.fillStyle = '#fff'; x.beginPath(); geoPath(p, x)({ type: 'FeatureCollection', features: countries }); x.fill();
    const d = x.getImageData(0, 0, c.width, c.height).data;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      let s = 0; for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) s += d[((j * 2 + a) * c.width + i * 2 + b) * 4 + 3];
      land[j * NX + i] = s > 255 ? 1 : 0;
    }
  }

  let simA = new Float32Array(CELLS), simB = new Float32Array(CELLS);
  const dxc = new Float32Array(CELLS), dyc = new Float32Array(CELLS);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) simA[j * NX + i] = bgPpm(cellLat(j));
  function stepSim(h) {
    for (let j = 0; j < NY; j++) {
      const lat = cellLat(j), cs = Math.max(Math.cos(lat * RAD), 0.15);
      for (let i = 0; i < NX; i++) { const w = wind(cellLon(i), lat, h), k = j * NX + i; dxc[k] = w[0] * 3.6 * DT / (222.4 * cs); dyc[k] = w[1] * 3.6 * DT / 222.4; }
    }
    const relax = DT / (24 * 6);
    for (let j = 0; j < NY; j++) {
      const lat2 = cellLat(j), bg = bgPpm(lat2), tropic = lat2 < 25 && lat2 > -40;
      for (let i = 0; i < NX; i++) {
        const k = j * NX + i, x = i - dxc[k], y = clamp(j + dyc[k], 0, NY - 1.001);
        const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
        const xa = ((x0 % NX) + NX) % NX, xb = (xa + 1) % NX, ya = y0 * NX, yb = Math.min(NY - 1, y0 + 1) * NX;
        let v = (simA[ya + xa] * (1 - fx) + simA[ya + xb] * fx) * (1 - fy) + (simA[yb + xa] * (1 - fx) + simA[yb + xb] * fx) * fy;
        if (land[k]) {
          if (tropic) { const d = dayFactor(cellLon(i), h); v += DT * (d > 0 ? -0.45 * d : 0.3); }
          else if (lat2 >= 25) v += 0.05 * DT;
        }
        simB[k] = v + (bg - v) * relax;
      }
    }
    SOURCES.forEach(s => { const r = sourceRate(s, h); for (let c = 0; c < s.cells.length; c += 2) simB[s.cells[c]] += r * s.cells[c + 1]; });
    for (let k = 0; k < CELLS; k++) simB[k] = clamp(simB[k], 396, 463.5);
    const t = simA; simA = simB; simB = t;
  }
  const store = step => { const o = step * CELLS; for (let k = 0; k < CELLS; k++) snaps[o + k] = clamp(Math.round((simA[k] - 400) * 4), 0, 255); };

  let simStep = 0;
  function start(onProgress) {
    (function chunk() {
      const t0 = performance.now();
      if (simStep === 0 && ready < 0) { for (let s = -120; s < 0; s++) stepSim(s * DT); store(0); ready = 0; }
      while (simStep < STEPS && performance.now() - t0 < 30) { stepSim(simStep * DT); simStep++; store(simStep); ready = simStep; }
      onProgress && onProgress(Math.round(ready / STEPS * 100));
      if (simStep < STEPS) setTimeout(chunk, 0);
    })();
  }
  function fieldAt(h, out) {
    const s = clamp(h / DT, 0, Math.max(0, ready)), k = Math.floor(s), f = s - k, k2 = Math.min(k + 1, Math.max(0, ready)), o1 = k * CELLS, o2 = k2 * CELLS;
    for (let c = 0; c < CELLS; c++) out[c] = 400 + (snaps[o1 + c] * (1 - f) + snaps[o2 + c] * f) / 4;
  }
  function sample(field, lon, lat) {
    const x = (wrap180(lon) + 180) / 2 - 0.5, y = clamp((90 - lat) / 2 - 0.5, 0, NY - 1.001);
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const xa = ((x0 % NX) + NX) % NX, xb = (xa + 1) % NX, ya = y0 * NX, yb = (y0 + 1) * NX;
    return (field[ya + xa] * (1 - fx) + field[ya + xb] * fx) * (1 - fy) + (field[yb + xa] * (1 - fx) + field[yb + xb] * fx) * fy;
  }
  function meanAt(h, roi) {
    const s = clamp(h / DT, 0, Math.max(0, ready)), k = Math.floor(s), f = s - k, k2 = Math.min(k + 1, Math.max(0, ready)), o1 = k * CELLS, o2 = k2 * CELLS;
    let sum = 0, mx = 0;
    for (let n = 0; n < roi.idx.length; n++) { const c = roi.idx[n], v = 400 + (snaps[o1 + c] * (1 - f) + snaps[o2 + c] * f) / 4; sum += v * roi.w[n]; if (v > mx) mx = v; }
    return [sum / roi.wsum, mx];
  }

  return { NX, NY, DT, HOURS, STEPS, START, CELLS, cellLat, cellLon, wind, SOURCES, sourceRate, season, dayFactor, start, fieldAt, sample, meanAt, readySteps: () => ready };
}
