// =============================================================================
// AEROSOLS · engine. Reads the colours of a NASA GEOS frame, splits them into
// particle layers (layers.js) and plays each layer on its own instrument
// (instruments.js). Words: content.js. Melody model: src/shared/markov.js.
// =============================================================================
import { mountShell } from '../../src/shared/shell.js';
import { loadMelodyModel, createGuidedMelody } from '../../src/shared/markov.js';
import { prefs } from '../../src/shared/prefs.js';
import { content, transcript } from './content.js';
import { LAYERS as LAYER_SOUND, SCALES, ROOT, DEFAULTS } from './layers.js';
import { createInstruments } from './instruments.js';

const shell = mountShell({ id: 'aerosols', transcript });
const say = (t, o) => shell.say(t, o);
const $ = id => document.getElementById(id);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const LAYERS = LAYER_SOUND.map(L => ({ ...L, ...content.layers[L.id] }));
const IMG = content.image, STOPS = content.journey.stops;

// ---------- static text ----------
$('exKicker').textContent = content.kicker; $('exTitle').textContent = content.title; $('exLede').textContent = content.lede;
$('about').innerHTML = content.about; $('foot').textContent = content.footer;
$('startBtn').textContent = content.startButton; $('startHint').textContent = content.startHint; $('capTxt').textContent = content.idleCaption;
document.querySelectorAll('.tabs button').forEach(b => { b.textContent = content.modes[b.dataset.mode].label; });
$('scale').innerHTML = Object.keys(SCALES).map(s => `<option>${s}</option>`).join('');
$('howList').innerHTML = content.howItSounds.map(h => `<li>${h}</li>`).join('');

// ---------- state ----------
const cv = $('cv'), ctx = cv.getContext('2d');
const W = 1000, H = Math.round(W * IMG.height / IMG.width), GW = 240, GH = Math.round(GW * IMG.height / IMG.width);
cv.width = W; cv.height = H;
cv.setAttribute('aria-label', `${IMG.alt}. Use arrow keys to move the listening lens; press D to describe what is under it.`);
const base = document.createElement('canvas'); base.width = W; base.height = H;
let layerVals = {}, maskCanvases = {}, ready = false;
const S = {
  mode: 'story', playing: false, lens: { x: GW * 0.5, y: GH * 0.45, r: DEFAULTS.lens },
  bpm: DEFAULTS.bpm, thr: DEFAULTS.thr, rev: DEFAULTS.rev, vol: DEFAULTS.vol, fid: DEFAULTS.fid, scale: Object.keys(SCALES)[0],
  mute: {}, solo: {}, hl: null, storyIdx: 0, storyStep: 0, stopSteps: 96, visCol: -1, anim: null, ended: false,
};
let melody = createGuidedMelody(null);
loadMelodyModel().then(m => { if (!m) return; melody = createGuidedMelody(m); $('modelInfo').innerHTML = content.modelInfo(m); $('modelInfo').hidden = false; });

