// =============================================================================
// NITROGEN DIOXIDE · engine: plays the 10 forecast frames, samples the colour
// under the probe, and turns its darkness into one of three moods.
// Words: content.js · moods & rules: mapping.js · sounds: instruments.js
// =============================================================================
import { mountShell } from '../../src/shared/shell.js';
import { content, transcript } from './content.js';
import { MOODS, moodOf, bpmOf, cutoffOf, NO2_MAX, darknessOf, isIgnored, pixelToLatLon } from './mapping.js';
import { createNo2Audio } from './instruments.js';

const shell = mountShell({ id: 'no2', transcript: () => transcript(MOODS) });
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

$('kicker').textContent = content.kicker; $('title').textContent = content.title; $('lede').textContent = content.lede;
$('about').innerHTML = content.about; $('foot').textContent = content.footer; $('keysHelp').innerHTML = content.keys;
$('startTitle').textContent = content.startTitle; $('startText').textContent = content.startText; $('startBtn').textContent = content.startButton;
$('moodCards').innerHTML = MOODS.map(m => `<div class="m" style="border-color:${m.color}55;background:${m.color}10"><h3 style="color:${m.color}"><span>${m.label}</span><span class="mono">${m.rangeText}</span></h3>${m.description}</div>`).join('');

// ---------- frames ----------
const meta = await (await fetch('/data/no2/frames.json')).json();
const FRAMES = meta.frames, FW = meta.width, FH = meta.height, NF = FRAMES.length;
$('frameScrubber').max = NF - 1; $('firstHour').textContent = FRAMES[0].hour.replace(' hr', 'h'); $('lastHour').textContent = FRAMES[NF - 1].hour.replace(' hr', 'h');
const frameImages = [], frameData = new Array(NF).fill(null);
let loaded = 0;
{
  const off = document.createElement('canvas'); off.width = FW; off.height = FH;
  const octx = off.getContext('2d', { willReadFrequently: true });
  FRAMES.forEach((f, i) => {
    const img = new Image();
    img.onload = () => {
      frameImages[i] = img; octx.clearRect(0, 0, FW, FH); octx.drawImage(img, 0, 0, FW, FH); frameData[i] = octx.getImageData(0, 0, FW, FH);
      loaded++; if (i === S.frame || loaded === NF) { render(); updateProbe(); }
    };
    img.src = `/data/no2/${f.src}`;
  });
}

// ---------- state ----------
const S = {
  frame: 0, playing: true, fps: 3, radius: 16, x: 145, y: 245, hovering: false, pinned: false, audioOn: false, volume: 0.75,
  r: 75, g: 210, b: 78, darkness: 0.15, no2: 2.4, series: new Array(NF).fill(0.15), note: '—', freq: 0, mood: MOODS[0], bpm: 146, cutoff: 4400, lastMood: null,
};
const cv = $('gifCanvas'), ctx = cv.getContext('2d');
const active = () => S.hovering || S.pinned;

// ---------- audio ----------
let audio = null, step = 0, nextT = 0, timer = null;
function startAudio() {
  if (!audio) { audio = createNo2Audio({ volume: S.volume }); nextT = audio.ac.currentTime + 0.05; timer = setInterval(schedule, 45); }
  audio.resume();
  if (!S.audioOn) shell.say(content.intro);
  S.audioOn = true; $('startBanner').hidden = true; syncDrone();
}
function syncDrone() { if (audio) audio.setDrone(S.mood, S.cutoff, S.darkness, S.audioOn && active()); }
function schedule() {
  if (!audio || !S.audioOn) return;
  if (!active()) { nextT = audio.ac.currentTime + 0.05; return; }
  while (nextT < audio.ac.currentTime + 0.12) {
    const m = S.mood, d = S.darkness;
    let idx = m.pattern[step % m.pattern.length];
    if (m.id === 'lively' && d < 0.15 && step % 4 === 0) idx = Math.min(m.notes.length - 1, idx + 2);   // extra sparkle when very clean
    const n = m.notes[idx]; S.note = n.name; S.freq = n.freq;
    audio.INSTRUMENTS[m.instrument](n.freq, nextT, d);
    S.bpm = bpmOf(d);
    nextT += (60 / S.bpm) * m.stepBeats;
    step = (step + 1) % 16;
  }
  telemetry();
}

