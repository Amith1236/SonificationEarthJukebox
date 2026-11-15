// Visitor preferences, saved in localStorage so they follow the visitor from the hub
// into every exhibit and back. Everything still works if storage is blocked.

const KEY = 'ej:prefs:v1';
const DEFAULTS = {
  narration: true,      // built-in voice reads the story aloud
  voice: '',            // name of the chosen speechSynthesis voice ('' = automatic)
  contrast: 'normal',   // 'normal' | 'high'
  motion: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'full',
  text: 'normal',       // 'normal' | 'large' | 'xlarge'
  ambience: true,       // hub background sound
};

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}

const state = load();
const listeners = new Set();

function apply() {
  const h = document.documentElement;
  h.dataset.contrast = state.contrast;
  h.dataset.motion = state.motion;
  h.dataset.text = state.text;
}
apply();

export const prefs = {
  get: k => state[k],
  all: () => ({ ...state }),
  set(k, v) {
    state[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
    apply();
    listeners.forEach(fn => fn(k, v, state));
  },
  toggle(k, a, b) { this.set(k, state[k] === a ? b : a); return state[k]; },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  get reduceMotion() { return state.motion === 'reduce'; },
  get highContrast() { return state.contrast === 'high'; },
};

// Which chapters the visitor has opened (for "visited" ticks in the hub)
const VKEY = 'ej:visited:v1';
export const visited = {
  all() { try { return new Set(JSON.parse(localStorage.getItem(VKEY) || '[]')); } catch { return new Set(); } },
  add(id) { const s = this.all(); s.add(id); try { localStorage.setItem(VKEY, JSON.stringify([...s])); } catch {} },
};
