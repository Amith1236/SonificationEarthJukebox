// =============================================================================
// THE WANING CANOPY · engine. One orbit of the GEDI laser over satellite
// imagery: each footprint is coloured by canopy health and played by four
// voices (instruments.js) following the rules in mapping.js. Words: content.js.
// =============================================================================
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mountShell } from '../../src/shared/shell.js';
import { prefs } from '../../src/shared/prefs.js';
import { content, transcript } from './content.js';
import { RULES, METRICS, voicesFor, statusOf } from './mapping.js';
import { createVoices } from './instruments.js';
import { mountCues } from '../../src/shared/cues.js';

const shell = mountShell({ id: 'canopy', transcript });
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const plain = t => t.replace(/\s*\|\|?\s*/g, ' ').replace(/[*…]/g, '').replace(/\s+/g, ' ').trim();

// ---------- static text ----------
$('kicker').textContent = content.kicker; $('title').textContent = content.title; $('lede').textContent = content.lede;
$('startBtn').textContent = content.startButton; $('startHint').textContent = content.startHint;
$('about').innerHTML = content.about; $('foot').textContent = content.footer;
$('howList').innerHTML = content.howItSounds.map(h => `<li>${h}</li>`).join('');
$('metricSel').innerHTML = Object.entries(METRICS).map(([k, m]) => `<option value="${k}">${m.label}</option>`).join('');

// ---------- data ----------
const data = await fetch('/data/canopy/gedi_l2b_dieback.json').then(r => r.json());
const cells = data.cells || [];
const N = cells.length;
const where = c => (content.regions.find(([a, b, x, y]) => c.lat_bin >= a && c.lat_bin < b && c.lon_bin >= x && c.lon_bin < y) || [, , , , content.elsewhere])[4];

const degraded = cells.filter(c => (c.dieback_index ?? 0) >= RULES.diebackCount).length;
const degradedPct = N ? degraded / N * 100 : 0;
$('stDiebackPct').textContent = `${degradedPct.toFixed(1)}%`;
$('stDiebackCnt').textContent = degraded.toLocaleString();
$('stIntactPct').textContent = `${(100 - degradedPct).toFixed(1)}%`;
$('stCo2').textContent = `${(cells.reduce((a, c) => a + (c.co2e_loss_t_ha || 0), 0) / (N || 1)).toFixed(1)} tCO₂e/ha`;
$('stModel').textContent = `R² ${Number(data.metrics?.r2 ?? 0).toFixed(2)} · RMSE ${Number(data.metrics?.rmse_m ?? 0).toFixed(1)} m`;
const maxH = cells.reduce((m, c) => Math.max(m, c.rh100_m || 0), 0);

// ---------- map ----------
const map = L.map('map', { preferCanvas: true, keyboard: false, zoomSnap: 0.25, zoomControl: false }).setView([20, 50], 3);
L.control.zoom({ position: 'topright' }).addTo(map);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Imagery © Esri, Maxar, Earthstar Geographics', maxZoom: 18,
}).addTo(map);
$('map').tabIndex = 0;

let metric = 'dieback_index', corridor = true;
const layer = L.layerGroup().addTo(map);
let ring = null;
const valueOf = c => c[metric] ?? c.dieback_index ?? 0;
function render() {
  const m = METRICS[metric];
  $('legTitle').textContent = m.label; $('legBar').style.background = m.css;
  $('legTicks').innerHTML = m.ticks.map(t => `<span>${t}</span>`).join('');
  layer.clearLayers();
  if (corridor) for (let i = 0; i < N; i += 6) { const c = cells[i]; L.circle([c.lat_bin, c.lon_bin], { radius: 14000, stroke: false, fillColor: m.color(valueOf(c)), fillOpacity: 0.14, interactive: false }).addTo(layer); }
  cells.forEach((c, i) => {
    const col = m.color(valueOf(c)), severe = metric === 'dieback_index' && statusOf(c) === 'severe';
    L.circleMarker([c.lat_bin, c.lon_bin], { radius: severe ? 5.5 : 4.2, color: col, fillColor: col, fillOpacity: 0.9, weight: severe ? 1 : 0 })
      .on('click', () => { start(false); select(i, false, true); }).addTo(layer);
  });
}
const fit = () => map.fitBounds(cells.map(c => [c.lat_bin, c.lon_bin]), { padding: [30, 30] });

