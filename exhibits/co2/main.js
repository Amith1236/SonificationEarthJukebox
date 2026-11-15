// =============================================================================
// CARBON CURRENTS · engine: map view, flowing currents, place selection,
// statistics, the piano scheduler and all controls.
// Words: content.js · data: sim.js · music rules: mapping.js · piano: instruments.js
// =============================================================================
import { geoEquirectangular, geoPath, geoGraticule10, geoContains, geoDistance } from 'd3-geo';
import { mountShell } from '../../src/shared/shell.js';
import { prefs } from '../../src/shared/prefs.js';
import { content, transcript } from './content.js';
import { loadCountries, CITIES, REGIONS } from './geo.js';
import { createSimulation, wrap180 } from './sim.js';
import { bpmOf, changeWord, tempoWord, band, intensityOf, colorOf, BPM_MIN, BPM_MAX, PHRASE, PPM_LO, PPM_HI, RISE_WINDOW_H, TEMPO_GLIDE_S } from './mapping.js';
import { createAudio } from './instruments.js';

const shell = mountShell({ id: 'co2', transcript, onPrefs: () => { baseDirty = true; } });
const $ = id => document.getElementById(id);
const RAD = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const VIS = content.visual;

// ---------- static text ----------
$('heroTitle').innerHTML = content.heroTitle; $('heroText').innerHTML = content.heroText; $('banner').innerHTML = content.banner;
$('startBtn').textContent = content.startButton; $('guideBtn').textContent = content.guideButton; $('live').textContent = content.welcome;
$('howIntro').innerHTML = content.howIntro; $('howOutro').innerHTML = content.howOutro;
$('howRows').innerHTML = content.howTable.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
$('dataParas').innerHTML = content.dataParas.map(p => `<p>${p}</p>`).join('');
$('accessCards').innerHTML = content.accessCards.map(([h, p]) => `<div class="panel"><h3>${h}</h3><p>${p}</p></div>`).join('');
$('foot').textContent = content.footer;
$('speed').value = String(content.defaultSpeed);

const settings = { get hc() { return prefs.highContrast; }, get reduce() { return prefs.reduceMotion; }, narr: 'key' };
let baseDirty = true;

const COUNTRIES = await loadCountries();
const sim = createSimulation(COUNTRIES);
const { NX, NY, DT, HOURS, START, CELLS, cellLat } = sim;
$('loading').hidden = true;

// =====================================================================
// Map view
// =====================================================================
const map = $('map'), mctx = map.getContext('2d');
const base = document.createElement('canvas'), bctx = base.getContext('2d');
const trails = document.createElement('canvas'), tctx = trails.getContext('2d');
const co2c = document.createElement('canvas'); co2c.width = NX; co2c.height = NY; const cctx = co2c.getContext('2d'); const co2img = cctx.createImageData(NX, NY);
let W = 0, H = 0, DPR = 1;
const viewState = { lon: 15, lat: 10, k: 1 };
const proj = geoEquirectangular();
const scale = () => W / (2 * Math.PI) * viewState.k;
function clampView() { const s = scale(), halfH = (H / 2) / s / RAD; viewState.lat = halfH >= 90 ? 0 : clamp(viewState.lat, -90 + halfH, 90 - halfH); viewState.lon = wrap180(viewState.lon); }
function updateProj() { clampView(); const s = scale(); proj.rotate([-viewState.lon, 0]).scale(s).translate([W / 2, H / 2 + s * viewState.lat * RAD]).precision(0.3); }
const toScreen = (lon, lat) => { const s = scale(); return [W / 2 + s * wrap180(lon - viewState.lon) * RAD, H / 2 + s * (viewState.lat - lat) * RAD]; };
const toLonLat = (x, y) => { const s = scale(); return [wrap180(viewState.lon + (x - W / 2) / s / RAD), clamp(viewState.lat - (y - H / 2) / s / RAD, -89.9, 89.9)]; };