// ---------- image analysis ----------
const im = new Image();
im.onload = () => {
  base.getContext('2d').drawImage(im, 0, 0, W, H);
  const sm = document.createElement('canvas'); sm.width = GW; sm.height = GH;
  const sctx = sm.getContext('2d', { willReadFrequently: true }); sctx.imageSmoothingQuality = 'high'; sctx.drawImage(im, 0, 0, GW, GH);
  const d = sctx.getImageData(0, 0, GW, GH).data;
  for (const L of LAYERS) {
    const v = new Float32Array(GW * GH);
    for (let i = 0; i < GW * GH; i++) v[i] = L.classify(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    layerVals[L.id] = v;
    const mc = document.createElement('canvas'); mc.width = GW; mc.height = GH;
    const mctx = mc.getContext('2d'), md = mctx.createImageData(GW, GH);
    for (let i = 0; i < GW * GH; i++) md.data[i * 4 + 3] = Math.round((1 - clamp(v[i] * 1.6)) * 200);
    mctx.putImageData(md, 0, 0); maskCanvases[L.id] = mc;
  }
  ready = true; describe(false);
};
im.src = IMG.src;

// ---------- sampling ----------
function sampleLens() {
  const { x, y, r } = S.lens, out = {};
  for (const L of LAYERS) out[L.id] = { mean: 0, cover: 0, peak: 0, hot: [] };
  let n = 0;
  for (let yy = Math.max(0, Math.floor(y - r)); yy < Math.min(GH, Math.ceil(y + r)); yy++)
    for (let xx = Math.max(0, Math.floor(x - r)); xx < Math.min(GW, Math.ceil(x + r)); xx++) {
      if ((xx - x) ** 2 + (yy - y) ** 2 > r * r) continue; n++;
      for (const L of LAYERS) {
        const v = layerVals[L.id] ? layerVals[L.id][yy * GW + xx] : 0, o = out[L.id];
        o.mean += v; if (v > 0.15) { o.cover++; o.hot.push({ x: xx + 0.5, y: yy + 0.5, v }); } if (v > o.peak) o.peak = v;
      }
    }
  for (const L of LAYERS) {
    const o = out[L.id]; o.mean = n ? o.mean / n : 0; o.cover = n ? o.cover / n : 0;
    o.hot.sort((a, b) => b.v - a.v); const pick = [];
    for (const h of o.hot) { if (pick.every(p => (p.x - h.x) ** 2 + (p.y - h.y) ** 2 > 12)) pick.push(h); if (pick.length >= 6) break; }
    pick.sort((a, b) => a.x - b.x); o.hot = pick;
  }
  return out;
}
const COLS = 32, ROWS = 8;
function sampleColumn(c) {
  const x0 = Math.floor(c * GW / COLS), x1 = Math.floor((c + 1) * GW / COLS), out = {};
  for (const L of LAYERS) {
    const v = layerVals[L.id], cells = [];
    for (let r = 0; r < ROWS; r++) {
      const y0 = Math.floor(r * GH / ROWS), y1 = Math.floor((r + 1) * GH / ROWS); let s = 0, m = 0, n = 0;
      if (v) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const q = v[y * GW + x]; s += q; if (q > m) m = q; n++; }
      cells.push({ r, mean: n ? s / n : 0, max: m, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 });
    }
    out[L.id] = { cells, mean: cells.reduce((a, c) => a + c.mean, 0) / ROWS };
  }
  return out;
}
const degMidi = d => { const sc = SCALES[S.scale], o = Math.floor(d / sc.length), i = ((d % sc.length) + sc.length) % sc.length; return ROOT + 12 * o + sc[i]; };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

// ---------- audio graph ----------
let ac, master, bus, wetG, inst, layerOut = {}, beds = {};
function initAudio() {
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)();
  inst = createInstruments(ac);
  master = ac.createGain(); master.gain.value = S.vol;
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ac.destination);
  const conv = ac.createConvolver(); conv.buffer = inst.impulse(4.2, 2.2);
  wetG = ac.createGain(); wetG.gain.value = S.rev; conv.connect(wetG); wetG.connect(master);
  bus = ac.createGain(); bus.connect(master); bus.connect(conv);
}
function setupLayerAudio() {
  Object.values(beds).forEach(b => b.stop()); beds = {};
  Object.values(layerOut).forEach(g => { try { g.disconnect(); } catch {} }); layerOut = {};
  for (const L of LAYERS) {
    const g = ac.createGain(); g.connect(bus); layerOut[L.id] = g;
    if (L.bed) beds[L.id] = inst.BEDS[L.bed](g, mtof(ROOT));
  }
  applyMix();
}
function panned(dest, pan) { const g = ac.createGain(); if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); p.connect(dest); } else g.connect(dest); return g; }
function note(L, midi, t, vel, pan) {
  if (window.__ejLog) window.__ejLog.push([L.id, midi, S.fid]);
  (inst.INSTRUMENTS[L.inst] || inst.INSTRUMENTS.soft)(panned(layerOut[L.id], pan), mtof(midi), t, vel);
}
function layerGain(id) {
  if (Object.values(S.solo).some(Boolean)) return S.solo[id] ? 1 : 0;
  if (S.mute[id]) return 0;
  if (S.hl && S.mode === 'story') return S.hl.includes(id) ? 1.15 : 0.22;
  return 1;
}
function applyMix() {
  if (ac) for (const L of LAYERS) layerOut[L.id]?.gain.setTargetAtTime(layerGain(L.id), ac.currentTime, 0.12);
  document.querySelectorAll('.mx').forEach(el => el.classList.toggle('dim', layerGain(el.dataset.id) < 0.5));
}