// ---------- profile along the track ----------
const pc = $('profile'), px = pc.getContext('2d');
function drawProfile() {
  const r = pc.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  if (pc.width !== Math.round(r.width * dpr)) { pc.width = Math.round(r.width * dpr); pc.height = Math.round(r.height * dpr); }
  px.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = r.width, h = r.height, step = w / N;
  px.clearRect(0, 0, w, h);
  cells.forEach((c, i) => {
    const bh = Math.min(h - 4, ((c.rh100_m || 0) / Math.max(RULES.maxHeight, maxH)) * (h - 6));
    px.fillStyle = METRICS.dieback_index.color(c.dieback_index ?? 0);
    px.fillRect(i * step, h - bh, Math.max(1.2, step), bh);
  });
  const sx = S.idx * step;
  px.fillStyle = '#ffffff'; px.fillRect(sx - 1, 0, 2, h);
}
pc.addEventListener('click', e => { const r = pc.getBoundingClientRect(); start(false); select(Math.floor((e.clientX - r.left) / r.width * N), true, true); });

// ---------- sound ----------
let ac = null, voices = null;
function initAudio() {
  if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); voices = createVoices(ac); voices.setVolume($('vol').value / 100); }
  if (ac.state === 'suspended') ac.resume();
}
function sound(c) {
  const v = voicesFor(c);
  cues(c, v);
  if (voices && S.audible) voices.play(v);
}
// the live strip under the map: each data value next to the sound it drives
const word = (x, lo, mid, hi) => (x < 0.33 ? lo : x < 0.66 ? mid : hi);
const strip = mountCues('#cues', [
  { id: 'height', label: 'Canopy height', sound: 'Main voice', rule: 'taller forest → higher note', color: '#06b6d4' },
  { id: 'health', label: 'Canopy health', sound: 'Shimmer', rule: 'healthier → brighter octave above', color: '#10b981' },
  { id: 'stress', label: 'Dieback stress', sound: 'Dissonance', rule: 'more dieback → louder, sour clash', color: '#ef4444' },
  { id: 'elev', label: 'Ground elevation', sound: 'Low drone', rule: 'higher ground → higher drone', color: '#a8a29e' },
]);
function cues(c, v) {
  const hT = clamp(c.rh100_m / RULES.maxHeight, 0, 1), st = v.stress;
  strip.set('height', { value: `${c.rh100_m.toFixed(1)} m`, meter: hT, sound: `${v.pad.freq.toFixed(0)} Hz · ${word(hT, 'low', 'middle', 'high')}` });
  strip.set('health', { value: `${Math.round((1 - st) * 100)}%`, meter: 1 - st, sound: word(1 - st, 'faint', 'soft', 'bright') });
  strip.set('stress', { value: `${Math.round(st * 100)}%`, meter: st, sound: st > 0.5 ? 'loud · minor third' : st > 0.25 ? 'quiet · fifth' : 'almost silent' });
  strip.set('elev', { value: `${Math.round(c.elev_m || 0)} m`, meter: (c.elev_m || 0) / 1000, sound: `${v.sub.freq.toFixed(0)} Hz` });
}

// ---------- selection ----------
const S = { idx: 0, playing: false, audible: false, started: false, timer: null, lastSpeak: 0, lastWhere: '' };
function caption(t) { $('cap').textContent = plain(t); }
function say(t, o) { caption(t); shell.say(t, o); }
function describe(c) {
  const st = statusOf(c), def = c.height_deficit_m ?? 0;
  return `${content.status[st]}, ${where(c)}. Footprint ${S.idx + 1} of ${N}. Canopy ${c.rh100_m.toFixed(1)} metres, expected ${(c.pred_rh100_m ?? c.rh100_m).toFixed(1)}, ${def >= 0 ? 'above' : 'below'} by ${Math.abs(def).toFixed(1)}. Cover ${Math.round((c.canopy_cover ?? 0) * 100)} percent. Dieback stress ${Math.round((c.dieback_index ?? 0) * 100)} percent.`;
}
function select(i, pan = true, speak = false) {
  if (!N) return;
  S.idx = clamp(i, 0, N - 1);
  const c = cells[S.idx], st = statusOf(c), def = c.height_deficit_m ?? 0;
  $('scrubber').value = S.idx;
  $('scrubber').setAttribute('aria-valuetext', `Footprint ${S.idx + 1} of ${N}: ${content.status[st]}, ${c.rh100_m.toFixed(0)} metres`);
  $('selStatus').innerHTML = `<span class="st-${st}">${content.status[st]}</span>`;
  $('selPos').textContent = `${S.idx + 1} / ${N}`;
  $('selCoord').textContent = `${c.lat_bin.toFixed(2)}°, ${c.lon_bin.toFixed(2)}°`;
  $('selRh').textContent = `${c.rh100_m.toFixed(1)} m`;
  $('selPred').textContent = `${(c.pred_rh100_m ?? c.rh100_m).toFixed(1)} m`;
  $('selDef').textContent = `${def >= 0 ? '+' : ''}${def.toFixed(1)} m`;
  $('selCover').textContent = `${((c.canopy_cover ?? 0) * 100).toFixed(0)}%`;
  if (ring) map.removeLayer(ring);
  ring = L.circleMarker([c.lat_bin, c.lon_bin], { radius: 11, color: '#ffffff', weight: 2.5, fillOpacity: 0, interactive: false }).addTo(map);
  if (pan) map.panTo([c.lat_bin, c.lon_bin], { animate: !prefs.reduceMotion, duration: 0.25 });
  drawProfile();
  sound(c);
  if (speak) say(describe(c));
}