function resize() {
  const r = map.parentElement.getBoundingClientRect(); DPR = Math.min(2, window.devicePixelRatio || 1);
  W = Math.round(r.width); H = Math.round(Math.max(320, Math.min(W / 2, window.innerHeight * 0.68)));
  [map, base, trails].forEach(c => { c.width = W * DPR; c.height = H * DPR; });
  map.style.height = H + 'px';
  [mctx, bctx, tctx].forEach(x => x.setTransform(DPR, 0, 0, DPR, 0, 0));
  baseDirty = true; resetParticles();
}
function drawBase() {
  updateProj();
  const hc = settings.hc, path = geoPath(proj, bctx);
  bctx.fillStyle = hc ? '#000' : '#050a16'; bctx.fillRect(0, 0, W, H);
  bctx.beginPath(); path(geoGraticule10()); bctx.strokeStyle = hc ? 'rgba(255,255,255,.25)' : 'rgba(120,145,200,.10)'; bctx.lineWidth = 1; bctx.stroke();
  bctx.beginPath(); path({ type: 'FeatureCollection', features: COUNTRIES }); bctx.fillStyle = hc ? '#1a1a1a' : '#141c2e'; bctx.fill();
  bctx.strokeStyle = hc ? 'rgba(255,255,255,.75)' : 'rgba(150,170,215,.3)'; bctx.lineWidth = hc ? 1.2 : 0.7; bctx.stroke();
  if (sel.country) { bctx.beginPath(); path(sel.country); bctx.strokeStyle = hc ? '#00e5ff' : '#7cc4ff'; bctx.lineWidth = 2.5; bctx.stroke(); }
  if (sel.box) {
    const a = toScreen(sel.box[0], sel.box[3]), b = toScreen(sel.box[2], sel.box[1]);
    bctx.setLineDash([8, 6]); bctx.strokeStyle = hc ? '#00e5ff' : '#7cc4ff'; bctx.lineWidth = 2; bctx.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); bctx.setLineDash([]);
  }
  const k = viewState.k, maxRank = k < 1.6 ? 0 : k < 2.5 ? 30 : k < 4 ? 70 : 999;
  bctx.font = (k < 4 ? 12 : 13) + 'px system-ui, sans-serif'; bctx.textBaseline = 'middle';
  CITIES.forEach(c => {
    if (c.rank >= maxRank) return;
    const p = toScreen(c.lon, c.lat); if (p[0] < -20 || p[0] > W + 20 || p[1] < -10 || p[1] > H + 10) return;
    bctx.fillStyle = hc ? '#fff' : 'rgba(220,230,250,.85)'; bctx.beginPath(); bctx.arc(p[0], p[1], 2.2, 0, Math.PI * 2); bctx.fill();
    bctx.fillStyle = hc ? '#fff' : 'rgba(220,230,250,.75)'; bctx.fillText(c.name, p[0] + 5, p[1]);
  });
  baseDirty = false;
}
const cur = new Float32Array(CELLS);
function drawCO2() {
  const d = co2img.data;
  for (let c = 0; c < CELLS; c++) {
    const col = colorOf(cur[c]), o = c * 4;
    if (!col) { d[o + 3] = 0; continue; }
    d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = col[3] * 255 * (settings.hc ? 1 : 0.85);
  }
  cctx.putImageData(co2img, 0, 0);
  const s = scale(), Wd = 2 * Math.PI * s, Hd = Math.PI * s, top = H / 2 + s * (viewState.lat - 90) * RAD;
  let x0 = W / 2 + s * (-180 - viewState.lon) * RAD; x0 = ((x0 % Wd) + Wd) % Wd - Wd;
  mctx.imageSmoothingEnabled = true; mctx.imageSmoothingQuality = 'high';
  for (let x = x0; x < W; x += Wd) mctx.drawImage(co2c, x, top, Wd, Hd);
}

// flowing currents
let parts = [], NPART = VIS.particles;
function spawn(p) {
  const s = scale(), hw = Math.min(180, (W / 2) / s / RAD), hh = Math.min(85, (H / 2) / s / RAD);
  p.lon = wrap180(viewState.lon + (Math.random() * 2 - 1) * hw); p.lat = clamp(viewState.lat + (Math.random() * 2 - 1) * hh, -85, 85);
  p.age = 0; p.max = 60 + Math.random() * 90;
}
function resetParticles() {
  NPART = W < 700 ? Math.round(VIS.particles / 2) : VIS.particles;
  parts = []; for (let i = 0; i < NPART; i++) { const p = {}; spawn(p); p.age = Math.random() * p.max; parts.push(p); }
  tctx.clearRect(0, 0, W, H);
}
function drawParticles(dt) {
  tctx.globalCompositeOperation = 'destination-in'; tctx.fillStyle = `rgba(0,0,0,${VIS.trailFade})`; tctx.fillRect(0, 0, W, H);
  tctx.globalCompositeOperation = VIS.glow && !settings.hc ? 'lighter' : 'source-over';
  const visK = 0.55 / Math.sqrt(viewState.k) * VIS.speed, h = simHour;
  tctx.lineWidth = settings.hc ? 1.8 : VIS.lineWidth; tctx.lineCap = 'round';
  for (const p of parts) {
    p.age += 1;
    if (p.age > p.max) { spawn(p); continue; }
    const w = sim.wind(p.lon, p.lat, h), a = toScreen(p.lon, p.lat);
    p.lon = wrap180(p.lon + w[0] * visK * dt * 6 / Math.max(0.2, Math.cos(p.lat * RAD)) / viewState.k);
    p.lat = clamp(p.lat + w[1] * visK * dt * 6 / viewState.k, -85, 85);
    const b = toScreen(p.lon, p.lat);
    if (Math.abs(b[0] - a[0]) > W / 3 || b[0] < -5 || b[0] > W + 5 || b[1] < -5 || b[1] > H + 5) { spawn(p); continue; }
    const col = colorOf(sim.sample(cur, p.lon, p.lat)), fade = Math.min(1, p.age / 10, (p.max - p.age) / 15);
    tctx.strokeStyle = col ? `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${(Math.min(1, col[3] + 0.3) * fade * (VIS.glow ? 0.75 : 1)).toFixed(2)})`
      : (settings.hc ? 'rgba(255,255,255,' : 'rgba(170,195,240,') + (0.2 * fade).toFixed(2) + ')';
    tctx.beginPath(); tctx.moveTo(a[0], a[1]); tctx.lineTo(b[0], b[1]); tctx.stroke();
  }
  tctx.globalCompositeOperation = 'source-over';
}
function drawOverlay() {
  if (!sel.pin) return;
  const p = toScreen(sel.pin[0], sel.pin[1]), hc = settings.hc;
  if (sel.radius) {
    mctx.beginPath(); mctx.arc(p[0], p[1], sel.radius * RAD * scale(), 0, Math.PI * 2); mctx.strokeStyle = hc ? '#00e5ff' : 'rgba(124,196,255,.8)'; mctx.setLineDash([6, 5]); mctx.lineWidth = 2; mctx.stroke(); mctx.setLineDash([]);
  }
  mctx.fillStyle = hc ? '#00ff66' : '#ff5a5a'; mctx.strokeStyle = '#fff'; mctx.lineWidth = 2;
  mctx.beginPath(); mctx.arc(p[0], p[1] - 14, 8, 0, Math.PI * 2); mctx.fill(); mctx.stroke();
  mctx.beginPath(); mctx.moveTo(p[0] - 6, p[1] - 9); mctx.lineTo(p[0] + 6, p[1] - 9); mctx.lineTo(p[0], p[1]); mctx.closePath(); mctx.fill();
  mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.arc(p[0], p[1] - 14, 3, 0, Math.PI * 2); mctx.fill();
}

