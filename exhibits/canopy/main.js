// =============================================================================
// THE WANING CANOPY · engine. The ISS sweeps along its ground tracks; each GEDI
// footprint rings, flares, then burns down to ash.
// Words: content.js · rules: mapping.js · sounds: instruments.js
// =============================================================================
import { geoEquirectangular, geoPath, geoGraticule } from 'd3-geo';
import { mountShell } from '../../src/shared/shell.js';
import { prefs } from '../../src/shared/prefs.js';
import { loadCountries } from '../../src/shared/world.js';
import { content, transcript } from './content.js';
import { RULES, bellNote, heightColor, ASH } from './mapping.js';
import { createRequiem } from './instruments.js';

const shell = mountShell({ id: 'canopy', transcript });
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fmtLL = (lat, lon) => `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;

$('kicker').textContent = content.kicker; $('title').textContent = content.title; $('lede').textContent = content.lede;
$('startBtn').textContent = content.startButton; $('startHint').textContent = content.startHint;
$('about').innerHTML = content.about; $('foot').textContent = content.footer;
$('howList').innerHTML = content.howItSounds.map(h => `<li>${h}</li>`).join('');

// ---------- data ----------
const [data, countries] = await Promise.all([fetch('/data/canopy/gedi_canopy_data.json').then(r => r.json()), loadCountries()]);
const cells = data.cells.map((c, i) => ({ ...c, i, burn: 0, burnT: -1, heard: false }));
if (data.sample) { $('sampleNote').hidden = false; $('sampleNote').textContent = content.sampleNote; }
$('mShots').textContent = data.metrics.total_footprints.toLocaleString(); $('mRmse').textContent = `${data.metrics.rmse_m} m`; $('mR2').textContent = data.metrics.r2;
// split into ISS passes: a new pass starts whenever latitude stops increasing (ascending tracks)
const passes = [];
cells.forEach((c, i) => { if (!i || c.lat_bin < cells[i - 1].lat_bin) passes.push([]); c.pass = passes.length - 1; passes[passes.length - 1].push(c); });
const bbox = cells.reduce((b, c) => [Math.min(b[0], c.lon_bin), Math.min(b[1], c.lat_bin), Math.max(b[2], c.lon_bin), Math.max(b[3], c.lat_bin)], [180, 90, -180, -90]);
const PAD = { lon: 6, lat: 5 };
const frame = { type: 'MultiPoint', coordinates: [[bbox[0] - PAD.lon, bbox[1] - PAD.lat], [bbox[2] + PAD.lon, bbox[3] + PAD.lat]] };
// straight-line fit of each pass (lon as a function of lat) to draw the full orbit track
const trackFits = passes.map(p => {
  const n = p.length, my = p.reduce((s, c) => s + c.lat_bin, 0) / n, mx = p.reduce((s, c) => s + c.lon_bin, 0) / n;
  const b = p.reduce((s, c) => s + (c.lat_bin - my) * (c.lon_bin - mx), 0) / p.reduce((s, c) => s + (c.lat_bin - my) ** 2, 0);
  return lat => mx + b * (lat - my);
});
const passSpacing = passes.length > 1 ? (trackFits[1](0) - trackFits[0](0)) : 5;
const passInfo = passes.map((p, k) => ({
  from: fmtLL(p[0].lat_bin, p[0].lon_bin), to: fmtLL(p[p.length - 1].lat_bin, p[p.length - 1].lon_bin),
  max: Math.round(Math.max(...p.map(c => c.rh100_m))), count: p.length, lost: p.filter(c => c.rh100_m < RULES.lossThreshold).length, lossThreshold: RULES.lossThreshold, k,
}));

// ---------- view ----------
const cv = $('map'), g = cv.getContext('2d');
const proj = geoEquirectangular(), path = geoPath(proj, g);
let W = 0, H = 0, DPR = 1, HK = 3;
const bg = document.createElement('canvas'), bgc = bg.getContext('2d');
function resize() {
  DPR = Math.min(2, devicePixelRatio || 1); W = cv.parentElement.clientWidth; H = Math.round(Math.max(300, Math.min(W * 0.62, innerHeight - 250)));
  cv.width = bg.width = W * DPR; cv.height = bg.height = H * DPR; cv.style.height = H + 'px';
  proj.fitExtent([[20, 20], [W - 20, H - 20]], frame);
  HK = H / 300;                                   // pixels per metre of canopy
  cells.forEach(c => { [c.x, c.y] = proj([c.lon_bin, c.lat_bin]); });
  drawBackground();
}
function drawBackground() {
  const x = bgc, hc = prefs.highContrast; x.setTransform(DPR, 0, 0, DPR, 0, 0);
  const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, hc ? '#000' : '#020605'); gr.addColorStop(1, hc ? '#000' : '#050a08');
  x.fillStyle = gr; x.fillRect(0, 0, W, H);
  const p = geoPath(proj, x);
  x.beginPath(); p(geoGraticule().step([5, 5])()); x.strokeStyle = hc ? 'rgba(255,255,255,.2)' : 'rgba(120,160,140,.07)'; x.lineWidth = 1; x.stroke();
  x.beginPath(); p({ type: 'FeatureCollection', features: countries }); x.fillStyle = hc ? '#111' : 'rgba(30,48,38,.35)'; x.fill();
  x.strokeStyle = hc ? 'rgba(255,255,255,.6)' : 'rgba(140,180,160,.18)'; x.lineWidth = 0.8; x.stroke();
  // ghost orbits: neighbouring ISS tracks that GEDI also flies
  x.setLineDash([2, 7]); x.lineWidth = 1;
  for (let k = -4; k < passes.length + 4; k++) {
    const fit = trackFits[clamp(k, 0, passes.length - 1)], off = (k - clamp(k, 0, passes.length - 1)) * passSpacing;
    x.beginPath();
    for (let lat = bbox[1] - PAD.lat - 2; lat <= bbox[3] + PAD.lat + 2; lat += 0.5) { const [px, py] = proj([fit(lat) + off, lat]); lat === bbox[1] - PAD.lat - 2 ? x.moveTo(px, py) : x.lineTo(px, py); }
    x.strokeStyle = k >= 0 && k < passes.length ? (hc ? 'rgba(255,255,255,.5)' : 'rgba(200,220,255,.28)') : 'rgba(200,220,255,.08)'; x.stroke();
  }
  x.setLineDash([]);
  x.font = '11px "JetBrains Mono", monospace'; x.fillStyle = 'rgba(200,220,255,.4)';
  passes.forEach((p, k) => { const [px, py] = proj([trackFits[k](bbox[3] + 2.5), bbox[3] + 2.5]); x.fillText(`ISS PASS ${k + 1}`, px + 6, py); });
}

// ---------- state ----------
const S = { idx: 0, playing: false, hover: -1, iss: null, started: false, lastPass: -1 };
const embers = [], pulses = [];
const heard = () => cells.filter(c => c.heard);
function updateForestStats() {
  const h = heard(), mean = h.length ? h.reduce((s, c) => s + c.rh100_m, 0) / h.length : 0, lost = h.filter(c => c.rh100_m < RULES.lossThreshold).length;
  $('fHeard').textContent = `${h.length} of ${cells.length}`;
  $('fMean').textContent = h.length ? `${mean.toFixed(1)} m` : '—';
  $('fLost').textContent = h.length ? `${lost} footprints (${Math.round(lost / h.length * 100)}%)` : '—';
  $('lifeBar').style.width = `${h.length ? clamp(mean / RULES.maxHeight, 0, 1) * 100 : 100}%`;
  return { mean, lost, n: h.length };
}
function showCell(i) {
  const c = cells[i];
  $('cPass').textContent = `${c.pass + 1} of ${passes.length}`;
  $('cCoords').textContent = fmtLL(c.lat_bin, c.lon_bin);
  $('cRh100').textContent = `${c.rh100_m.toFixed(1)} m (${c.shots} shots)${c.rh100_m < RULES.lossThreshold ? ' · thinned' : ''}`;
  $('cPred').textContent = `${c.pred_rh100_m.toFixed(1)} m`;
  $('cCover').textContent = `${Math.round(c.canopy_cover * 100)}%`;
  $('cAgb').textContent = `${c.agb_mg_ha.toFixed(0)} Mg/ha`;
}
const cellSentence = c => `Pass ${c.pass + 1}, ${fmtLL(c.lat_bin, c.lon_bin)}. Canopy ${c.rh100_m.toFixed(0)} metres${c.rh100_m < RULES.lossThreshold ? ', thinned forest' : ''}, cover ${Math.round(c.canopy_cover * 100)} percent, biomass ${c.agb_mg_ha.toFixed(0)} megagrams per hectare.`;
function caption(t) { $('cap').textContent = t.replace(/\s*\|\|?\s*/g, ' ').replace(/\*/g, ''); }

// ---------- sound ----------
let audio = null;
function initAudio() { if (!audio) { audio = createRequiem({ volume: $('vol').value / 100 }); audio.startDrone(RULES.root); } else if (audio.ac.state === 'suspended') audio.ac.resume(); }
function sound(c, t) {
  const pan = clamp((c.x / W) * 2 - 1, -0.8, 0.8), prev = cells[c.i - 1];
  if (c.rh100_m < RULES.lossThreshold) audio.toll(RULES.root + 12, t, { vel: 0.8, pan });
  else audio.bell(bellNote(c.rh100_m), t, { vel: 0.45 + 0.5 * c.canopy_cover, sustain: c.canopy_cover, bright: 0.4 + c.canopy_cover * 0.8, pan });
  audio.sub(RULES.root + 12, t, clamp(c.agb_mg_ha / 340, 0, 1));
  if (prev && prev.pass === c.pass && prev.rh100_m - c.rh100_m >= RULES.dropThreshold) audio.sigh(bellNote(prev.rh100_m), t + 0.05, { pan });
  const st = updateForestStats();
  audio.setDrone(1, st.n ? clamp(st.mean / RULES.maxHeight, 0, 1) : 1);
}
function hear(i, { at, speak = false } = {}) {
  const c = cells[i]; S.idx = i; showCell(i);
  if (audio) sound(c, at ?? audio.ac.currentTime + 0.01);
  c.heard = true; c.burnT = performance.now();
  pulses.push({ x: c.x, y: c.y, t: performance.now() });
  if (!prefs.reduceMotion) for (let k = 0; k < 4 + c.rh100_m / 8; k++) embers.push({ x: c.x + (Math.random() - 0.5) * 4, y: c.y - Math.random() * c.rh100_m * HK, vx: (Math.random() - 0.5) * 0.3, vy: -0.2 - Math.random() * 0.5, life: 1 });
  const prev = cells[i - 1];
  if (speak) shell.say(cellSentence(c), { speak: false });
  if (S.playing && prev && prev.pass === c.pass && prev.rh100_m - c.rh100_m >= RULES.dropThreshold * 1.6) caption(content.dropLine(prev.rh100_m.toFixed(0), c.rh100_m.toFixed(0)));
  else if (S.playing && c.rh100_m >= RULES.giantThreshold) caption(content.tallLine(c.rh100_m.toFixed(0)));
  cv.setAttribute('aria-label', `GEDI canopy map. ${cellSentence(c)}`);
}

// the station's flight: one footprint every RULES.stepSeconds, a pause between passes
let flightTimer = null;
function flyFrom(i) {
  clearTimeout(flightTimer);
  if (!S.playing) return;
  if (i >= cells.length) return finish();
  const c = cells[i];
  if (c.pass !== S.lastPass) {
    if (S.lastPass >= 0) shell.say(content.passSummary(S.lastPass + 1, passInfo[S.lastPass]), { queue: true });
    S.lastPass = c.pass;
    const line = content.passIntro(c.pass + 1, passes.length, passInfo[c.pass].from, passInfo[c.pass].to);
    caption(line); shell.say(line, { queue: true });
    S.iss = { from: c, to: c, t0: performance.now(), dur: 1 };
    flightTimer = setTimeout(() => step(i), RULES.passGapSeconds * 1000);
    return;
  }
  step(i);
}
function step(i) {
  if (!S.playing) return;
  const c = cells[i], nx = cells[i + 1];
  hear(i);
  S.iss = { from: c, to: nx && nx.pass === c.pass ? nx : c, t0: performance.now(), dur: RULES.stepSeconds * 1000 };
  flightTimer = setTimeout(() => flyFrom(i + 1), RULES.stepSeconds * 1000);
}
function finish() {
  shell.say(content.passSummary(S.lastPass + 1, passInfo[S.lastPass]), { queue: true });
  shell.say(content.outro, { queue: true });
  caption(content.outro);
  setPlaying(false, true);
  audio?.setDrone(0.6, 0.05);
}
function setPlaying(on, silent) {
  S.playing = on;
  $('playBtn').textContent = on ? 'Pause' : 'Play'; $('playBtn').setAttribute('aria-pressed', String(on));
  if (on) {
    initAudio(); $('startOverlay').hidden = true;
    if (!S.started) { S.started = true; shell.say(content.intro); caption(content.intro); flightTimer = setTimeout(() => flyFrom(S.idx), 9000); }
    else { if (S.idx >= cells.length - 1) S.idx = 0; flyFrom(cells[S.idx].heard ? S.idx + 1 : S.idx); }
  } else { clearTimeout(flightTimer); S.iss = null; if (!silent) shell.say('Paused.', { speak: false }); }
}

// ---------- drawing ----------
function draw() {
  requestAnimationFrame(draw);
  if (!W) return;
  const now = performance.now(), hc = prefs.highContrast, reduce = prefs.reduceMotion;
  g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(bg, 0, 0); g.setTransform(DPR, 0, 0, DPR, 0, 0);
  const activePass = S.playing || S.iss ? cells[S.idx].pass : -1;
  for (const c of cells) {
    if (c.heard) c.burn = reduce ? 1 : clamp((now - c.burnT) / 3200, 0, 1);
    const alive = heightColor(c.rh100_m), b = c.burn * 0.85, col = alive.map((v, k) => v + (ASH[k] - v) * b);
    const dim = activePass >= 0 && c.pass !== activePass ? 0.55 : 1;
    const hgt = Math.max(2, c.rh100_m * HK * (1 - 0.6 * c.burn));
    const flare = c.heard ? Math.max(0, 1 - (now - c.burnT) / 500) : 0;
    g.strokeStyle = `rgba(${col.map(v => v | 0).join(',')},${(0.9 * dim).toFixed(2)})`;
    g.lineWidth = (hc ? 3 : 2.2) + flare * 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(c.x, c.y); g.lineTo(c.x + (c.burn * 2.5), c.y - hgt); g.stroke();   // withered spikes lean slightly
    if (flare > 0) { g.fillStyle = `rgba(230,255,240,${flare})`; g.beginPath(); g.arc(c.x, c.y - hgt, 3 + flare * 4, 0, Math.PI * 2); g.fill(); }
    if (c.rh100_m < RULES.lossThreshold) { g.strokeStyle = `rgba(160,150,140,${0.8 * dim})`; g.lineWidth = 1.4; g.beginPath(); g.moveTo(c.x - 3, c.y - 3); g.lineTo(c.x + 3, c.y + 3); g.moveTo(c.x + 3, c.y - 3); g.lineTo(c.x - 3, c.y + 3); g.stroke(); }
  }
  // laser pulses on the ground
  for (let k = pulses.length - 1; k >= 0; k--) {
    const p = pulses[k], a = (now - p.t) / 900; if (a > 1) { pulses.splice(k, 1); continue; }
    g.strokeStyle = `rgba(200,255,225,${(1 - a) * 0.8})`; g.lineWidth = 1.5; g.beginPath(); g.arc(p.x, p.y, 3 + a * 22, 0, Math.PI * 2); g.stroke();
  }
  // ash rising
  for (let k = embers.length - 1; k >= 0; k--) {
    const e = embers[k]; e.x += e.vx; e.y += e.vy; e.life -= 0.006; if (e.life <= 0) { embers.splice(k, 1); continue; }
    g.fillStyle = `rgba(${e.life > 0.7 ? '255,170,90' : '150,140,130'},${e.life * 0.6})`; g.fillRect(e.x, e.y, 1.6, 1.6);
  }
  // the station
  if (S.iss) {
    const p = clamp((now - S.iss.t0) / S.iss.dur, 0, 1), x = S.iss.from.x + (S.iss.to.x - S.iss.from.x) * p, y = S.iss.from.y + (S.iss.to.y - S.iss.from.y) * p;
    const gl = g.createRadialGradient(x, y, 0, x, y, 26); gl.addColorStop(0, 'rgba(255,255,255,.95)'); gl.addColorStop(0.25, 'rgba(180,220,255,.45)'); gl.addColorStop(1, 'rgba(180,220,255,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(x, y, 26, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = '11px "JetBrains Mono", monospace'; g.fillText('ISS · GEDI', x + 12, y - 10);
  }
  // selection / hover ring
  const sel = cells[S.hover >= 0 ? S.hover : S.idx];
  if (sel && (S.started || S.hover >= 0)) { g.strokeStyle = '#ffd84d'; g.lineWidth = 2; g.beginPath(); g.arc(sel.x, sel.y, 7, 0, Math.PI * 2); g.stroke(); }
}

// ---------- input ----------
function nearest(e) {
  const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  let best = -1, bd = 22;
  cells.forEach((c, i) => { const d = Math.min(Math.hypot(c.x - mx, c.y - my), Math.abs(c.x - mx) < 4 && my < c.y && my > c.y - c.rh100_m * HK ? 0 : 99); if (d < bd) { bd = d; best = i; } });
  return best;
}
cv.addEventListener('pointermove', e => { const i = nearest(e); if (i !== S.hover) { S.hover = i; if (i >= 0) { showCell(i); if (audio && !S.playing) sound(cells[i], audio.ac.currentTime + 0.01); } } });
cv.addEventListener('pointerleave', () => { S.hover = -1; });
cv.addEventListener('click', e => { initAudio(); $('startOverlay').hidden = true; S.started = true; const i = nearest(e); if (i >= 0) hear(i, { speak: true }); });
function stepBy(d) { initAudio(); $('startOverlay').hidden = true; S.started = true; if (S.playing) setPlaying(false); hear(clamp(S.idx + d, 0, cells.length - 1), { speak: true }); }
function passBy(d) { const p = clamp(cells[S.idx].pass + d, 0, passes.length - 1); initAudio(); if (S.playing) setPlaying(false); S.started = true; $('startOverlay').hidden = true; hear(passes[p][0].i, { speak: true }); shell.say(content.passIntro(p + 1, passes.length, passInfo[p].from, passInfo[p].to), { queue: true }); }
document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'select' || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'ArrowRight' && (e.target === cv || tag === 'body')) { e.preventDefault(); stepBy(1); }
  else if (e.key === 'ArrowLeft' && (e.target === cv || tag === 'body')) { e.preventDefault(); stepBy(-1); }
  else if (e.key === 'PageDown') { e.preventDefault(); passBy(1); }
  else if (e.key === 'PageUp') { e.preventDefault(); passBy(-1); }
  else if (e.key === ' ' && tag !== 'button') { e.preventDefault(); setPlaying(!S.playing); }
  else if (e.key === 'd' || e.key === 'D') describe();
});
function describe() {
  const st = updateForestStats(), c = cells[S.idx];
  shell.say(`${cellSentence(c)} ${st.n ? `So far you have heard ${st.n} footprints, averaging ${st.mean.toFixed(0)} metres; ${st.lost} were thinned forest.` : ''}`);
}
$('startBtn').addEventListener('click', () => { setPlaying(true); cv.focus(); });
$('playBtn').addEventListener('click', () => setPlaying(!S.playing));
$('prevFp').addEventListener('click', () => stepBy(-1)); $('nextFp').addEventListener('click', () => stepBy(1));
$('prevPass').addEventListener('click', () => passBy(-1)); $('nextPass').addEventListener('click', () => passBy(1));
$('describeBtn').addEventListener('click', describe);
$('resetBtn').addEventListener('click', () => { setPlaying(false, true); cells.forEach(c => { c.heard = false; c.burn = 0; }); S.idx = 0; S.lastPass = -1; S.started = false; updateForestStats(); audio?.setDrone(1, 1); shell.say('The forest is restored.', { speak: true }); });
$('vol').addEventListener('input', e => audio?.setVolume(e.target.value / 100));
prefs.onChange(() => drawBackground());
addEventListener('resize', () => { clearTimeout(window.__rz); window.__rz = setTimeout(resize, 120); });

resize(); showCell(0); updateForestStats();
cv.setAttribute('aria-label', `GEDI canopy height map: ${cells.length} footprints along ${passes.length} ISS passes over the Amazon. Use the arrow keys to step through them.`);
requestAnimationFrame(draw);
