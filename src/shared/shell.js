// =============================================================================
// Exhibit shell: the shared top bar on every exhibit page.
//
//   import { mountShell } from '../../src/shared/shell.js';
//   const shell = mountShell({ id: 'co2', transcript: content.transcript });
//
// Gives every exhibit, for free:
//   ← back to orbit · chapter label · transcript dialog · narration on/off + voice
//   · high contrast · reduce motion · text size · next chapter link
// and marks the chapter as visited for the hub.
// =============================================================================
import { CHAPTERS, chapterIndex, SITE } from '../content/story.js';
import { prefs, visited } from './prefs.js';
import { narrator, plain } from './narrator.js';

const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  kids.flat().forEach(k => e.append(k));
  return e;
};

/**
 * @param {object} o
 * @param {string} o.id            chapter id from src/content/story.js
 * @param {Array<{heading:string,text:string}>|Function} [o.transcript]  sections of the written transcript
 * @param {string} [o.mount='#ej-shell']  where to render the bar
 * @param {Function} [o.onPrefs]   called when contrast/motion/text size change
 */
export function mountShell({ id, transcript = [], mount = '#ej-shell', onPrefs } = {}) {
  const i = chapterIndex(id), ch = CHAPTERS[i], next = CHAPTERS[i + 1] || null;
  const n = CHAPTERS.length;
  visited.add(id);
  document.documentElement.style.setProperty('--accent', ch.color);
  if (!document.title || document.title === 'Exhibit') document.title = `${ch.title} · ${SITE.name}`;

  const host = document.querySelector(mount) || document.body.insertBefore(el('header'), document.body.firstChild);
  host.classList.add('ej-shell');
  host.setAttribute('role', 'banner');

  // --- transcript dialog
  const dlgBody = el('div', { class: 'body' });
  const dlg = el('dialog', { class: 'ej-dialog', 'aria-labelledby': 'ej-tr-title' },
    el('header', {}, el('h2', { id: 'ej-tr-title' }, `Transcript · ${ch.title}`), el('button', { onclick: () => dlg.close() }, 'Close')),
    dlgBody);
  const renderTranscript = () => {
    const secs = typeof transcript === 'function' ? transcript() : transcript;
    dlgBody.textContent = '';
    secs.forEach(s => { if (s.heading) dlgBody.append(el('h3', {}, s.heading)); dlgBody.append(el('p', {}, plain(s.text))); });
  };

  // --- buttons
  const narrBtn = el('button', { 'aria-pressed': String(narrator.enabled), 'aria-keyshortcuts': 'N', title: 'Built-in narrator voice' });
  const syncNarr = () => { narrBtn.textContent = narrator.enabled ? '🗣 Narration on' : '🔇 Narration off'; narrBtn.setAttribute('aria-pressed', String(narrator.enabled)); };
  narrBtn.addEventListener('click', () => { narrator.setEnabled(!narrator.enabled); syncNarr(); narrator.say(narrator.enabled ? 'Narration on.' : 'Narration off.'); });
  if (!narrator.available) narrBtn.hidden = true;

  const voiceSel = el('select', { class: 'opt', 'aria-label': 'Narrator voice' });
  narrator.onVoices((vs, cur) => {
    voiceSel.textContent = '';
    vs.forEach(v => { const o = el('option', { value: v.name }, `${v.name.replace(/Microsoft |Google /, '')} (${v.lang})`); if (v === cur) o.selected = true; voiceSel.append(o); });
    voiceSel.hidden = !vs.length;
  });
  voiceSel.addEventListener('change', () => { narrator.setVoice(voiceSel.value); narrator.setEnabled(true); syncNarr(); narrator.say('This is how I sound.'); });

  const pressBtn = (label, key, on, off) => {
    const b = el('button', { class: 'opt', 'aria-pressed': String(prefs.get(key) === on) }, label);
    b.addEventListener('click', () => { const v = prefs.toggle(key, on, off); b.setAttribute('aria-pressed', String(v === on)); narrator.say(`${label} ${v === on ? 'on' : 'off'}.`, { speak: false }); onPrefs && onPrefs(prefs.all()); });
    return b;
  };
  const sizes = ['normal', 'large', 'xlarge'];
  const textBtn = el('button', { class: 'opt', 'aria-label': 'Text size' }, 'A A');
  textBtn.addEventListener('click', () => { const v = sizes[(sizes.indexOf(prefs.get('text')) + 1) % 3]; prefs.set('text', v); narrator.say(`Text size ${v === 'xlarge' ? 'extra large' : v}.`, { speak: false }); onPrefs && onPrefs(prefs.all()); });

  host.textContent = '';
  host.append(el('div', { class: 'bar' },
    el('a', { class: 'btn home', href: `/?from=${id}`, 'aria-label': 'Back to orbit (the hub)', 'aria-keyshortcuts': 'Escape' }, '← Orbit'),
    el('div', { class: 'chap' }, el('small', {}, `Chapter ${String(i + 1).padStart(2, '0')} of ${String(n).padStart(2, '0')} · ${ch.subtitle}`), el('b', {}, ch.title)),
    el('div', { class: 'tools', role: 'group', 'aria-label': 'Page settings' },
      el('button', { onclick: () => { renderTranscript(); dlg.showModal(); }, 'aria-haspopup': 'dialog', 'aria-keyshortcuts': 'T' }, '📄 Transcript'),
      narrBtn, voiceSel,
      pressBtn('High contrast', 'contrast', 'high', 'normal'),
      pressBtn('Reduce motion', 'motion', 'reduce', 'full'),
      textBtn,
      next ? el('a', { class: 'btn primary', href: next.path }, `Next: ${next.title} →`) : el('a', { class: 'btn primary', href: `/?from=${id}` }, 'Finish in orbit ✦'),
    )));
  document.body.append(dlg);
  syncNarr();

  // skip link
  const main = document.querySelector('main');
  if (main) { main.id ||= 'main'; document.body.insertBefore(el('a', { class: 'skip-link', href: `#${main.id}` }, 'Skip to the exhibit'), document.body.firstChild); }

  // "next chapter" card at the bottom of the page, if the page has a slot for it
  const slot = document.getElementById('ej-next');
  if (slot) {
    slot.className = 'ej-next';
    slot.append(next
      ? el('p', {}, `Next in the journey: `, el('b', {}, next.title), ` · ${next.subtitle}`)
      : el('p', {}, 'This is the last chapter. Return to orbit to finish the journey.'),
    el('div', { class: 'tools' },
      el('a', { class: 'btn', href: `/?from=${id}` }, '← Back to orbit'),
      next ? el('a', { class: 'btn primary', href: next.path }, `Next: ${next.title} →`) : null));
  }

  // global keys: Escape → orbit, N → narration, T → transcript (ignored while typing)
  addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || tag === 'input' || tag === 'select' || tag === 'textarea' || dlg.open) return;
    if (e.key === 'Escape' && (e.target === document.body || e.target.tagName === 'CANVAS')) location.href = `/?from=${id}`;
    else if (e.key === 'n' || e.key === 'N') { if (e.target.closest && e.target.closest('[data-own-keys]')) return; narrBtn.click(); }
    else if (e.key === 't' || e.key === 'T') { renderTranscript(); dlg.showModal(); }
  });

  return { chapter: ch, index: i, next, narrator, say: (t, o) => narrator.say(t, o) };
}