// ---------- sampling ----------
function sampleAt(fi, cx, cy, radius) {
  const im = frameData[fi]; if (!im) return { r: 75, g: 210, b: 78, darkness: 0.15, no2: 2.4 };
  const { width: w, height: h, data } = im, x0 = clamp(Math.round(cx), 0, w - 1), y0 = clamp(Math.round(cy), 0, h - 1);
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let dy = -radius; dy <= radius; dy += 2) {
    const py = y0 + dy; if (py < 0 || py >= h) continue;
    for (let dx = -radius; dx <= radius; dx += 2) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const px = x0 + dx; if (px < 0 || px >= w) continue;
      const k = (py * w + px) * 4, r = data[k], g = data[k + 1], b = data[k + 2];
      if (!isIgnored(r, g, b, py)) { sr += r; sg += g; sb += b; n++; }
    }
  }
  if (!n) { const k = (y0 * w + x0) * 4; sr = data[k]; sg = data[k + 1]; sb = data[k + 2]; n = 1; }
  const r = Math.round(sr / n), g = Math.round(sg / n), b = Math.round(sb / n), darkness = darknessOf(r, g, b);
  return { r, g, b, darkness, no2: +(darkness * NO2_MAX).toFixed(1) };
}
let moodSayT = null;
function updateProbe() {
  const s = sampleAt(S.frame, S.x, S.y, S.radius);
  Object.assign(S, { r: s.r, g: s.g, b: s.b, darkness: s.darkness, no2: s.no2 });
  S.mood = moodOf(S.darkness); S.cutoff = cutoffOf(S.darkness);
  for (let i = 0; i < NF; i++) if (frameData[i]) S.series[i] = sampleAt(i, S.x, S.y, S.radius).darkness;
  if (S.lastMood !== S.mood.id && active()) {
    S.lastMood = S.mood.id; clearTimeout(moodSayT);
    moodSayT = setTimeout(() => shell.say(content.moodLine(S.mood, pixelToLatLon(S.x, S.y).text, S.no2), { speak: false }), 600);
  }
  syncDrone(); telemetry(); drawTemporal();
}

