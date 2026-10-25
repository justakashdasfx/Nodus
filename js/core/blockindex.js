/* ============================================================================
   BLOCK INDEX — every paragraph, heading, quote and list item is a "block".
   Each block carries a permanent id (data-bid) and optional tags (data-tags="a b").
   Each note keeps a small index of its blocks:

     note.blocks = [ { id, t, text, tags? }, … ]      in document order
       id    permanent block id
       t     'p' | 'h1'…'h4' | 'quote' | 'code' | 'li'
       text  the block's own text, first 160 characters (a nested list is not included)
       tags  lower-case tags (left out when the block has none)
     task  checklist items only: 1 = a Task block (always on the Tasks page)   chk   checklist items only: 1 = ticked, 0 = not ticked          due  checklist items only: 'YYYY-MM-DD' (left out when there is none)
     Empty, untagged blocks are not listed.

   Migration: notes written before blocks existed get ids the first time they are
   loaded. Those ids are derived from the note id + position, so every device
   produces the SAME ids for the same text and nothing needs to be synced for it.
   ========================================================================== */

import { sanitizeHtml, parseTags, BID_RE, DUE_RE } from './utils.js';

/** Top-level paragraphs/headings/quotes (a stray <div> counts as a paragraph) and every list item. */
export const BLOCK_SEL = ':scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > blockquote, :scope > pre, :scope > div, '
  + ':scope > details > summary, :scope > details > p, :scope > details > h1, :scope > details > h2, :scope > details > h3, :scope > details > h4, :scope > details > blockquote, :scope > details > pre, '   // a toggle's title and what is inside it
  + ':scope li';

export const blocksOf = (root) => [...root.querySelectorAll(BLOCK_SEL)];

export function blockType(el) {
  const tag = el.tagName;
  if (tag === 'LI') return 'li';
  if (/^H[1-4]$/.test(tag)) return tag.toLowerCase();
  if (tag === 'BLOCKQUOTE') return 'quote';
  if (tag === 'PRE') return 'code';
  return 'p';
}

/** The block's own text (a nested list inside a list item is not part of it). */
export function ownText(el) {
  let text = '';
  el.childNodes.forEach((n) => {
    if (n.nodeType === 3) text += n.nodeValue;
    else if (n.nodeType === 1 && !/^(UL|OL)$/.test(n.tagName)) text += n.tagName === 'BR' ? ' ' : n.textContent;
  });
  return text.replace(/[\s\u00a0]+/g, ' ').trim();
}

/** Index of the blocks inside a live DOM element. */
export function indexRoot(root) {
  const out = [];
  for (const el of blocksOf(root)) {
    const id = el.getAttribute('data-bid');
    if (!id || !BID_RE.test(id)) continue;
    const text = ownText(el);
    const tags = parseTags(el.getAttribute('data-tags'));
    if (!text && !tags.length) continue;
    const entry = { id, t: blockType(el), text: text.slice(0, 160) };
    if (tags.length) entry.tags = tags;
    if (el.tagName === 'LI' && el.hasAttribute('data-check')) {   // checklist item: the Tasks page reads these two
      entry.chk = el.getAttribute('data-check') === 'true' ? 1 : 0;
      if (el.hasAttribute('data-task')) entry.task = 1;      // a Task block: it always shows on the Tasks page
      const due = el.getAttribute('data-due');
      if (due && DUE_RE.test(due)) entry.due = due;
    }
    out.push(entry);
  }
  return out;
}

const parseBody = (html) => new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;

/** Index of a note's HTML (does not change the HTML). */
export const indexHtml = (html = '') => indexRoot(parseBody(sanitizeHtml(html)));

/**
 * Gives every block without a valid, unique id a new one from makeId(n).
 * The first block holding an id keeps it; later copies get a new id. Returns true if anything changed.
 */
export function assignIds(root, makeId) {
  const used = new Set();
  const need = [];
  for (const el of blocksOf(root)) {
    const id = el.getAttribute('data-bid');
    if (id && BID_RE.test(id) && !used.has(id)) used.add(id); else need.push(el);
  }
  let n = 0;
  for (const el of need) {
    let id;
    do { id = makeId(n++); } while (used.has(id));
    used.add(id);
    el.setAttribute('data-bid', id);
  }
  return need.length > 0;
}

function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Same note + same position → same id, on every device. */
export const legacyId = (noteId, n) => 'm' + hash32(`${noteId}:${n}`).toString(36).padStart(7, '0');

/** Old note → { html with block ids, blocks index }. */
export function migrateHtml(html = '', noteId = '') {
  const body = parseBody(sanitizeHtml(html));
  assignIds(body, (n) => legacyId(noteId, n));
  return { html: body.innerHTML, blocks: indexRoot(body) };
}
