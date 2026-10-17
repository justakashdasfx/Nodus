/* BLOCK LIST — rows of matching blocks (block text · note name · notebook). Used by the tag page and by threads.
   Each row ends with  [note icon] Note name · [folder icon] Notebook  — the icons are 'note' and 'folder' in js/core/icons.js. */
import * as store from '../core/store.js';
import { escapeHtml } from '../core/utils.js';
import { icon } from '../core/icons.js';

export function blockRows(hits) {
  return hits.map(({ note, block }) => {
    const folder = note.folderId ? store.getFolder(note.folderId) : null;
    const place = note.type === 'journal' ? { ic: 'journal', name: 'Journal' }
      : folder ? { ic: 'folder', name: folder.name }
      : { ic: 'inbox', name: 'Inbox' };                  // a note with no notebook lives in the Inbox
    const item = (ic, name) => `<span class="where__item">${icon(ic, 14)}<span class="where__name">${escapeHtml(name)}</span></span>`;
    const where = `${item('note', note.title || 'Untitled')}<span class="where__sep" aria-hidden="true">·</span>${item(place.ic, place.name)}`;
    const text = block.text
      ? `<span class="row__title block-row__text ${/^h[1-4]$/.test(block.t) ? 'block-row__text--heading' : ''}">${escapeHtml(block.text.slice(0, 220))}</span>`
      : '<span class="row__title block-row__text block-row__text--empty">Empty block</span>';
    return `<a class="row block-row" href="#/note/${note.id}/${block.id}">${text}<span class="row__text block-row__where">${where}</span></a>`;
  }).join('');
}
