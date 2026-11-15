// =============================================================================
// Narrator: one voice for the whole site.
//
// - Every line also goes to an aria-live region, so screen-reader users hear it
//   through their own reader. The built-in voice (speechSynthesis) is optional.
// - Script marks you can use in any narration text (content.js / story.js):
//       |    short beat        ||   long pause
//       …    dramatic pause    *word*   emphasis (the phrase is slowed and lifted)
// - Pronunciations live in PRONOUNCE below; add entries for new acronyms.
// =============================================================================
import { prefs } from './prefs.js';

const PRONOUNCE = [
  [/CO₂/g, 'C O 2'], [/NO₂/g, 'N O 2'], [/\bppm\b/g, 'parts per million'],
  [/\bGEDI\b/g, 'Jedi'], [/\bGEOS-CF\b/g, 'geos C F'], [/\bGEOS\b/g, 'geos'],
  [/\bRH100\b/g, 'R H 100'], [/\bISS\b/g, 'I S S'], [/\bSVS\b/g, 'S V S'],
  [/×\s?10¹⁵/g, 'times ten to the fifteen'], [/molec·cm⁻²|molec\/cm²/g, 'molecules per square centimetre'],
  [/·/g, ','], [/♪/g, ''], [/–/g, ' to '], [/°N/g, ' degrees north'], [/°S/g, ' degrees south'],
  [/°E/g, ' degrees east'], [/°W/g, ' degrees west'], [/°/g, ' degrees'],
];
const PAUSE = { tiny: 0, comma: 70, colon: 230, beat: 290, end: 470, ex: 470, q: 520, ellipsis: 640, para: 880 };
const RANK = { none: 0, tiny: 1, comma: 2, colon: 3, beat: 4, end: 5, ex: 5, q: 5, ellipsis: 6, para: 7 };
const VOICE_PREF = [/Ryan.*Natural/i, /Thomas.*Natural/i, /George/i, /Arthur/i, /Daniel/i, /Google UK English Male/i, /Oliver/i, /Ryan/i, /Thomas/i, /Malcolm/i, /en-gb.*male/i];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const ok = typeof window !== 'undefined' && 'speechSynthesis' in window;
let voices = [], voice = null, run = 0, live = null, pending = null, busy = false;
const duckers = new Set(), voiceListeners = new Set();

function liveRegion() {
  if (live) return live;
  live = document.createElement('p');
  live.className = 'sr-only'; live.setAttribute('aria-live', 'polite'); live.setAttribute('aria-atomic', 'true');
  live.id = 'ej-live';
  document.body.appendChild(live);
  return live;
}

function pickVoice() {
  if (!ok) return;
  voices = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
  const wanted = prefs.get('voice');
  voice = (wanted && voices.find(v => v.name === wanted)) || null;
  for (let i = 0; !voice && i < VOICE_PREF.length; i++) voice = voices.find(v => VOICE_PREF[i].test(`${v.name} ${v.lang}`)) || null;
  if (!voice) voice = voices.find(v => /en-GB/i.test(v.lang)) || voices[0] || null;
  voiceListeners.forEach(fn => fn(voices, voice));
}
if (ok) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

export const speakable = t => PRONOUNCE.reduce((s, [re, rep]) => s.replace(re, rep), t);
export const plain = t => t.replace(/\s*\|\|?\s*/g, ' ').replace(/\*/g, '').replace(/\s+/g, ' ').trim();