// =====================================================================
// Selection (pin / city / country / region) and statistics
// =====================================================================
const sel = { kind: 'world', name: 'The whole world', sub: 'Pick a place to hear its CO₂', pin: null, radius: 0, country: null, box: null, roi: null };
function roiWorld() { const idx = [], w = []; let s = 0; for (let c = 0; c < CELLS; c++) { const ww = Math.cos(cellLat((c / NX) | 0) * RAD); idx.push(c); w.push(ww); s += ww; } return { idx, w, wsum: s }; }
function roiCircle(lon, lat, r) {
  const idx = [], w = []; let s = 0;
  for (let j = 0; j < NY; j++) { const la = cellLat(j); if (Math.abs(la - lat) > r * 2.5) continue;
    for (let i = 0; i < NX; i++) { const dl = wrap180(sim.cellLon(i) - lon) * Math.cos(lat * RAD), d2 = dl * dl + (la - lat) ** 2;
      if (d2 > r * r * 6) continue; const ww = Math.exp(-0.5 * d2 / (r * r)); idx.push(j * NX + i); w.push(ww); s += ww; } }
  return { idx, w, wsum: s || 1 };
}
function roiBox(b) {
  const idx = [], w = []; let s = 0;
  for (let j = 0; j < NY; j++) { const la = cellLat(j); if (la < b[1] || la > b[3]) continue;
    for (let i = 0; i < NX; i++) { const lo = sim.cellLon(i); if (lo < b[0] || lo > b[2]) continue; const ww = Math.cos(la * RAD); idx.push(j * NX + i); w.push(ww); s += ww; } }
  return { idx, w, wsum: s || 1 };
}
function roiCountry(f) {
  const c = document.createElement('canvas'); c.width = NX; c.height = NY; const x = c.getContext('2d', { willReadFrequently: true });
  const p = geoEquirectangular().scale(NX / (2 * Math.PI)).translate([NX / 2, NY / 2]);
  x.fillStyle = '#fff'; x.beginPath(); geoPath(p, x)(f); x.fill();
  const d = x.getImageData(0, 0, NX, NY).data, idx = [], w = []; let s = 0;
  for (let k = 0; k < CELLS; k++) if (d[k * 4 + 3] > 60) { const ww = Math.cos(cellLat((k / NX) | 0) * RAD); idx.push(k); w.push(ww); s += ww; }
  return idx.length < 2 ? roiCircle(f.centroid[0], f.centroid[1], 2.5) : { idx, w, wsum: s };
}
sel.roi = roiWorld();
function countryAt(lon, lat) {
  for (const f of COUNTRIES) {
    const b = f.bbox2, inLon = b[0][0] <= b[1][0] ? lon >= b[0][0] && lon <= b[1][0] : lon >= b[0][0] || lon <= b[1][0];
    if (!inLon || lat < b[0][1] || lat > b[1][1]) continue;
    if (geoContains(f, [lon, lat])) return f;
  }
  return null;
}
function nearestCity(lon, lat, maxKm) {
  let best = null, bd = 1e9;
  CITIES.forEach(c => { const d = geoDistance([lon, lat], [c.lon, c.lat]) * 6371; if (d < bd) { bd = d; best = c; } });
  return bd <= maxKm ? { city: best, km: bd } : null;
}
const fmtLL = (lon, lat) => `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;

function selectPin(lon, lat, announce) {
  const f = countryAt(lon, lat), nc = nearestCity(lon, lat, 120);
  Object.assign(sel, { kind: 'pin', pin: [lon, lat], radius: 3, country: null, box: null });
  sel.name = nc ? 'Near ' + nc.city.name : f ? f.properties.name : 'Open ocean';
  sel.sub = (f && nc ? f.properties.name + ' · ' : !f && !nc ? 'Ocean · ' : 'Dropped pin · ') + fmtLL(lon, lat);
  sel.roi = roiCircle(lon, lat, sel.radius);
  afterSelect(announce);
}
function selectCity(c) {
  Object.assign(sel, { kind: 'city', pin: [c.lon, c.lat], radius: 3, country: null, box: null, name: c.name, sub: c.country + ' · ' + fmtLL(c.lon, c.lat), roi: roiCircle(c.lon, c.lat, 3) });
  flyTo(c.lon, c.lat, 4); afterSelect(true);
}
function selectCountry(f) {
  Object.assign(sel, { kind: 'country', country: f, box: null, pin: f.centroid.slice(), radius: 0, name: f.properties.name, sub: 'Country · CO₂ averaged over its whole area', roi: roiCountry(f) });
  const b = f.bbox2, span = Math.max(((b[1][0] - b[0][0]) + 360) % 360 || 360, (b[1][1] - b[0][1]) * 2);
  flyTo(f.centroid[0], f.centroid[1], clamp(260 / Math.max(span, 4), 1, 9)); afterSelect(true);
}
function selectRegion(r) {
  const b = r.box;
  Object.assign(sel, { kind: 'region', box: b, country: null, pin: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], radius: 0, name: r.name, sub: 'Region · CO₂ averaged over the dashed box', roi: roiBox(b) });
  flyTo(sel.pin[0], sel.pin[1], clamp(240 / Math.max(b[2] - b[0], (b[3] - b[1]) * 2), 1, 8)); afterSelect(true);
}
function selectWorld() {
  Object.assign(sel, { kind: 'world', pin: null, country: null, box: null, radius: 0, name: 'The whole world', sub: 'Global average · pick a place to zoom in', roi: roiWorld() });
  flyTo(15, 10, 1); afterSelect(true);
}
function afterSelect(announce) {
  $('placeName').firstChild.nodeValue = sel.name; $('placeSub').textContent = sel.sub;
  baseDirty = true; lastBand = -1; updateStats(); if (music.on) { MS = computeMS(); $('hearing').innerHTML = musicText(MS); }
  map.setAttribute('aria-label', `World map. Listening to ${sel.name}. ${sel.sub}.`);
  if (announce) say(describe(true));
}
let fly = null;
function flyTo(lon, lat, k) {
  if (settings.reduce) { Object.assign(viewState, { lon, lat, k }); baseDirty = true; resetParticles(); return; }
  fly = { t0: performance.now(), lon0: viewState.lon, lat0: viewState.lat, k0: viewState.k, dl: wrap180(lon - viewState.lon), lat1: lat, k1: k };
}

let stats = { ppm: 415, peak: 415, trend: 0, u: 0, v: 0, speed: 0, near: [] };
function updateStats() {
  const h = simHour, m = sim.meanAt(h, sel.roi), m12 = sim.meanAt(Math.max(0, h - 12), sel.roi), ref = sel.pin || [0, 0];
  const w = sel.pin ? sim.wind(ref[0], ref[1], h) : [12, 0];
  stats = { ppm: m[0], peak: m[1], trend: m[0] - m12[0], u: w[0], v: w[1], speed: Math.hypot(w[0], w[1]),
    localHour: ((h % 24) + ref[0] / 15 + 48) % 24, day: sel.pin ? sim.dayFactor(ref[0], h) > 0 : null, near: nearbySources(h) };
  renderStats();
}
function nearbySources(h) {
  if (!sel.pin) return [];
  const seen = {}, out = [];
  sim.SOURCES.forEach(s => {
    const km = geoDistance(sel.pin, [s.lon, s.lat]) * 6371, r = sim.sourceRate(s, h) / s.A;
    if (km < 1600 && !seen[s.name] && (s.kind === 'urban' || sim.season(s.kind, h) > 0.3)) { seen[s.name] = 1; out.push({ name: s.name, km, kind: s.kind, active: r }); }
  });
  return out.sort((a, b) => a.km - b.km).slice(0, 2);
}
const DIR16 = ['north', 'north-northeast', 'northeast', 'east-northeast', 'east', 'east-southeast', 'southeast', 'south-southeast', 'south', 'south-southwest', 'southwest', 'west-southwest', 'west', 'west-northwest', 'northwest', 'north-northwest'];
const compass = (u, v) => DIR16[Math.round((((Math.atan2(u, v) / RAD) + 360) % 360) / 22.5) % 16];
function windText() {
  if (!sel.pin) return 'Global westerly jet streams carry CO₂ eastward';
  if (stats.speed < 1.5) return 'Calm';
  return `From the ${compass(-stats.u, -stats.v)}, ${Math.round(stats.speed * 3.6)} km/h, carrying CO₂ toward the ${compass(stats.u, stats.v)}`;
}
const trendText = () => { const t = stats.trend; return Math.abs(t) < 0.4 ? 'Steady' : `${t > 0 ? 'Rising' : 'Falling'} (${t > 0 ? '+' : ''}${t.toFixed(1)} ppm in 12 h)`; };
function timeText() {
  if (!sel.pin) return dateStr(simHour, true);
  const lh = stats.localHour, hh = Math.floor(lh), mm = Math.floor((lh - hh) * 60 / 15) * 15;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} solar time · ${stats.day ? 'daytime' : 'night'}`;
}
function topHotspots() {
  const best = {}; sim.SOURCES.forEach(s => { const v = sim.sample(cur, s.lon, s.lat); if (!best[s.name] || v > best[s.name]) best[s.name] = v; });
  return Object.keys(best).sort((a, b) => best[b] - best[a]).slice(0, 3);
}
function nearText() {
  if (!sel.pin) return 'Strongest: ' + topHotspots().join(', ');
  if (!stats.near.length) return 'No major sources within 1,600 km';
  return stats.near.map(n => `${n.name} (${Math.round(n.km / 50) * 50} km${n.kind !== 'urban' ? (n.active > 0.5 ? ', burning now' : ', quieter now') : ''})`).join('; ');
}
function renderStats() {
  const p = stats.ppm;
  $('sPpm').textContent = `≈ ${p.toFixed(1)} ppm, ${content.bandWords[band(p)]}${sel.kind !== 'pin' && sel.kind !== 'city' ? ' · peak ' + stats.peak.toFixed(0) : ''}`;
  $('sPpmBar').style.width = clamp((p - 410) / 50 * 100, 0, 100) + '%';
  $('sTrend').textContent = trendText(); $('sWind').textContent = windText(); $('sTime').textContent = timeText(); $('sNear').textContent = nearText();
}
function describe(intro) {
  const p = stats.ppm; let t = '';
  t += intro ? `Listening to ${sel.name}${sel.kind === 'country' ? ', averaged over the whole country' : sel.kind === 'region' ? ', averaged over the region' : ''}. ` : `${sel.name}. `;
  t += dateStr(simHour, false) + (sel.pin ? `, ${stats.day ? 'daytime' : 'night'} locally` : '') + '. ';
  t += `CO₂ about ${Math.round(p)} ppm, ${content.bandWords[band(p)]}. ${trendText()}. ${windText()}. `;
  if (sel.pin && stats.near.length) t += `Nearby source: ${stats.near[0].name}${stats.near[0].kind !== 'urban' ? (stats.near[0].active > 0.5 ? ', actively burning' : ', quieter at the moment') : ''}. `;
  if (!sel.pin) t += `Highest levels over ${topHotspots().slice(0, 2).join(' and ')}. `;
  if (music.on) t += `Music: ${music.summaryPlain}.`;
  return t;
}