// ---------- transport ----------
let timer = null, nextT = 0, step = 0;
const visQ = [], at = (t, fn) => visQ.push({ t, fn });
function schedule() { const spb = 60 / S.bpm / 4; while (nextT < ac.currentTime + 0.12) { playStep(step, nextT); nextT += spb; step++; } }
function playStep(st, t) {
  if (S.mode === 'story') storyTick();
  const thr = 0.1 + (1 - S.thr) * 0.35;
  if (S.mode !== 'scan') {
    const smp = sampleLens();
    at(t, () => setMeters(smp));
    for (const L of LAYERS) {
      const o = smp[L.id];
      if (beds[L.id]) beds[L.id].set(o.mean * 1.6, t);
      if (!o.hot.length || o.peak < thr) continue;
      const every = L.every || 1; if (st % every !== (L.offbeat ? 1 % every : 0)) continue;
      const useRhythm = every === 1 && melody.model && S.fid < 0.99;
      if (useRhythm) { if (!melody.rhythmGate(L.id, st, S.fid)) continue; }
      else if (L.offbeat && st % 2 === 0) continue;
      const prob = useRhythm ? clamp(Math.sqrt(o.cover) * (0.7 + S.thr)) : clamp(o.cover * (0.8 + S.thr * 1.6)) * (every > 1 ? 1.4 : 1);
      if (Math.random() > prob) continue;
      const h = o.hot[(st / every | 0) % o.hot.length], [lo, hi] = L.reg;
      const m = degMidi(melody.degree(L.id, lo + h.v * (hi - lo), L.reg, S.fid));
      if (useRhythm) melody.advanceRhythm(L.id, st, clamp(o.cover * 2));
      const hp = h.x / GW * 2 - 1;
      note(L, m, t, 0.35 + 0.65 * h.v, hp);
      if (L.crackle) inst.crackle(panned(layerOut[L.id], hp), t, h.v);
      at(t, () => ripple(h.x, h.y, L.color, h.v));
    }
  } else {
    const c = st % COLS, smp = sampleColumn(c), pan = (c + 0.5) / COLS * 2 - 1;
    at(t, () => { S.visCol = c; setMeters(smp); });
    for (const L of LAYERS) {
      const o = smp[L.id];
      if (beds[L.id]) beds[L.id].set(o.mean * 1.8, t);
      if (L.every > 1 && st % 2) continue;
      o.cells.filter(x => x.max > thr && x.mean > thr * 0.35).sort((a, b) => b.mean - a.mean).slice(0, 2).forEach((x, i) => {
        const [lo, hi] = L.reg, tgt = lo + (ROWS - 1 - x.r) / (ROWS - 1) * (hi - lo);
        const m = degMidi(i === 0 ? melody.degree(L.id, tgt, L.reg, S.fid) : Math.round(tgt));
        note(L, m, t + i * 0.015, 0.3 + 0.7 * clamp(x.mean * 1.8), pan);
        if (L.crackle) inst.crackle(panned(layerOut[L.id], pan), t, x.max);
        at(t, () => ripple(x.cx, x.cy, L.color, x.max));
      });
    }
  }
}
async function play() {
  initAudio(); try { await ac.resume(); } catch {}
  if (S.playing) return;
  setupLayerAudio();
  S.playing = true; nextT = ac.currentTime + 0.06; step = 0; timer = setInterval(schedule, 25);
  $('playBtn').textContent = 'Pause'; $('playBtn').setAttribute('aria-pressed', 'true');
  $('startOverlay').style.display = 'none';
  if (S.mode === 'story') {
    if (S.ended || (S.storyIdx === 0 && S.storyStep === 0)) { S.ended = false; say(content.journey.intro); goStop(0, true); }
    else goStop(S.storyIdx);
  }
}
function pause() {
  S.playing = false; clearInterval(timer); timer = null; visQ.length = 0;
  if (ac) Object.values(beds).forEach(b => b.set(0, ac.currentTime));
  shell.narrator.hush();
  $('playBtn').textContent = 'Play'; $('playBtn').setAttribute('aria-pressed', 'false');
}

