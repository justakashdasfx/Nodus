/* ============================================================================
   RELATED NOTES — a toggle at the END of a note (after the last line), the list opens below it.
   "› Related notes  3"  → click to open a list with
     Linked from   the notes that link to this one, with the line around the link
     Links to      the notes this one links to
   Click a note to open it · Shift+click → side pane. Hidden when the note has no links either way.
   Look: css/tasks-tags.css → "RELATED NOTES". Links are made with "[[" (js/editor/note-link.js).
   ========================================================================== */
import * as store from '../core/store.js';
import { escapeHtml } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { backlinksTo, outgoing, snippetFor } from '../core/links.js';
import * as pane from './pane.js';

let open = false;     // remembered while the app is open

export function mountRelated(el, noteId) {
  const paint = () => {
    const note = store.getNote(noteId);
    if (!note || !el.isConnected) return;
    const from = backlinksTo(noteId);
    const to = outgoing(note);
    const total = new Set([...from.map((n) => n.id), ...to.map((n) => n.id)]).size;
    el.hidden = total === 0;
    if (!total) return;
    const item = (n, snip) => `<a class="rel__item" href="#/note/${n.id}" data-id="${n.id}"><span class="rel__title">${escapeHtml(n.title || 'Untitled')}</span>${snip ? `<span class="rel__snip">${escapeHtml(snip)}</span>` : ''}</a>`;
    const group = (label, list, snip) => list.length ? `<div class="rel__group"><div class="rel__label">${label}</div>${list.map((n) => item(n, snip ? snippetFor(n, noteId) : '')).join('')}</div>` : '';
    el.innerHTML = `<div class="rel__inner">
      <button type="button" class="rel__bar" aria-expanded="${open}">${icon('caret', 12)}<span>Related notes</span><span class="rel__n">${total}</span></button>
      <div class="rel__panel"${open ? '' : ' hidden'}>${group('Linked from', from, true)}${group('Links to', to, false)}</div>
    </div>`;
  };
  paint();

  const onClick = (e) => {
    const bar = e.target.closest('.rel__bar');
    if (bar) { open = !open; paint(); return; }
    const a = e.target.closest('.rel__item');
    if (a && e.shiftKey) { e.preventDefault(); pane.openNote(a.dataset.id); }
  };
  el.addEventListener('click', onClick);

  let t = 0;
  const off = store.subscribe(() => { clearTimeout(t); t = setTimeout(paint, 500); });
  return () => { clearTimeout(t); off(); el.removeEventListener('click', onClick); };
}