// =====================================================================
// Time
// =====================================================================
let simHour = 0, playing = false, speedHps = content.defaultSpeed;
const MONTHS = ['January', 'February', 'March'];
function dateStr(h, short) {
  const d = new Date(START + h * 3600e3), hh = String(d.getUTCHours()).padStart(2, '0');
  return short ? `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr'][d.getUTCMonth()]} 2020, ${hh}:00 UTC` : `${d.getUTCDate()} ${MONTHS[Math.min(2, d.getUTCMonth())]} 2020, ${hh}:00 UTC`;
}
function updateTimeUI() {
  const d = new Date(START + simHour * 3600e3), hh = String(d.getUTCHours()).padStart(2, '0');
  $('dateOut').innerHTML = `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar'][Math.min(2, d.getUTCMonth())]} 2020<small>${hh}:00 UTC</small>`;
  const slider = $('time'); slider.value = Math.floor(simHour); slider.setAttribute('aria-valuetext', dateStr(simHour, false));
}
function setPlaying(on) {
  playing = on; $('playBtn').textContent = on ? '❚❚ Pause' : '▶ Play'; $('startBtn').textContent = on ? '❚❚ Pause' : content.startButton;
  if (on) { music.start(); if (simHour >= HOURS - 1) simHour = 0; } else music.stop();
  say(on ? `Playing from ${dateStr(simHour, false)}.` : `Paused at ${dateStr(simHour, false)}.`);
}

