// =============================================================================
// Hub: the visitor floats in low Earth orbit. Chapter windows hang around them,
// the planet turns below. All words come from src/content/story.js.
// =============================================================================
import * as THREE from 'three';
import { CHAPTERS, HUB, SITE, chapterIndex } from '../content/story.js';
import { narrator } from '../shared/narrator.js';
import { prefs, visited } from '../shared/prefs.js';
import { createEarth } from './earth.js';
import { createSky } from './sky.js';
import { createWindows } from './windows.js';
import { createAmbience } from './ambience.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const N = CHAPTERS.length;
const PITCH = { rest: -0.06, min: -1.25, max: 1.1, enter: -0.02 };
const FOV = { rest: 62, enter: 26, min: 35, max: 85 };

// ---------- static text from story.js ----------
$('brandName').textContent = SITE.name;
$('spEyebrow').textContent = HUB.splash.eyebrow;
$('splashTitle').innerHTML = HUB.splash.title;
$('spBody').innerHTML = HUB.splash.body;
$('enterDome').textContent = HUB.splash.begin;
$('enterList').textContent = HUB.splash.list;
$('spSmall').innerHTML = HUB.splash.small;
$('help').innerHTML = HUB.help;
$('credits').textContent = HUB.credits;

// ---------- scene ----------
const canvas = $('sky');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010208);
const camera = new THREE.PerspectiveCamera(FOV.rest, 1, 0.1, 3000);
camera.rotation.order = 'YXZ';
scene.add(camera);

const earth = createEarth(scene, renderer);
const sky = createSky(scene, renderer);
const seen = visited.all();
const windows = createWindows(scene, CHAPTERS, seen);
const amb = createAmbience();
narrator.onDuck(d => amb.duck(d));

// ---------- camera & focus ----------
const view = { yaw: windows.items[0].yaw, pitch: PITCH.rest, fov: FOV.rest };
let tween = null, focusIdx = 0, leaving = false;
const reduce = () => prefs.reduceMotion;
const shortest = (from, to) => { let d = to - from; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return from + d; };
function animateTo(t, ms, done) {
  const to = { yaw: shortest(view.yaw, t.yaw ?? view.yaw), pitch: t.pitch ?? view.pitch, fov: t.fov ?? view.fov };
  if (reduce() || !ms) { Object.assign(view, to); tween = null; done && done(); return; }
  tween = { from: { ...view }, to, t0: performance.now(), ms, done };
}
const nearestIdx = () => windows.items.reduce((b, it) => (Math.abs(shortest(view.yaw, it.yaw) - view.yaw) < Math.abs(shortest(view.yaw, windows.items[b].yaw) - view.yaw) ? it.i : b), 0);

function renderCard(i) {
  const ch = CHAPTERS[i];
  document.documentElement.style.setProperty('--accent', ch.color);
  $('cKick').textContent = `Chapter ${String(i + 1).padStart(2, '0')} of ${String(N).padStart(2, '0')} · ${ch.dataset}`;
  $('cTitle').textContent = ch.title;
  if (seen.has(ch.id)) { const s = document.createElement('span'); s.className = 'seen'; s.textContent = '✓ heard'; $('cTitle').append(s); }
  $('cSub').textContent = ch.subtitle;
  $('cSound').textContent = '♪ ' + ch.sound;
  $('cNote').hidden = !ch.note; $('cNote').textContent = ch.note || '';
  $('card').setAttribute('aria-description', ch.summary);
  $('enterBtn').textContent = `Enter ${ch.title} ▸`;
}
function setFocus(i, announce) {
  i = ((i % N) + N) % N;
  const changed = i !== focusIdx; focusIdx = i;
  renderCard(i);
  if (changed) amb.chime(i);
  if (announce) narrator.say(HUB.facing(CHAPTERS[i], i, N));
}
function turnTo(i, announce = true) { i = ((i % N) + N) % N; setFocus(i, announce); animateTo({ yaw: windows.items[i].yaw, pitch: PITCH.rest }, 1100); }

function enter(i) {
  if (leaving) return;
  i = ((i % N) + N) % N; leaving = true; setFocus(i, false);
  const ch = CHAPTERS[i];
  narrator.say(HUB.entering(ch));
  amb.fadeOut(0.9);
  const go = () => { $('veil').classList.add('on'); setTimeout(() => { location.href = ch.path; }, reduce() ? 50 : 650); };
  animateTo({ yaw: windows.items[i].yaw, pitch: PITCH.enter, fov: FOV.enter }, 1100, go);
}
// coming back from a chapter with the browser's back button
addEventListener('pageshow', e => { if (e.persisted) { leaving = false; $('veil').classList.remove('on'); animateTo({ fov: FOV.rest, pitch: PITCH.rest }, 900); amb.setMuted(false); } });

