/* ============================================================================
   NOTE LINKS — "[[" in a note makes a link to another note.
   In the note's HTML a link is   <span data-note-link="NOTE-ID">Name</span>
   (+ data-alias when you gave it a short name of your own). The id never changes, so a link survives renaming the note.
   Nothing extra is stored: backlinks are found by looking through the notes' HTML (instant at personal scale).
   ========================================================================== */
import * as store from './store.js';

/** The ids a piece of HTML links to. */
export function linkIds(html) {
  const out = new Set();
  for (const m of String(html || '').matchAll(/data-note-link="([a-z0-9]+)"/g)) out.add(m[1]);
  return out;
}

/** Notes (not in Trash) that link to this one. */
export function backlinksTo(id) {
  return store.searchableNotes().filter((n) => n.id !== id && String(n.html || '').includes(`data-note-link="${id}"`));
}

/** Notes (not in Trash) that @mention this note or mind map. */
export function mentionsOf(id) {
  return store.searchableNotes().filter((n) => n.id !== id && String(n.html || '').includes(`data-note-mention="${id}"`));
}

/** Notes this one links to (that still exist). */
export function outgoing(note) {
  return [...linkIds(note.html)].filter((x) => x !== note.id).map((x) => store.getNote(x)).filter((n) => n && !n.deletedAt);
}

/** The line of text around the link to `id` inside `note`. */
export function snippetFor(note, id) {
  const doc = new DOMParser().parseFromString(`<body>${note.html || ''}</body>`, 'text/html');
  const link = doc.body.querySelector(`span[data-note-link="${id}"], span[data-note-mention="${id}"]`);
  const block = link?.closest('li, p, h1, h2, h3, h4, blockquote, summary') || link;
  const text = (block?.textContent || '').replace(/\s+/g, ' ').trim();
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}