// ---------- journey ----------
function goStop(i, queue = false) {
  const n = STOPS.length;
  S.storyIdx = content.journey.loop ? ((i % n) + n) % n : clamp(i, 0, n - 1); S.storyStep = 0;
  S.stopSteps = Math.round(content.journey.stopSeconds / (60 / S.bpm / 4));
  const st = STOPS[S.storyIdx], k = GW / IMG.width;
  S.anim = { fx: S.lens.x, fy: S.lens.y, fr: S.lens.r, tx: st.x * k, ty: st.y * k, tr: st.r, t0: performance.now(), dur: 1400 };
  S.hl = st.hl; applyMix(); melody.reset();
  $('capWhere').textContent = `${S.storyIdx + 1}/${n} · ${st.title}`;
  $('capTxt').textContent = st.text;
  if (S.playing) say(`${st.title}. || ${st.narration || st.text}`, { queue });
}
function storyTick() {
  if (++S.storyStep < S.stopSteps) return;
  S.storyStep = -1e9;
  const nx = S.storyIdx + 1;
  if (nx >= STOPS.length && !content.journey.loop) setTimeout(endJourney, 0);
  else setTimeout(() => goStop(nx), 0);
}
function endJourney() {
  S.ended = true; S.hl = null; applyMix();
  $('capWhere').textContent = 'Journey’s end'; $('capTxt').textContent = content.journey.outro.replace(/\s*\|\|?\s*/g, ' ').replace(/\*/g, '');
  say(content.journey.outro);
  setTimeout(() => { if (S.ended && S.playing) pause(); }, 16000);
}