// ---------- pointer ----------
let drag = null, hoverIdx = -1;
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
function pickAt(e) {
  const r = canvas.getBoundingClientRect(); mouse.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects(windows.pickables, false)[0];
  return hit ? hit.object.userData.idx : -1;
}
canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); tween = null; });
canvas.addEventListener('pointermove', e => {
  if (drag) {
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) { drag.moved = true; canvas.classList.add('drag'); }
    if (!drag.moved) return;
    view.yaw += (e.clientX - drag.x) * 0.0042; view.pitch = clamp(view.pitch + (e.clientY - drag.y) * 0.0032, PITCH.min, PITCH.max);
    drag.x = e.clientX; drag.y = e.clientY;
    const n = nearestIdx(); if (n !== focusIdx) setFocus(n, false);
    return;
  }
  hoverIdx = pickAt(e);
  canvas.classList.toggle('hot', hoverIdx >= 0);
  const tip = $('tip');
  if (hoverIdx >= 0) { tip.hidden = false; tip.textContent = `${CHAPTERS[hoverIdx].title} · click to ${hoverIdx === focusIdx ? 'enter' : 'turn to it'}`; tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px'; }
  else tip.hidden = true;
});
canvas.addEventListener('pointerup', e => {
  canvas.classList.remove('drag');
  if (drag && !drag.moved) {
    const i = pickAt(e);
    if (i >= 0) { const facing = Math.abs(shortest(view.yaw, windows.items[i].yaw) - view.yaw) < 0.25; if (i === focusIdx && facing) enter(i); else turnTo(i); }
  } else if (drag && drag.moved) setFocus(nearestIdx(), true);
  drag = null;
});
canvas.addEventListener('wheel', e => { e.preventDefault(); view.fov = clamp(view.fov + e.deltaY * 0.03, FOV.min, FOV.max); }, { passive: false });

// ---------- list view ----------
function buildList() {
  const box = $('listItems'); box.textContent = '';
  CHAPTERS.forEach((ch, i) => {
    const li = document.createElement('li');
    const h = document.createElement('h3'), dot = document.createElement('i'); dot.style.background = ch.color;
    h.append(dot, `${i + 1}. ${ch.title}${seen.has(ch.id) ? ' (heard)' : ''}`);
    const p = document.createElement('p'); p.textContent = `${ch.subtitle}. ${ch.dataset}. ${ch.summary} ${ch.sound}${ch.note ? ' ' + ch.note : ''}`;
    const row = document.createElement('div'); row.className = 'row';
    const a = document.createElement('a'); a.className = 'btn primary'; a.href = ch.path; a.textContent = `Open ${ch.title}`;
    const b = document.createElement('button'); b.textContent = 'Turn to it'; b.addEventListener('click', () => turnTo(i));
    row.append(a, b); li.append(h, p, row); box.append(li);
  });
}
function toggleList(force) {
  const el = $('list'), open = force ?? el.hidden;
  el.hidden = !open; $('listBtn').setAttribute('aria-expanded', String(open));
  if (open) el.querySelector('a, button')?.focus();
}

// ---------- settings ----------
function syncTts() { const b = $('ttsBtn'); b.setAttribute('aria-pressed', String(narrator.enabled)); b.textContent = narrator.enabled ? '🗣 Narration' : '🔇 Narration'; }
function setTts(on, silent) { narrator.setEnabled(on); syncTts(); if (!silent) narrator.say(on ? 'Narration on. I will describe where you are as you move around.' : 'Narration off.', { speak: on }); }
narrator.onVoices((vs, cur) => {
  const sel = $('voiceSel'); sel.textContent = '';
  vs.forEach(v => { const o = document.createElement('option'); o.value = v.name; o.textContent = `${v.name.replace(/Microsoft |Google /, '')} (${v.lang})`; o.selected = v === cur; sel.append(o); });
  sel.hidden = !vs.length;
});
$('voiceSel').addEventListener('change', e => { narrator.setVoice(e.target.value); setTts(true, true); narrator.say('This is how I sound. || Shall we continue… | above the clouds?'); });
if (!narrator.available) { $('ttsBtn').hidden = true; $('voiceSel').hidden = true; }
$('ttsBtn').addEventListener('click', () => setTts(!narrator.enabled));
function syncAmb() { const b = $('ambBtn'); b.setAttribute('aria-pressed', String(prefs.get('ambience'))); b.textContent = prefs.get('ambience') ? '🔊 Ambience' : '🔇 Ambience'; }
$('ambBtn').addEventListener('click', () => { prefs.set('ambience', !prefs.get('ambience')); amb.setOn(prefs.get('ambience')); syncAmb(); });
function syncRm() { $('rmBtn').setAttribute('aria-pressed', String(reduce())); }
$('rmBtn').addEventListener('click', () => { prefs.toggle('motion', 'reduce', 'full'); syncRm(); narrator.say(`Reduce motion ${reduce() ? 'on' : 'off'}.`); });
$('listBtn').addEventListener('click', () => toggleList());
$('prevBtn').addEventListener('click', () => turnTo(focusIdx - 1));
$('nextBtn').addEventListener('click', () => turnTo(focusIdx + 1));
$('enterBtn').addEventListener('click', () => enter(focusIdx));