// =====================================================================
// Music: ONE piano, ONE melody, ONE volume. Tempo follows the rise and fall.
// =====================================================================
const music = { on: false, summaryPlain: '', vol: 0.8, demo: null, bpm: 60 };
let audio = null, nextT = 0, tickN = 0, schedTimer = null, MS = null, lastBand = -1, lastMonth = 0, phraseI = 0;
const initAudio = () => { if (!audio) audio = createAudio({ volume: music.vol }); else if (audio.ac.state === 'suspended') audio.ac.resume(); };
let localRange = { lo: PPM_LO, hi: PPM_HI, key: null };
function computeLocalRange() {
  if (sim.readySteps() < 12 || !sel.roi) return;
  let lo = 1e9, hi = -1e9;
  for (let st = 0; st <= sim.readySteps(); st += 3) { const m = sim.meanAt(st * DT, sel.roi)[0]; if (m < lo) lo = m; if (m > hi) hi = m; }
  if (hi - lo < 6) { const mid = (hi + lo) / 2; lo = mid - 3; hi = mid + 3; }
  localRange = { lo, hi, key: localRange.key };
}
const riseNow = () => sim.meanAt(simHour, sel.roi)[0] - sim.meanAt(Math.max(0, simHour - RISE_WINDOW_H), sel.roi)[0];
function liveValues() {
  const d = music.demo;
  if (d) return { ppm: d.ppm, rise: d.rise ?? 0, speed: d.speed, u: d.u, demo: true };
  return { ppm: stats.ppm, rise: riseNow(), speed: stats.speed, u: sel.pin ? stats.u : 0, demo: false };
}
function computeMS() {
  const want = sel.name + (sim.readySteps() >= sim.STEPS ? ':full' : '');
  if (localRange.key !== want && sim.readySteps() >= 12) { computeLocalRange(); localRange.key = want; }
  const v = liveValues(), b = band(v.ppm);
  if (!v.demo) { if (lastBand >= 0 && b !== lastBand) maybeAnnounceBand(b, lastBand); lastBand = b; }
  const I = v.demo ? clamp((v.ppm - PPM_LO) / (PPM_HI - PPM_LO), 0, 1) : intensityOf(v.ppm, localRange);
  return { ppm: v.ppm, I, r: v.rise, target: bpmOf(I, v.rise), pan: clamp(v.u / 14, -0.75, 0.75), b, demo: v.demo };
}
function musicText(S) {
  const bpm = Math.round(music.bpm), lean = S.pan > 0.15 ? 'leaning right (air moving east)' : S.pan < -0.15 ? 'leaning left (air moving west)' : 'centred';
  const trend = changeWord(S.r);
  const rel = S.demo ? '' : ` · ${Math.round(clamp((S.ppm - localRange.lo) / (localRange.hi - localRange.lo), 0, 1) * 100)}% of this place’s usual range`;
  music.summaryPlain = `the piano is ${tempoWord(bpm)} at ${bpm} beats per minute because CO₂ is ${trend.replace(/[↑↓]/g, '').replace('−', 'minus ')}, ${lean}`;
  const fill = Math.max(1, Math.round(clamp((Math.log(bpm) - Math.log(BPM_MIN)) / (Math.log(BPM_MAX) - Math.log(BPM_MIN)), 0, 1) * 10));
  return `Instrument: <b>piano</b>, same melody and volume throughout<br>Tempo: <b>${bpm} BPM, ${tempoWord(bpm)}</b> <span aria-hidden="true">${'▮'.repeat(fill)}${'▯'.repeat(10 - fill)}</span><br>CO₂: <b>about ${Math.round(S.ppm)} ppm</b>${rel}<br>Change: <b>${trend}</b><br>Sound: <b>${lean}</b>`;
}
let lastText = 0;
function scheduleTick(n, t) {
  if (n % 8 === 0 || !MS) { MS = computeMS(); monthMarker(); }
  if (performance.now() - lastText > 400) { lastText = performance.now(); $('hearing').innerHTML = musicText(MS); }
  audio.piano(PHRASE[phraseI++ % PHRASE.length], t, n % 4 === 0 ? 0.7 : 0.58, MS.pan);
  return 60 / music.bpm / 2;  // eighth notes
}
function monthMarker() {
  const mo = new Date(START + simHour * 3600e3).getUTCMonth();
  if (mo !== lastMonth && mo <= 2) { lastMonth = mo; say(`A new month begins: ${MONTHS[mo]} 2020. ${describe(false)}`); }
}
let lastTempoT = 0;
function updateTempo() {
  if (!MS) return;
  const now = performance.now(), dt = lastTempoT ? Math.min(0.2, (now - lastTempoT) / 1000) : 0.03; lastTempoT = now;
  const v = liveValues(); MS.ppm = v.ppm; MS.r = v.rise; MS.pan = clamp(v.u / 14, -0.75, 0.75);
  MS.I = v.demo ? clamp((v.ppm - PPM_LO) / (PPM_HI - PPM_LO), 0, 1) : intensityOf(v.ppm, localRange); MS.target = bpmOf(MS.I, MS.r);
  music.bpm *= Math.pow(MS.target / music.bpm, Math.min(1, dt / TEMPO_GLIDE_S));
}
function scheduler() { if (!music.on) return; updateTempo(); while (nextT < audio.ac.currentTime + 0.12) { nextT += scheduleTick(tickN, nextT); tickN++; } }
music.start = () => {
  initAudio(); if (music.on) return; music.on = true; nextT = audio.ac.currentTime + 0.1; tickN = 0; MS = null;
  lastMonth = new Date(START + simHour * 3600e3).getUTCMonth(); schedTimer = setInterval(scheduler, 30);
};
music.stop = () => { music.on = false; clearInterval(schedTimer); };
let lastBandSay = 0;
function maybeAnnounceBand(b, prev) {
  if (settings.narr !== 'key') return;
  const now = performance.now(); if (now - lastBandSay < 12000) return; lastBandSay = now;
  say(`CO₂ at ${sel.name} has moved ${b > prev ? 'up' : 'down'}: about ${Math.round(stats.ppm)} ppm, ${content.bandShort[b]}.`);
}
let rangeTimer = null;
function playRange() {
  initAudio(); clearTimeout(rangeTimer);
  const wasOn = music.on; if (wasOn) music.stop();
  say(content.rangeIntro);
  let t = audio.ac.currentTime + 2.6, n = 0;
  [[-1.4, 4], [0, 8], [1.4, 24]].forEach(([r, count]) => { const b = bpmOf(0.5, r); for (let i = 0; i < count; i++) { audio.piano(PHRASE[n++ % PHRASE.length], t, n % 4 === 1 ? 0.7 : 0.58, 0); t += 60 / b / 2; } t += 0.5; });
  rangeTimer = setTimeout(() => { if (wasOn && playing) music.start(); }, (t - audio.ac.currentTime) * 1000 + 1000);
}
let guideTimer = null;
function runGuide() {
  clearTimeout(guideTimer);
  if (!playing) setPlaying(true);
  let i = 0;
  (function next() {
    if (i >= content.guide.length) { music.demo = null; MS = null; return; }
    const g = content.guide[i++]; music.demo = g.demo ? { ...g.demo } : null; MS = null; say(g.text);
    guideTimer = setTimeout(next, g.dur);
  })();
}

