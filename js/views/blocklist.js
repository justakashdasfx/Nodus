/* BLOCK LIST — rows of matching blocks (block text · note name · notebook). Used by the tag page and by threads.
   Each row is: the FULL text of the block, and under it  [note icon] Note name · [folder icon] Notebook
   — the icons are 'note' and 'folder' in js/core/icons.js. Look: .block-row … in css/gallery.css. */
import * as store from '../core/store.js';
import { escapeHtml } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { ownText } from '../core/blockindex.js';

/* The block index only keeps the first 160 characters of a block (that keeps search fast), so the full text is read from the
   note itself. It is cached per note version, so a long list stays quick. */
const fullText = new Map();   // 'noteId:updatedAt' → Map(blockId → text)
function textOf(note, block) {
  const key = `${note.id}:${note.updatedAt}`;
  let byId = fullText.get(key);
  if (!byId) {
    byId = new Map();
    const body = new DOMParser().parseFromString(`<body>${note.html || ''}</body>`, 'text/html').body;
    body.querySelectorAll('[data-bid]').forEach((el) => byId.set(el.getAttribute('data-bid'), ownText(el)));
    fullText.set(key, byId);
    if (fullText.size > 300) fullText.delete(fullText.keys().next().value);   // keep the cache small
  }
  return byId.get(block.id) || block.text || '';
}

export function blockRows(hits) {
  return hits.map(({ note, block }) => {
    const folder = note.folderId ? store.getFolder(note.folderId) : null;
    const place = note.type === 'journal' ? { ic: 'journal', name: 'Journal' }
      : folder ? { ic: 'notebook', name: folder.name }
      : { ic: 'inbox', name: 'Inbox' };                  // a note with no notebook lives in the Inbox
    const item = (ic, name) => `<span class="where__item">${icon(ic, 14)}<span class="where__name">${escapeHtml(name)}</span></span>`;
    const where = `${item('note', note.title || 'Untitled')}<span class="where__sep" aria-hidden="true">·</span>${item(place.ic, place.name)}`;
    const full = textOf(note, block);
    const text = full
      ? `<span class="row__title block-row__text ${/^h[1-4]$/.test(block.t) ? 'block-row__text--heading' : ''}">${escapeHtml(full)}</span>`
      : '<span class="row__title block-row__text block-row__text--empty">Empty block</span>';
    return `<a class="row block-row" href="#/note/${note.id}/${block.id}">${text}<span class="row__text block-row__where">${where}</span></a>`;
  }).join('');
}
