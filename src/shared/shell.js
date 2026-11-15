// =============================================================================
// Exhibit shell: the shared frame around every exhibit page.
//
//   import { mountShell } from '../../src/shared/shell.js';
//   const shell = mountShell({ id: 'co2', transcript: content.transcript });
//
// Gives every exhibit, for free:
//   top bar: ← Orbit · chapter name · Controls · Transcript · Settings · Next
//   wall label (#ej-label): title, subtitle and dataset from story.js
//   drawer (#ej-drawer): the exhibit's controls/readings, hidden until asked for
//   settings: narration + voice, high contrast, reduce motion, text size
// and marks the chapter as visited for the hub.
// =============================================================================
import { CHAPTERS, chapterIndex, SITE } from '../content/story.js';
import { prefs, visited } from './prefs.js';
import { narrator, plain } from './narrator.js';

export const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  kids.flat().forEach(k => k != null && e.append(k));
  return e;
};

/** A small popover menu anchored under a button. Returns { button, panel, close }. */
export function popover(label, build, { id = 'ej-settings' } = {}) {
  const panel = el('div', { class: 'ej-pop', id, role: 'group', 'aria-label': label, hidden: '' });
  const button = el('button', { 'aria-expanded': 'false', 'aria-controls': id }, label);
  const set = open => { panel.hidden = !open; button.setAttribute('aria-expanded', String(open)); if (open) panel.querySelector('button, select')?.focus(); };
  button.addEventListener('click', e => { e.stopPropagation(); set(panel.hidden); });
  document.addEventListener('pointerdown', e => { if (!panel.hidden && !panel.contains(e.target) && e.target !== button) set(false); });
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); set(false); button.focus(); } });
  build(panel);
  return { button, panel, close: () => set(false), isOpen: () => !panel.hidden };
}

/** Narration / voice / contrast / motion / text size rows for a settings popover. */
export function settingsRows(panel, { onPrefs, extra = [] } = {}) {
  const narrBtn = el('button', { 'aria-pressed': String(narrator.enabled), 'aria-keyshortcuts': 'N' }, 'Narrator voice');
  const syncNarr = () => narrBtn.setAttribute('aria-pressed', String(narrator.enabled));
  narrBtn.addEventListener('click', () => { narrator.setEnabled(!narrator.enabled); syncNarr(); narrator.say(narrator.enabled ? 'Narration on.' : 'Narration off.'); });
  if (!narrator.available) narrBtn.hidden = true;

  const voiceSel = el('select', { 'aria-label': 'Narrator voice' });
  const voiceRow = el('label', {}, 'Voice', voiceSel);
  narrator.onVoices((vs, cur) => {
    voiceSel.textContent = '';
    vs.forEach(v => { const o = el('option', { value: v.name }, `${v.name.replace(/Microsoft |Google /, '').replace(/ - .*/, '')} (${v.lang})`); if (v === cur) o.selected = true; voiceSel.append(o); });
    voiceRow.hidden = !vs.length;
  });
  voiceSel.addEventListener('change', () => { narrator.setVoice(voiceSel.value); narrator.setEnabled(true); syncNarr(); narrator.say('This is how I sound.'); });

  const pressBtn = (label, key, on, off) => {
    const b = el('button', { 'aria-pressed': String(prefs.get(key) === on) }, label);
    b.addEventListener('click', () => { const v = prefs.toggle(key, on, off); b.setAttribute('aria-pressed', String(v === on)); narrator.say(`${label} ${v === on ? 'on' : 'off'}.`, { speak: false }); onPrefs && onPrefs(prefs.all()); });
    return b;
  };
  const sizes = ['normal', 'large', 'xlarge'], names = { normal: 'Normal', large: 'Large', xlarge: 'Larger' };
  const sizeV = el('span', { class: 'v' }, names[prefs.get('text')] || 'Normal');
  const textBtn = el('button', { 'aria-label': 'Text size' }, 'Text size', sizeV);
  textBtn.addEventListener('click', () => { const v = sizes[(sizes.indexOf(prefs.get('text')) + 1) % 3]; prefs.set('text', v); sizeV.textContent = names[v]; narrator.say(`Text size ${names[v]}.`, { speak: false }); onPrefs && onPrefs(prefs.all()); });

  panel.append(narrBtn, voiceRow, ...extra, el('hr'), pressBtn('High contrast', 'contrast', 'high', 'normal'), pressBtn('Reduce motion', 'motion', 'reduce', 'full'), textBtn);
  return { narrBtn, syncNarr };
}

/**
 * @param {object} o
 * @param {string} o.id            chapter id from src/content/story.js
 * @param {Array<{heading:string,text:string}>|Function} [o.transcript]  sections of the written transcript
 * @param {string} [o.mount='#ej-shell']  where to render the bar
 * @param {Function} [o.onPrefs]   called when contrast/motion/text size change
 */