// first gesture anywhere starts the ambience (browsers block audio before that)
const startAudio = () => { if (prefs.get('ambience')) amb.setOn(true); removeEventListener('pointerdown', startAudio, true); removeEventListener('keydown', startAudio, true); };
addEventListener('pointerdown', startAudio, true); addEventListener('keydown', startAudio, true);

// ---------- start / return ----------
function hideSplash() { const sp = $('splash'); sp.classList.add('fade'); setTimeout(() => { sp.hidden = true; }, 450); }
function begin(listMode) {
  hideSplash(); setFocus(0, false);
  if (listMode) { setTts(false, true); toggleList(true); narrator.say(HUB.listMode, { speak: false }); return; }
  if (!reduce()) { view.pitch = -0.95; view.yaw = windows.items[0].yaw + 0.7; animateTo({ yaw: windows.items[0].yaw, pitch: PITCH.rest }, 5200); }
  narrator.say(HUB.intro);
  narrator.say(HUB.facing(CHAPTERS[0], 0, N), { queue: true, live: false });
  $('enterBtn').focus();
}
$('enterDome').addEventListener('click', () => begin(false));
$('enterList').addEventListener('click', () => begin(true));

const from = new URLSearchParams(location.search).get('from');
const fromIdx = from ? chapterIndex(from) : -1;
if (fromIdx >= 0) {
  // returning from a chapter: skip the splash and face the next one
  $('splash').hidden = true;
  const nextIdx = fromIdx + 1 < N ? fromIdx + 1 : fromIdx;
  focusIdx = nextIdx; view.yaw = windows.items[fromIdx].yaw; view.fov = FOV.enter;
  renderCard(nextIdx);
  animateTo({ yaw: windows.items[nextIdx].yaw, fov: FOV.rest, pitch: PITCH.rest }, 2200);
  narrator.say(HUB.returning(CHAPTERS[fromIdx], fromIdx + 1 < N ? CHAPTERS[nextIdx] : null));
  history.replaceState(null, '', location.pathname);
  setTimeout(() => $('enterBtn').focus(), 60);
}

// ---------- keyboard ----------
document.addEventListener('keydown', e => {
  if (!$('splash').hidden || leaving) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea' || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  if (k === 'ArrowRight') { e.preventDefault(); turnTo(focusIdx + 1); }
  else if (k === 'ArrowLeft') { e.preventDefault(); turnTo(focusIdx - 1); }
  else if (k === 'ArrowUp') { e.preventDefault(); animateTo({ pitch: clamp(view.pitch + 0.25, PITCH.min, PITCH.max) }, 400); }
  else if (k === 'ArrowDown') { e.preventDefault(); animateTo({ pitch: clamp(view.pitch - 0.25, PITCH.min, PITCH.max) }, 400); }
  else if (k === 'Enter' && tag !== 'button' && tag !== 'a') { e.preventDefault(); enter(focusIdx); }
  else if (/^[1-9]$/.test(k) && +k <= N) turnTo(+k - 1);
  else if (k === 'l' || k === 'L') toggleList();
  else if (k === 'n' || k === 'N') setTts(!narrator.enabled);
  else if (k === 'd' || k === 'D') narrator.say(HUB.facing(CHAPTERS[focusIdx], focusIdx, N));
  else if (k === 'Escape' && !$('list').hidden) toggleList(false);
});

// ---------- loop ----------
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);
let last = performance.now(), clock = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; clock += dt;
  if (tween) {
    const p = clamp((now - tween.t0) / tween.ms, 0, 1), s = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    for (const k of ['yaw', 'pitch', 'fov']) view[k] = tween.from[k] + (tween.to[k] - tween.from[k]) * s;
    if (p >= 1) { const d = tween.done; tween = null; d && d(); }
  }
  camera.rotation.set(view.pitch, view.yaw, 0);
  if (Math.abs(camera.fov - view.fov) > 0.01) { camera.fov = view.fov; camera.updateProjectionMatrix(); }
  earth.update(dt, reduce());
  sky.update(dt, clock, reduce());
  windows.update(dt, clock, focusIdx, hoverIdx, reduce());
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
buildList(); syncTts(); syncAmb(); syncRm(); resize();
if (fromIdx < 0) renderCard(0);
requestAnimationFrame(loop);
window.__hub = { view, focus: () => focusIdx };