// ---------- rendering ----------
function render() {
  const img = frameImages[S.frame]; if (!img) return;
  ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0, cv.width, cv.height);
  if (active()) {
    ctx.save(); ctx.beginPath(); ctx.arc(S.x, S.y, S.radius, 0, Math.PI * 2);
    ctx.fillStyle = S.mood.color + '38'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore();
  }
  const f = FRAMES[S.frame];
  $('frameBadge').textContent = `Frame ${String(S.frame + 1).padStart(2, '0')} / ${NF}`;
  $('forecastTimeLabel').textContent = f.label; $('frameScrubber').value = S.frame;
  $('frameScrubber').setAttribute('aria-valuetext', f.label);
}
function telemetry() {
  const lightPct = Math.round((1 - S.darkness) * 100), m = S.mood, ll = pixelToLatLon(S.x, S.y).text;
  $('colorSwatch').style.backgroundColor = `rgb(${S.r},${S.g},${S.b})`;
  $('brightnessPct').textContent = `${lightPct}% light`; $('brightnessBar').style.width = `${lightPct}%`;
  $('rgbReadout').textContent = `RGB(${S.r}, ${S.g}, ${S.b})`; $('coordReadout').textContent = ll; $('ttCoords').textContent = ll;
  $('no2ValueReadout').textContent = `${S.no2.toFixed(1)} × 10¹⁵ molec·cm⁻²`; $('ttDensity').textContent = `NO₂: ${S.no2.toFixed(1)} × 10¹⁵ molec/cm²`;
  $('no2Marker').style.left = `${clamp(S.no2 / NO2_MAX * 100, 2, 97)}%`;
  const badge = $('moodBadge'); badge.textContent = m.label; badge.style.color = m.color; badge.style.borderColor = m.color + '88'; badge.style.background = m.color + '22';
  $('ttDot').style.background = m.color; $('ttMood').textContent = m.label; $('reticle').style.borderColor = m.color;
  $('scaleReadout').textContent = m.scaleName; $('tempoReadout').textContent = `${S.bpm} BPM · ${m.tempoWord}`;
  $('noteReadout').textContent = S.freq ? `${S.note} (${Math.round(S.freq)} Hz) · ${m.chord}` : m.chord;
  $('timbreReadout').textContent = `${S.cutoff.toLocaleString()} Hz · ${m.timbre}`;
  $('synthStateLabel').textContent = !S.audioOn ? 'Muted' : active() ? (S.pinned ? 'Playing locked probe' : 'Playing pointer') : 'Armed: hover or lock';
  cv.setAttribute('aria-label', `NO₂ forecast map, ${FRAMES[S.frame].label}. Probe at ${ll}: ${m.label}, about ${S.no2.toFixed(1)} times ten to the fifteen molecules per square centimetre.`);
}
const tctx = $('temporalChartCanvas').getContext('2d');
function drawTemporal() {
  const c = tctx.canvas, w = c.width, h = c.height, px = 22, py = 14, pw = w - px * 2, ph = h - py * 2;
  tctx.clearRect(0, 0, w, h);
  tctx.fillStyle = 'rgba(99,102,241,.10)'; tctx.fillRect(0, 0, w, h * 0.4); tctx.fillStyle = 'rgba(52,211,153,.08)'; tctx.fillRect(0, h * 0.64, w, h * 0.36);
  tctx.beginPath(); S.series.forEach((d, i) => { const x = px + i / (NF - 1) * pw, y = py + (1 - d) * ph; i ? tctx.lineTo(x, y) : tctx.moveTo(x, y); });
  tctx.strokeStyle = '#34d399'; tctx.lineWidth = 2; tctx.stroke();
  S.series.forEach((d, i) => {
    const x = px + i / (NF - 1) * pw, y = py + (1 - d) * ph;
    tctx.beginPath(); tctx.arc(x, y, i === S.frame ? 5.5 : 3, 0, Math.PI * 2); tctx.fillStyle = moodOf(d).color; tctx.fill();
    if (i === S.frame) { tctx.lineWidth = 2; tctx.strokeStyle = '#fff'; tctx.stroke(); }
  });
  tctx.fillStyle = '#94a3b8'; tctx.font = '10px JetBrains Mono, monospace'; tctx.fillText('Dark / heavy', 4, 11); tctx.fillText('Light / lively', 4, h - 4);
}
const vctx = $('audioVizCanvas').getContext('2d');
function drawViz() {
  requestAnimationFrame(drawViz);
  const c = vctx.canvas, w = c.width, h = c.height; vctx.clearRect(0, 0, w, h);
  if (!audio || !S.audioOn || !active()) { vctx.beginPath(); vctx.moveTo(0, h / 2); vctx.lineTo(w, h / 2); vctx.strokeStyle = '#334155'; vctx.lineWidth = 1.5; vctx.stroke(); return; }
  const an = audio.analyser, n = an.frequencyBinCount, fd = new Uint8Array(n), td = new Uint8Array(n);
  an.getByteFrequencyData(fd); an.getByteTimeDomainData(td);
  const bars = 36, bw = w / bars - 2; vctx.fillStyle = S.mood.color + '73';
  for (let i = 0; i < bars; i++) { const bh = Math.max(2, fd[i] / 255 * (h - 8)); vctx.fillRect(i * (bw + 2), h - bh, bw, bh); }
  vctx.beginPath(); for (let i = 0; i < n; i++) { const x = i * w / n, y = td[i] / 128 * h / 2; i ? vctx.lineTo(x, y) : vctx.moveTo(x, y); }
  vctx.strokeStyle = S.mood.color; vctx.lineWidth = 2; vctx.stroke();
}
let lastTs = 0;
function tick(ts) {
  requestAnimationFrame(tick);
  if (!S.playing || loaded < NF) return;
  if (ts - lastTs >= 1000 / S.fps) { lastTs = ts; S.frame = (S.frame + 1) % NF; render(); updateProbe(); }
}

