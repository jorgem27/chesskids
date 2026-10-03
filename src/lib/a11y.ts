// Per-device accessibility settings (stored in localStorage, applied as attributes on <html>):
//   data-motion="reduce"  fewer animations, no confetti
//   data-text="lg"        bigger text (everything is sized in rem)
//   data-contrast="high"  darker text, visible borders and focus rings
// Base.astro applies them in <head> before the first paint; the settings panel changes them live.

export const A11Y_KEY = 'ck-a11y';

export interface A11yPrefs { motion: boolean; text: boolean; contrast: boolean }

export function loadPrefs(): A11yPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(A11Y_KEY) ?? '{}');
    return { motion: !!p.motion, text: !!p.text, contrast: !!p.contrast };
  } catch {
    return { motion: false, text: false, contrast: false };
  }
}

export function applyPrefs(p: A11yPrefs) {
  const d = document.documentElement.dataset;
  if (p.motion) d.motion = 'reduce'; else delete d.motion;
  if (p.text) d.text = 'lg'; else delete d.text;
  if (p.contrast) d.contrast = 'high'; else delete d.contrast;
}

export function savePrefs(p: A11yPrefs) {
  try { localStorage.setItem(A11Y_KEY, JSON.stringify(p)); } catch { /* storage blocked */ }
  applyPrefs(p);
}

/** True when the user (or the OS) asked for less motion. */
export function reducedMotion(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dataset.motion === 'reduce' || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