// ---------- visuals ----------
const ripples = [];
function ripple(x, y, color, v) { ripples.push({ x: x / GW * W, y: y / GH * H, color, v, born: performance.now() }); if (ripples.length > 120) ripples.shift(); }
function setMeters(smp) { for (const L of LAYERS) { const el = document.querySelector(`.mx[data-id="${L.id}"] .lvl i`); if (el) el.style.width = Math.round(clamp(smp[L.id].mean * 2.2) * 100) + '%'; } }
function draw() {
  requestAnimationFrame(draw);
  if (!ready) return;
  if (ac) while (visQ.length && visQ[0].t <= ac.currentTime) visQ.shift().fn();
  if (S.anim) {
    const a = S.anim, p = prefs.reduceMotion ? 1 : clamp((performance.now() - a.t0) / a.dur), e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
    S.lens.x = a.fx + (a.tx - a.fx) * e; S.lens.y = a.fy + (a.ty - a.fy) * e; S.lens.r = a.fr + (a.tr - a.fr) * e; if (p >= 1) S.anim = null;
  }
  ctx.drawImage(base, 0, 0);
  const soloIds = Object.keys(S.solo).filter(k => S.solo[k]);
  const focus = soloIds.length ? soloIds : (S.mode === 'story' && S.hl ? S.hl : null);
  if (focus && focus.length === 1 && maskCanvases[focus[0]]) ctx.drawImage(maskCanvases[focus[0]], 0, 0, W, H);
  const kx = W / GW, ky = H / GH;
  if (S.mode === 'scan') {
    if (S.visCol >= 0) {
      const x0 = S.visCol * W / COLS, w = W / COLS, grd = ctx.createLinearGradient(x0 - 80, 0, x0 + w, 0);
      grd.addColorStop(0, 'rgba(201,166,255,0)'); grd.addColorStop(1, 'rgba(201,166,255,.2)');
      ctx.fillStyle = grd; ctx.fillRect(x0 - 80, 0, 80 + w, H); ctx.fillStyle = 'rgba(240,230,255,.9)'; ctx.fillRect(x0 + w - 2, 0, 2, H);
    }
    ctx.strokeStyle = 'rgba(255,255,255,.06)'; for (let r = 1; r < ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * H / ROWS); ctx.lineTo(W, r * H / ROWS); ctx.stroke(); }
  } else {
    const px = S.lens.x * kx, py = S.lens.y * ky, pr = S.lens.r * kx;
    ctx.save(); ctx.fillStyle = 'rgba(4,4,10,.48)'; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(px, py, pr, 0, Math.PI * 2, true); ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(245,235,255,.95)'; ctx.lineWidth = 2; ctx.shadowColor = 'rgba(201,166,255,.9)'; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px - 6, py); ctx.lineTo(px + 6, py); ctx.moveTo(px, py - 6); ctx.lineTo(px, py + 6); ctx.stroke();
    ctx.restore();
  }
  const now = performance.now();
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i], age = (now - r.born) / 1000; if (age > 1) { ripples.splice(i, 1); continue; }
    ctx.save(); ctx.globalAlpha = (1 - age) * 0.95; ctx.strokeStyle = r.color; ctx.lineWidth = 2.5 * (1 - age) + 0.5;
    ctx.beginPath(); ctx.arc(r.x, r.y, 4 + age * (16 + r.v * 30), 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.globalAlpha = 1 - age; ctx.beginPath(); ctx.arc(r.x, r.y, 2.2 * (1 - age), 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
}

// ---------- UI ----------
$('mixer').innerHTML = LAYERS.map(L => `
  <div class="mx" data-id="${L.id}">
    <span class="dot" style="background:${L.color}"></span>
    <div class="nm">${L.name} <small>${L.voice}</small><div class="lvl"><i style="background:${L.color}"></i></div></div>
    <button class="m" aria-pressed="false" aria-label="Mute ${L.name}" title="Mute">M</button>
    <button class="s" aria-pressed="false" aria-label="Solo ${L.name}" title="Solo">S</button>
  </div>`).join('');
document.querySelectorAll('.mx').forEach(el => {
  const id = el.dataset.id;
  el.querySelector('.m').addEventListener('click', e => { S.mute[id] = !S.mute[id]; e.currentTarget.setAttribute('aria-pressed', String(!!S.mute[id])); applyMix(); });
  el.querySelector('.s').addEventListener('click', e => { S.solo[id] = !S.solo[id]; e.currentTarget.setAttribute('aria-pressed', String(!!S.solo[id])); applyMix(); });
});
function setMode(m) {
  S.mode = m; S.visCol = -1;
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.mode === m)));
  $('modeHelp').textContent = content.modes[m].help;
  $('storyNav').hidden = m !== 'story';
  if (m === 'story') goStop(S.storyIdx);
  else { S.hl = null; applyMix(); shell.narrator.hush(); describe(false); }
}
function level(v) { const w = content.levelWords; return v < 0.04 ? null : v < 0.12 ? w[0] : v < 0.25 ? w[1] : v < 0.45 ? w[2] : w[3]; }
function regionOf(nx, ny) { const x = nx * IMG.width, y = ny * IMG.height; for (const [x0, y0, x1, y1, n] of content.regions) if (x >= x0 && x < x1 && y >= y0 && y < y1) return n; return content.openOcean; }
function describe(speak) {
  if (!ready) return '';
  const smp = sampleLens(), where = regionOf(S.lens.x / GW, S.lens.y / GH);
  const parts = LAYERS.map(L => ({ L, m: smp[L.id].mean })).sort((a, b) => b.m - a.m).map(({ L, m }) => (level(m * 1.6) ? `${L.name.toLowerCase()} ${level(m * 1.6)}` : null)).filter(Boolean);
  const txt = parts.length ? parts.join(', ') : 'clear: almost nothing detected';
  const sentence = `${where}. ${txt.charAt(0).toUpperCase() + txt.slice(1)}.`;
  if (S.mode !== 'story') { $('capWhere').textContent = where; $('capTxt').textContent = parts.length ? `In the lens: ${txt}.` : content.clearAir; }
  say(sentence, { speak });
  return sentence;
}
let dT = null; const describeSoon = () => { clearTimeout(dT); dT = setTimeout(() => describe(false), 350); };