// =====================================================================
// Narration: the visible card + screen-reader live region + optional voice
// =====================================================================
function say(text, opts) { $('live').textContent = text; shell.say(text, opts); }

// =====================================================================
// Search combobox
// =====================================================================
const INDEX = [];
CITIES.forEach(c => INDEX.push({ label: c.name, sub: 'City · ' + c.country, key: (c.name + ' ' + c.country).toLowerCase(), pick: () => selectCity(c) }));
COUNTRIES.forEach(f => INDEX.push({ label: f.properties.name, sub: 'Country', key: f.properties.name.toLowerCase(), pick: () => selectCountry(f) }));
REGIONS.forEach(r => INDEX.push({ label: r.name, sub: 'Region', key: r.name.toLowerCase(), pick: () => selectRegion(r) }));
const q = $('q'), sugs = $('sugs'); let results = [], active = -1;
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
INDEX.forEach(e => { e.nkey = norm(e.key); e.nlabel = norm(e.label); });
function search(text) {
  const t = norm(text.trim()); if (!t) return [];
  const scored = [];
  INDEX.forEach(e => {
    const lab = e.nlabel; let sc = -1;
    if (lab === t) sc = 100; else if (lab.indexOf(t) === 0) sc = 80; else if (lab.indexOf(' ' + t) > 0) sc = 60;
    else if (e.nkey.indexOf(t) === 0 || e.nkey.indexOf(' ' + t) > 0) sc = 40; else if (e.nkey.indexOf(t) > 0) sc = 20;
    if (sc < 0) return; if (e.sub !== 'Country' && e.sub !== 'Region') sc -= 5; scored.push([sc, e]);
  });
  return scored.sort((x, y) => y[0] - x[0]).slice(0, 8).map(x => x[1]);
}
function renderSugs() {
  sugs.textContent = '';
  if (!results.length) { sugs.hidden = true; q.setAttribute('aria-expanded', 'false'); q.removeAttribute('aria-activedescendant'); return; }
  results.forEach((r, i) => {
    const li = document.createElement('li'); li.id = 'sug' + i; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', String(i === active));
    const s1 = document.createElement('span'); s1.textContent = r.label; const s2 = document.createElement('small'); s2.textContent = r.sub;
    li.append(s1, s2); li.addEventListener('mousedown', e => { e.preventDefault(); choose(i); }); sugs.append(li);
  });
  sugs.hidden = false; q.setAttribute('aria-expanded', 'true');
  if (active >= 0) { q.setAttribute('aria-activedescendant', 'sug' + active); $('sug' + active)?.scrollIntoView({ block: 'nearest' }); } else q.removeAttribute('aria-activedescendant');
}
function choose(i) { const r = results[i]; if (!r) return; q.value = r.label; results = []; active = -1; renderSugs(); r.pick(); }
q.addEventListener('input', () => { results = search(q.value); active = -1; renderSugs(); });
q.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); if (!results.length) results = search(q.value); active = Math.min(results.length - 1, active + 1); renderSugs(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); renderSugs(); }
  else if (e.key === 'Enter') { e.preventDefault(); if (results.length) choose(active >= 0 ? active : 0); }
  else if (e.key === 'Escape') { e.preventDefault(); results = []; active = -1; renderSugs(); }
});
q.addEventListener('blur', () => setTimeout(() => { results = []; renderSugs(); }, 150));
const chips = document.querySelector('.chips');
content.quickPicks.forEach(([name, kind]) => {
  const b = document.createElement('button'); b.textContent = name;
  b.addEventListener('click', () => (kind === 'city' ? selectCity(CITIES.find(x => x.name === name)) : selectRegion(REGIONS.find(x => x.name === name))));
  chips.append(b);
});