// Split a marked-up script into phrases with pitch, rate and pause after each.
function phrasesOf(raw) {
  const t = speakable(raw).replace(/\.\.\./g, '…').replace(/\s+/g, ' ').trim();
  const parts = t.split(/(\|\||\||…|[.!?]+(?=\s|$)|[,;:—]|\*)/), out = [];
  let buf = '', emph = false;
  const flush = brk => {
    const x = buf.trim(); buf = '';
    if (!x) { if (out.length && RANK[brk] > RANK[out[out.length - 1].brk]) out[out.length - 1].brk = brk; return; }
    out.push({ text: x, emph, brk }); emph = false;
  };
  for (const p of parts) {
    if (p === undefined || p === '') continue;
    if (p === '*') emph = true;
    else if (p === '||') flush('para');
    else if (p === '|') flush('beat');
    else if (p === '…') flush('ellipsis');
    else if (/^[.!?]+$/.test(p)) { buf += p; flush(p.includes('?') ? 'q' : p.includes('!') ? 'ex' : 'end'); }
    else if (p === ',') { buf += ','; flush('comma'); }
    else if (p === ';' || p === ':' || p === '—') { buf += ','; flush('colon'); }
    else buf += p;
  }
  flush('end');
  const merged = [];
  for (const ph of out) {
    const prev = merged[merged.length - 1];
    if (prev && prev.brk === 'comma' && !prev.emph && !ph.emph && (prev.text.split(' ').length < 3 || ph.text.split(' ').length < 2)) { prev.text += ' ' + ph.text; prev.brk = ph.brk; }
    else merged.push(ph);
  }
  let sentence = [], si = 0;
  merged.forEach((ph, i) => {
    sentence.push(ph);
    if (!(RANK[ph.brk] >= 5 || i === merged.length - 1)) return;
    const n = sentence.length, base = 0.82 + 0.035 * Math.sin(si * 1.7), rate = 0.86;
    sentence.forEach((q, k) => {
      const pos = n > 1 ? k / (n - 1) : 1, last = k === n - 1;
      q.pitch = base + 0.08 * (1 - pos);
      q.rate = rate + (k === 0 && n > 1 ? 0.03 : 0);
      if (last) { q.pitch -= 0.05; q.rate -= 0.06; }
      if (last && q.brk === 'q') q.pitch += 0.16;
      if (q.brk === 'ex') { q.pitch += 0.05; q.rate += 0.04; }
      if (q.brk === 'ellipsis') { q.rate -= 0.05; q.pitch -= 0.02; }
      if (q.emph) { q.pitch += 0.07; q.rate -= 0.1; }
      q.pitch = clamp(q.pitch, 0.5, 1.4); q.rate = clamp(q.rate, 0.6, 1.2); q.pause = PAUSE[q.brk] || 0;
    });
    sentence = []; si++;
  });
  return merged;
}

let queue = [];
function speakNow(text, done) {
  const myRun = ++run, q = phrasesOf(text);
  busy = true;
  try { speechSynthesis.cancel(); } catch {}
  duckers.forEach(fn => fn(true));
  const finish = () => { if (myRun !== run) return; busy = false; duckers.forEach(fn => fn(false)); done && done(); };
  setTimeout(function next(i = 0) {
    if (myRun !== run) return;
    if (i >= q.length) return finish();
    const ph = q[i]; let fired = false, wd;
    const fin = () => { if (fired) return; fired = true; clearTimeout(wd); setTimeout(() => next(i + 1), ph.pause); };
    try {
      const u = new SpeechSynthesisUtterance(ph.text.replace(/,$/, ''));
      if (voice) { u.voice = voice; u.lang = voice.lang; }
      u.rate = ph.rate; u.pitch = ph.pitch; u.onend = fin; u.onerror = fin;
      wd = setTimeout(fin, 1800 + ph.text.split(' ').length * 560 / ph.rate); // safety net if 'end' never fires
      speechSynthesis.speak(u);
    } catch { fin(); }
  }, 60);
}
function drain() { const t = queue.shift(); if (t) speakNow(t, drain); }

// Browsers only allow speech after the visitor has interacted with the page.
function hasActivation() { return !navigator.userActivation || navigator.userActivation.hasBeenActive; }
function armPending() {
  const go = () => { removeEventListener('pointerdown', go, true); removeEventListener('keydown', go, true); if (pending) { const p = pending; pending = null; narrator.say(p.text, p.opts); } };
  addEventListener('pointerdown', go, true); addEventListener('keydown', go, true);
}

export const narrator = {
  get available() { return ok; },
  get enabled() { return ok && prefs.get('narration'); },
  setEnabled(on) { prefs.set('narration', !!on); if (!on) this.hush(); },
  get voices() { return voices; },
  get voice() { return voice; },
  setVoice(name) { prefs.set('voice', name); pickVoice(); },
  onVoices(fn) { voiceListeners.add(fn); fn(voices, voice); return () => voiceListeners.delete(fn); },
  onDuck(fn) { duckers.add(fn); return () => duckers.delete(fn); },

  /**
   * Announce a line. opts: { speak = true, queue = false, live = true }
   * - live:  also write it to the screen-reader live region
   * - speak: read it with the built-in voice (if narration is on)
   * - queue: wait for the current line to finish instead of interrupting it
   */
  say(text, opts = {}) {
    const { speak = true, queue: q = false, live: toLive = true } = opts;
    if (!text) return;
    if (toLive) { const el = liveRegion(); el.textContent = ''; setTimeout(() => { el.textContent = plain(text); }, 30); }
    if (!speak || !this.enabled) return;
    if (!hasActivation()) { if (!pending) armPending(); pending = { text, opts: { ...opts, live: false } }; return; }
    if (q && (busy || queue.length)) { queue.push(text); return; }
    queue = []; speakNow(text, drain);
  },
  hush() { run++; busy = false; queue = []; pending = null; if (ok) try { speechSynthesis.cancel(); } catch {} duckers.forEach(fn => fn(false)); },
};
