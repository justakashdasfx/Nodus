/* ============================================================================
   KEYS — matches keyboard events against the combos in config.js → shortcuts.
   Combo format:  'Mod+Shift+1'   (Mod = Ctrl on Windows/Linux, Cmd on Mac;
   either one works everywhere, so Ctrl+Shift+5 also works on a Mac).
   Digits match the physical digit key, so Shift+1 still counts as "1".
   ========================================================================== */

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');

function parse(combo) {
  const parts = combo.split('+');
  const key = parts.pop();
  return { key, mod: parts.includes('Mod'), shift: parts.includes('Shift'), alt: parts.includes('Alt') };
}

function keyMatches(e, key) {
  if (/^\d$/.test(key)) return e.code === `Digit${key}` || e.code === `Numpad${key}`;
  if (/^[a-z]$/i.test(key)) return (e.key || '').toLowerCase() === key.toLowerCase();
  if (key === '/') return e.code === 'Slash' || e.key === '/' || e.key === '?';
  return e.key === key;
}

export function matches(e, combo) {
  if (!combo) return false;
  const c = parse(combo);
  return (e.ctrlKey || e.metaKey) === c.mod && e.shiftKey === c.shift && e.altKey === c.alt && keyMatches(e, c.key);
}

/** 'Mod+Shift+1' → 'Ctrl+Shift+1' (or '⌘⇧1' on a Mac) for tooltips and menus. */
export function comboLabel(combo) {
  if (!combo) return '';
  const names = isMac ? { Mod: '⌘', Shift: '⇧', Alt: '⌥' } : { Mod: 'Ctrl', Shift: 'Shift', Alt: 'Alt' };
  return combo.split('+').map(p => names[p] || p).join(isMac ? '' : '+');
}