// =====================================================================
// Map interaction (mouse, touch, keyboard)
// =====================================================================
let drag = null;
map.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false }; map.setPointerCapture(e.pointerId); fly = null; });
map.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) drag.moved = true;
  if (!drag.moved) return;
  const s = scale(); viewState.lon -= dx / s / RAD; viewState.lat += dy / s / RAD; drag.x = e.clientX; drag.y = e.clientY;
  baseDirty = true; tctx.clearRect(0, 0, W, H);
});
map.addEventListener('pointerup', e => {
  if (drag && !drag.moved) { const r = map.getBoundingClientRect(), ll = toLonLat(e.clientX - r.left, e.clientY - r.top); selectPin(ll[0], ll[1], true); }
  else if (drag && drag.moved) resetParticles();
  drag = null;
});
map.addEventListener('wheel', e => {
  e.preventDefault(); fly = null;
  const r = map.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, before = toLonLat(mx, my);
  viewState.k = clamp(viewState.k * Math.exp(-e.deltaY * 0.0015), 1, 12); updateProj();
  const after = toLonLat(mx, my); viewState.lon += wrap180(before[0] - after[0]); viewState.lat += before[1] - after[1];
  baseDirty = true; resetParticles();
}, { passive: false });
function zoomBy(f) { fly = null; viewState.k = clamp(viewState.k * f, 1, 12); if (sel.pin) { viewState.lon = sel.pin[0]; viewState.lat = sel.pin[1]; } baseDirty = true; resetParticles(); say(`Zoom ${viewState.k.toFixed(1)} times.`, { speak: false }); }
$('zin').addEventListener('click', () => zoomBy(1.6));
$('zout').addEventListener('click', () => zoomBy(1 / 1.6));
let moveSayT = null;
map.addEventListener('keydown', e => {
  const step = e.shiftKey ? 5 : 1, p = sel.pin ? sel.pin.slice() : [viewState.lon, viewState.lat];
  if (e.key === 'ArrowLeft') p[0] -= step; else if (e.key === 'ArrowRight') p[0] += step;
  else if (e.key === 'ArrowUp') p[1] += step; else if (e.key === 'ArrowDown') p[1] -= step;
  else if (e.key === '+' || e.key === '=') { zoomBy(1.6); return e.preventDefault(); }
  else if (e.key === '-' || e.key === '_') { zoomBy(1 / 1.6); return e.preventDefault(); }
  else if (e.key === '0' || e.key === 'Home') { selectWorld(); return e.preventDefault(); }
  else if (e.key === 'Enter') { say(describe(true)); return e.preventDefault(); }
  else return;
  e.preventDefault(); e.stopPropagation();
  p[0] = wrap180(p[0]); p[1] = clamp(p[1], -85, 85);
  selectPin(p[0], p[1], false);
  const sp = toScreen(p[0], p[1]); if (sp[0] < 40 || sp[0] > W - 40 || sp[1] < 40 || sp[1] > H - 40) { viewState.lon = p[0]; viewState.lat = p[1]; baseDirty = true; resetParticles(); }
  clearTimeout(moveSayT); moveSayT = setTimeout(() => say(`Pin at ${sel.name}, ${sel.sub.replace('Dropped pin · ', '')}. CO₂ about ${Math.round(stats.ppm)} ppm, ${content.bandWords[band(stats.ppm)]}.`), 450);
});