export function mountShell({ id, transcript = [], mount = '#ej-shell', onPrefs } = {}) {
  const i = chapterIndex(id), ch = CHAPTERS[i], next = CHAPTERS[i + 1] || null;
  visited.add(id);
  document.documentElement.style.setProperty('--accent', ch.color);
  if (!document.title || document.title === 'Exhibit') document.title = `${ch.title} · ${SITE.name}`;

  const host = document.querySelector(mount) || document.body.insertBefore(el('header'), document.body.firstChild);
  host.classList.add('ej-shell');
  host.setAttribute('role', 'banner');

  // --- transcript dialog
  const dlgBody = el('div', { class: 'body' });
  const dlg = el('dialog', { class: 'ej-dialog', 'aria-labelledby': 'ej-tr-title' },
    el('header', {}, el('h2', { id: 'ej-tr-title' }, ch.title), el('button', { onclick: () => dlg.close() }, 'Close')),
    dlgBody);
  const renderTranscript = () => {
    const secs = typeof transcript === 'function' ? transcript() : transcript;
    dlgBody.textContent = '';
    secs.forEach(s => { if (s.heading) dlgBody.append(el('h3', {}, s.heading)); dlgBody.append(el('p', {}, plain(s.text))); });
  };
  const openTranscript = () => { renderTranscript(); dlg.showModal(); };

  // --- settings
  let narr;
  const settings = popover('Settings', p => { narr = settingsRows(p, { onPrefs }); });

  // --- drawer (the exhibit's controls and readings)
  const drawer = document.getElementById('ej-drawer');
  let drawerBtn = null;
  const setDrawer = open => {
    if (!drawer) return;
    drawer.hidden = !open; drawerBtn.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('drawer-open', open);
    if (open) drawer.querySelector('button, input, select, a')?.focus();
  };
  if (drawer) {
    drawer.hidden = true;
    drawer.classList.add('drawer');
    drawerBtn = el('button', { 'aria-expanded': 'false', 'aria-controls': 'ej-drawer', onclick: () => setDrawer(drawer.hidden) }, 'Controls');
    drawer.prepend(el('div', { class: 'drawer-head' }, el('b', {}, 'Controls'), el('button', { class: 'ghost', 'aria-label': 'Close controls', onclick: () => { setDrawer(false); drawerBtn.focus(); } }, 'Close')));
    drawer.addEventListener('keydown', e => { if (e.key === 'Escape' && !e.target.closest('[role=combobox]')) { e.preventDefault(); e.stopPropagation(); setDrawer(false); drawerBtn.focus(); } });
  }

  host.textContent = '';
  host.append(el('div', { class: 'ej-bar' },
    el('a', { class: 'btn ej-home', href: `/?from=${id}`, 'aria-label': 'Back to orbit (the hub)', 'aria-keyshortcuts': 'Escape' }, '← Orbit'),
    el('div', { class: 'ej-chap' }, el('span', { class: 'n' }, String(i + 1).padStart(2, '0')), ch.title),
    el('div', { class: 'ej-tools', role: 'group', 'aria-label': 'Page tools' },
      drawerBtn,
      el('button', { onclick: openTranscript, 'aria-haspopup': 'dialog', 'aria-keyshortcuts': 'T' }, 'Transcript'),
      settings.button,
      next ? el('a', { class: 'btn ej-next-link', href: next.path }, `${next.title} →`) : el('a', { class: 'btn ej-next-link', href: `/?from=${id}` }, 'Finish →'),
    )),
  settings.panel);
  document.body.append(dlg);

  // wall label beside the piece
  const label = document.getElementById('ej-label');
  if (label) {
    label.classList.add('ej-label');
    label.prepend(el('h1', {}, ch.title), el('p', {}, ch.subtitle), el('p', { class: 'medium' }, ch.dataset + (ch.note ? ` · ${ch.note}` : '')));
  }

  // skip link
  const main = document.querySelector('main');
  if (main) { main.id ||= 'main'; document.body.insertBefore(el('a', { class: 'skip-link', href: `#${main.id}` }, 'Skip to the exhibit'), document.body.firstChild); }

  // "next chapter" at the bottom of the page, if the page has a slot for it
  const slot = document.getElementById('ej-next');
  if (slot) {
    slot.className = 'ej-next';
    slot.append(next ? el('p', {}, 'Next', el('b', {}, next.title)) : el('p', {}, 'The last piece. Return to orbit to finish.'),
      el('div', { class: 'ej-tools' },
        el('a', { class: 'btn', href: `/?from=${id}` }, '← Orbit'),
        next ? el('a', { class: 'btn primary', href: next.path }, `${next.title} →`) : null));
  }

  // global keys: Escape → close drawer / orbit, N → narration, T → transcript (ignored while typing)
  addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || tag === 'input' || tag === 'select' || tag === 'textarea' || dlg.open) return;
    if (e.key === 'Escape') {
      if (settings.isOpen()) { settings.close(); return; }
      if (drawer && !drawer.hidden) { setDrawer(false); return; }
      if (e.target === document.body || e.target.tagName === 'CANVAS') location.href = `/?from=${id}`;
    }
    else if (e.key === 'n' || e.key === 'N') { if (e.target.closest && e.target.closest('[data-own-keys]')) return; narr.narrBtn.click(); }
    else if (e.key === 't' || e.key === 'T') openTranscript();
  });

  return { chapter: ch, index: i, next, narrator, say: (t, o) => narrator.say(t, o), openDrawer: () => setDrawer(true) };
}