// ---------- probe placement ----------
function placeProbe(x, y) {
  S.x = clamp(x, 0, FW - 1); S.y = clamp(y, 0, FH - 1);
  const pctX = S.x / FW * 100, pctY = S.y / FH * 100, rect = cv.getBoundingClientRect(), scale = FW / (rect.width || FW);
  const ret = $('reticle'), tt = $('tooltip'), dia = Math.max(20, S.radius * 2 / scale);
  ret.style.left = pctX + '%'; ret.style.top = pctY + '%'; ret.style.width = ret.style.height = dia + 'px';
  tt.style.left = (pctX > 65 ? pctX - 24 : pctX + 4) + '%'; tt.style.top = (pctY > 80 ? pctY - 14 : pctY + 4) + '%';
  ret.hidden = tt.hidden = !active();
  render(); updateProbe();
}
function fromEvent(e) {
  const r = cv.getBoundingClientRect(), p = e.touches ? e.touches[0] : e;
  return [(p.clientX - r.left) * FW / r.width, (p.clientY - r.top) * FH / r.height];
}
function setPinned(on, label) {
  S.pinned = on;
  const b = $('pinBtn'); b.setAttribute('aria-pressed', String(on));
  b.textContent = on ? `Probe locked${label ? ': ' + label : ''}` : 'Probe follows pointer';
  $('reticle').hidden = $('tooltip').hidden = !active(); syncDrone();
}
cv.addEventListener('pointerenter', e => { S.hovering = true; if (!S.pinned) placeProbe(...fromEvent(e)); else syncDrone(); });
cv.addEventListener('pointermove', e => { S.hovering = true; if (!S.pinned) placeProbe(...fromEvent(e)); });
cv.addEventListener('pointerleave', () => { S.hovering = false; if (!S.pinned) { $('reticle').hidden = $('tooltip').hidden = true; } render(); syncDrone(); });
cv.addEventListener('click', e => { if (!S.audioOn) startAudio(); setPinned(!S.pinned); placeProbe(...fromEvent(e)); });
cv.addEventListener('keydown', e => {
  const d = e.shiftKey ? 30 : 8;
  if (e.key.startsWith('Arrow')) {
    e.preventDefault(); if (!S.audioOn) startAudio(); if (!S.pinned) setPinned(true);
    const [dx, dy] = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
    placeProbe(S.x + dx, S.y + dy);
  } else if (e.key === 'Enter') { e.preventDefault(); if (!S.audioOn) startAudio(); setPinned(!S.pinned); placeProbe(S.x, S.y); }
});
cv.addEventListener('focus', () => { if (!S.pinned && cv.matches(':focus-visible')) { setPinned(true); placeProbe(S.x, S.y); } });   // keyboard focus only

// ---------- controls ----------
function setPlaying(on) { S.playing = on; $('playPauseBtn').textContent = on ? 'Pause' : 'Play'; $('playPauseBtn').setAttribute('aria-pressed', String(on)); }
function stepFrame(d) { setPlaying(false); S.frame = (S.frame + d + NF) % NF; render(); updateProbe(); shell.say(FRAMES[S.frame].label, { speak: false }); }
$('startBtn').addEventListener('click', () => { startAudio(); setPinned(true); placeProbe(S.x, S.y); });
$('pinBtn').addEventListener('click', () => { setPinned(!S.pinned); placeProbe(S.x, S.y); });
$('playPauseBtn').addEventListener('click', () => setPlaying(!S.playing));
$('prevFrameBtn').addEventListener('click', () => stepFrame(-1));
$('nextFrameBtn').addEventListener('click', () => stepFrame(1));
$('frameScrubber').addEventListener('input', e => { S.frame = +e.target.value; render(); updateProbe(); });
$('fpsSlider').addEventListener('input', e => { S.fps = +e.target.value; $('fpsVal').textContent = `${S.fps.toFixed(1)} fps`; });
$('radiusSlider').addEventListener('input', e => { S.radius = +e.target.value; $('radiusVal').textContent = `${S.radius}px`; placeProbe(S.x, S.y); });
$('volumeSlider').addEventListener('input', e => { S.volume = e.target.value / 100; $('volumeVal').textContent = `${e.target.value}%`; audio?.setVolume(S.volume); });
const presetBox = document.querySelector('.presets');
content.presets.forEach(p => {
  const b = document.createElement('button'); b.textContent = p.name; b.title = p.hint;
  b.addEventListener('click', () => { if (!S.audioOn) startAudio(); setPinned(true, p.name); placeProbe(p.x, p.y); shell.say(content.moodLine(S.mood, p.name, S.no2)); });
  presetBox.append(b);
});
document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'select' || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === ' ' && tag !== 'button') { e.preventDefault(); setPlaying(!S.playing); }
  else if (e.key === ',') stepFrame(-1); else if (e.key === '.') stepFrame(1);
  else if (e.key === 'd' || e.key === 'D') shell.say(`${FRAMES[S.frame].label}. ${content.moodLine(S.mood, pixelToLatLon(S.x, S.y).text, S.no2)} The music: ${S.mood.scaleName}, ${S.bpm} beats per minute, ${S.mood.timbre.toLowerCase()}.`);
});

render(); telemetry(); drawTemporal();
requestAnimationFrame(tick); requestAnimationFrame(drawViz);