// =====================================================================
// Controls
// =====================================================================
$('startBtn').addEventListener('click', () => { if (!playing && !music.introDone) { music.introDone = true; shell.say(content.intro); } setPlaying(!playing); });
$('playBtn').addEventListener('click', () => setPlaying(!playing));
$('guideBtn').addEventListener('click', runGuide);
$('descBtn').addEventListener('click', () => say(describe(true)));
$('worldBtn').addEventListener('click', selectWorld);
const maxHour = () => Math.max(0, sim.readySteps()) * DT;
$('time').addEventListener('input', function () { simHour = Math.min(+this.value, maxHour()); updateTimeUI(); updateStats(); });
$('time').addEventListener('change', () => say(describe(false)));
$('speed').addEventListener('change', function () { speedHps = +this.value; });
document.querySelectorAll('[data-jump]').forEach(b => b.addEventListener('click', () => { simHour = Math.min(+b.dataset.jump, maxHour()); updateTimeUI(); updateStats(); say(`Jumped to ${dateStr(simHour, false)}. ${describe(false)}`); }));
$('rangeBtn').addEventListener('click', playRange);
function setVol(v) { music.vol = clamp(v, 0, 1); audio?.setVolume(music.vol); say(`Volume ${Math.round(music.vol * 100)}%.`, { speak: false }); }
$('volUp').addEventListener('click', () => setVol(music.vol + 0.1));
$('volDown').addEventListener('click', () => setVol(music.vol - 0.1));
$('narrSel').addEventListener('change', function () { settings.narr = this.value; });
prefs.onChange(k => { if (k === 'motion') tctx.clearRect(0, 0, W, H); if (k === 'text') setTimeout(resize, 50); baseDirty = true; });
document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  if ((tag === 'input' && e.target.type === 'text') || tag === 'select' || tag === 'textarea' || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === ' ' && tag !== 'button') { e.preventDefault(); setPlaying(!playing); }
  else if (e.key === 'd' || e.key === 'D') say(describe(true));
  else if (e.key === '/') { e.preventDefault(); q.focus(); }
});
addEventListener('resize', () => { clearTimeout(window.__rz); window.__rz = setTimeout(resize, 120); });

// =====================================================================
// Main loop
// =====================================================================
let last = performance.now(), statT = 0, uiT = 0, narrT = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (playing) {
    simHour = Math.min(simHour + speedHps * dt, maxHour());
    if (simHour >= HOURS - 0.01) { simHour = HOURS - 0.01; setPlaying(false); say('End of March 2020 reached. Press Play to start again from 1 January.'); }
  }
  if (fly) {
    const t = Math.min(1, (now - fly.t0) / 1100), s = t * t * (3 - 2 * t);
    viewState.lon = fly.lon0 + fly.dl * s; viewState.lat = fly.lat0 + (fly.lat1 - fly.lat0) * s; viewState.k = fly.k0 * Math.pow(fly.k1 / fly.k0, s);
    baseDirty = true; if (t >= 1) { fly = null; resetParticles(); } else tctx.clearRect(0, 0, W, H);
  }
  if (baseDirty) drawBase(); else updateProj();
  sim.fieldAt(simHour, cur);
  mctx.drawImage(base, 0, 0, W, H);
  drawCO2();
  if (!settings.reduce && !fly && !drag) drawParticles(dt);
  if (!settings.reduce) mctx.drawImage(trails, 0, 0, W, H);
  drawOverlay();
  statT += dt; uiT += dt; narrT += dt;
  if (uiT > 0.25) { uiT = 0; updateTimeUI(); }
  if (statT > 0.5) { statT = 0; updateStats(); }
  if (settings.narr === '30' && playing && narrT > 30) { narrT = 0; say(describe(false)); }
  requestAnimationFrame(frame);
}

resize();
sim.start(pct => {
  $('progress').textContent = pct < 100 ? `Preparing the simulation: ${pct}% (you can already play the start)` : 'Simulation ready: 1 January to 31 March 2020.';
});
updateStats();
requestAnimationFrame(frame);
window.__cc = { rise: riseNow, stats: () => stats, sel, music, ready: () => sim.readySteps(), setHour: h => { simHour = h; } };