// ---------- playback ----------
function start(play = true) {
  initAudio(); S.audible = true; $('startOverlay').hidden = true;
  if (!S.started) { S.started = true; say(content.intro); S.lastSpeak = performance.now(); }
  if (play) setPlaying(true);
}
function narrateWhilePlaying(c) {
  const now = performance.now(), w = where(c);
  if (w !== S.lastWhere) { S.lastWhere = w; if (S.idx > 0) { say(content.enterRegion(w), { queue: true }); S.lastSpeak = now; } return; }
  if (now - S.lastSpeak < RULES.speakEverySec * 1000) return;
  const st = statusOf(c);
  if (st === 'severe') { say(content.severeLine(c, w)); S.lastSpeak = now; }
  else if (st === 'intact' && c.rh100_m > 25) { say(content.intactLine(c, w)); S.lastSpeak = now; }
}
function setPlaying(on) {
  S.playing = on; clearInterval(S.timer);
  $('playBtn').textContent = on ? 'Pause' : 'Play'; $('playBtn').setAttribute('aria-pressed', String(on));
  if (on) {
    if (S.idx >= N - 1) select(0);
    S.lastWhere = where(cells[S.idx]);
    S.timer = setInterval(() => {
      if (S.idx >= N - 1) { setPlaying(false); say(content.outro); return; }
      select(S.idx + 1, (S.idx + 1) % RULES.panEvery === 0);
      narrateWhilePlaying(cells[S.idx]);
    }, RULES.stepMs);
  } else {
    voices?.silence();
  }
}
function step(d) { start(false); if (S.playing) setPlaying(false); select(S.idx + d, true, false); sound(cells[S.idx]); caption(describe(cells[S.idx])); shell.say(describe(cells[S.idx]), { speak: false }); }
function jumpTo(kind) {
  start(false); if (S.playing) setPlaying(false);
  let best = 0, score = -Infinity;
  cells.forEach((c, i) => { const s = kind === 'intact' ? (c.rh100_m || 0) * (1 - (c.dieback_index ?? 0)) : (c.dieback_index ?? 0) + (c.pred_rh100_m ?? 0) / 1000; if (s > score) { score = s; best = i; } });
  select(best, false, true); map.setView([cells[best].lat_bin, cells[best].lon_bin], kind === 'intact' ? 11 : 12, { animate: !prefs.reduceMotion });
}

// ---------- controls ----------
$('startBtn').addEventListener('click', () => { start(true); $('map').focus(); });
$('playBtn').addEventListener('click', () => { start(false); setPlaying(!S.playing); });
$('prevBtn').addEventListener('click', () => step(-1));
$('nextBtn').addEventListener('click', () => step(1));
$('intactBtn').addEventListener('click', () => jumpTo('intact'));
$('severeBtn').addEventListener('click', () => jumpTo('severe'));
$('describeBtn').addEventListener('click', () => say(describe(cells[S.idx])));
$('scrubber').max = Math.max(0, N - 1);
$('scrubber').addEventListener('input', e => { start(false); if (S.playing) setPlaying(false); select(+e.target.value, true); });
$('metricSel').addEventListener('change', e => { metric = e.target.value; render(); });
$('corridorBtn').addEventListener('click', e => { corridor = !corridor; e.currentTarget.setAttribute('aria-pressed', String(corridor)); render(); });
$('fitBtn').addEventListener('click', fit);
$('vol').addEventListener('input', e => voices?.setVolume(e.target.value / 100));
document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea' || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  if (k === ' ' && tag !== 'button') { e.preventDefault(); start(false); setPlaying(!S.playing); }
  else if (k === 'ArrowRight' || k === 'ArrowLeft') { if (tag === 'button') return; e.preventDefault(); step((k === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1)); }
  else if (k === 'i' || k === 'I') jumpTo('intact');
  else if (k === 's' || k === 'S') jumpTo('severe');
  else if (k === 'd' || k === 'D') say(describe(cells[S.idx]));
});
addEventListener('resize', () => { clearTimeout(window.__rz); window.__rz = setTimeout(() => { map.invalidateSize(); drawProfile(); }, 120); });

render(); fit(); select(0, false);
requestAnimationFrame(() => { map.invalidateSize(); fit(); });