const toGrid = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * GW, y: (e.clientY - r.top) / r.height * GH }; };
let dragging = false;
cv.addEventListener('pointerdown', e => {
  dragging = true; cv.setPointerCapture(e.pointerId); const p = toGrid(e);
  if (S.mode !== 'lens') setMode('lens');
  S.anim = null; S.lens.x = p.x; S.lens.y = p.y; describeSoon();
  if (!S.playing) play();
});
cv.addEventListener('pointermove', e => { if (S.mode !== 'lens') return; if (e.pointerType === 'mouse' || dragging) { const p = toGrid(e); S.lens.x = p.x; S.lens.y = p.y; describeSoon(); } });
cv.addEventListener('pointerup', () => { dragging = false; }); cv.addEventListener('pointercancel', () => { dragging = false; });
document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'select' || e.ctrlKey || e.metaKey || e.altKey) return;
  if (tag === 'input' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
  const onCv = e.target === cv, d = e.shiftKey ? 10 : 3;
  if (onCv && e.key.startsWith('Arrow')) {
    e.preventDefault(); if (S.mode !== 'lens') setMode('lens'); S.anim = null;
    if (e.key === 'ArrowLeft') S.lens.x = Math.max(0, S.lens.x - d); if (e.key === 'ArrowRight') S.lens.x = Math.min(GW, S.lens.x + d);
    if (e.key === 'ArrowUp') S.lens.y = Math.max(0, S.lens.y - d); if (e.key === 'ArrowDown') S.lens.y = Math.min(GH, S.lens.y + d);
    describeSoon(); return;
  }
  if (tag === 'input') return;
  if (e.key === ' ' && (onCv || tag === 'body')) { e.preventDefault(); S.playing ? pause() : play(); }
  else if (e.key === '+' || e.key === '=') setLens(S.lens.r + 2); else if (e.key === '-') setLens(S.lens.r - 2);
  else if (e.key === 'd' || e.key === 'D') describe(true);
  else if (e.key === '.') { if (S.mode !== 'story') setMode('story'); else goStop(S.storyIdx + 1); }
  else if (e.key === ',') { if (S.mode !== 'story') setMode('story'); else goStop(S.storyIdx - 1); }
  else if (e.key === '1') setMode('story'); else if (e.key === '2') setMode('lens'); else if (e.key === '3') setMode('scan');
});
function setLens(r) { S.lens.r = clamp(r, 4, 40); $('lensR').value = S.lens.r; $('lensRO').textContent = Math.round(S.lens.r); }
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
$('startBtn').addEventListener('click', () => { setMode('story'); play(); cv.focus(); });
$('playBtn').addEventListener('click', () => (S.playing ? pause() : play()));
$('describeBtn').addEventListener('click', () => describe(true));
$('prevStop').addEventListener('click', () => goStop(S.storyIdx - 1));
$('nextStop').addEventListener('click', () => goStop(S.storyIdx + 1));

// sliders: [id, initial value on the slider, apply(sliderValue), label(sliderValue)]
const SLIDERS = [
  ['fid', S.fid * 100, v => { S.fid = v / 100; }, v => `${v}% data`],
  ['bpm', S.bpm, v => { S.bpm = v; S.stopSteps = Math.round(content.journey.stopSeconds / (60 / v / 4)); }],
  ['thr', S.thr * 100, v => { S.thr = v / 100; }],
  ['lensR', S.lens.r, v => { S.lens.r = v; }],
  ['rev', S.rev * 100, v => { S.rev = v / 100; if (wetG) wetG.gain.setTargetAtTime(S.rev, ac.currentTime, 0.05); }],
  ['vol', S.vol * 100, v => { S.vol = v / 100; if (master) master.gain.setTargetAtTime(S.vol, ac.currentTime, 0.05); }],
];
for (const [id, init, apply, label = v => v] of SLIDERS) {
  const el = $(id), out = $(id + 'O'); el.value = init; out.textContent = label(Math.round(init));
  el.addEventListener('input', () => { apply(+el.value); out.textContent = label(+el.value); });
}
$('scale').addEventListener('change', e => { S.scale = e.target.value; });

setMode('story');
requestAnimationFrame(draw);
