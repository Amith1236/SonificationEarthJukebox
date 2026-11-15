// =============================================================================
// The live "what you're hearing" strip under a piece: one column per data
// value, each showing the current number, a meter, and the sound it drives.
//
//   const cues = mountCues('#cues', [
//     { id: 'height', label: 'Canopy height', sound: 'Main voice', rule: 'taller forest → higher note', color: '#06b6d4' },
//     …
//   ]);
//   cues.set('height', { value: '33.3 m', meter: 0.74, sound: '392 Hz · high' });
//
// Updates are visual only (it changes many times a second); screen-reader users
// get the same information from each exhibit's Describe button.
// =============================================================================
import { el } from './shell.js';

export function mountCues(target, defs) {
  const host = typeof target === 'string' ? document.querySelector(target) : target;
  host.classList.add('cues');
  host.setAttribute('aria-label', 'What you are hearing: each data value and the sound it drives');
  const cols = {};
  for (const d of defs) {
    const value = el('b', {}, '—'), bar = el('i', { style: `background:${d.color || 'var(--accent)'}` }), sound = el('em', {}, '—');
    const label = el('span', { class: 'k' }, d.label);
    host.append(el('div', { class: 'cue' }, label, value, el('div', { class: 'meter', 'aria-hidden': 'true' }, bar),
      el('span', { class: 's' }, d.sound, sound, el('small', {}, d.rule))));
    cols[d.id] = { value, bar, sound, label, col: host.lastChild };
  }
  return {
    set(id, { value, meter, sound, dim } = {}) {
      const c = cols[id]; if (!c) return;
      if (value != null) c.value.textContent = value;
      if (meter != null) c.bar.style.width = `${Math.max(0, Math.min(1, meter)) * 100}%`;
      if (sound != null) c.sound.textContent = sound;
      if (dim != null) c.col.classList.toggle('dim', dim);
    },
  };
}
