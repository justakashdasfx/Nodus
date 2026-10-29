/* NOTEBOOK — the notes inside one notebook, as a gallery. */
import * as store from '../core/store.js';
import { CONFIG } from '../core/config.js';
import { escapeHtml } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { button, viewHead, gallery, noteCard, noteList, emptyState } from '../ui/components.js';

/** Sorts the notes of a notebook: 'edited' (newest edit first), 'created' (newest first) or 'name' (A–Z). */
const sortNotes = (notes, mode) => [...notes].sort(mode === 'name'
  ? (a, b) => (a.title || 'Untitled').localeCompare(b.title || 'Untitled', undefined, { sensitivity: 'base' })
  : mode === 'created' ? (a, b) => b.createdAt - a.createdAt : (a, b) => b.updatedAt - a.updatedAt);

const notFound = (title, text, actionHtml, art = 'notfound') => ({ html: `<div class="view">${emptyState({ title, text, actionHtml, art })}</div>` });

export function render({ id }) {
  const folder = store.getFolder(id);
  if (!folder) {
    return notFound('Notebook not found', 'It may have been deleted.',
      '<a class="btn btn--solid" href="#/notebooks"><span class="btn__label">Back to notebooks</span></a>');
  }
  if (folder.deletedAt) {
    return notFound('This notebook is in Trash', 'Restore it to see its notes again.',
      button({ action: 'notebook-restore', iconName: 'restore', label: 'Restore notebook', variant: 'btn--solid', data: { id } }));
  }

  const sortMode = CONFIG.notebookSorts.some(([k]) => k === folder.sort) ? folder.sort : CONFIG.notebookSorts[0][0];
  const notes = sortNotes(store.notesInFolder(id), sortMode);
  const newBtn = button({ action: 'note-new', iconName: 'plus', label: 'New note', variant: 'button', data: { folder: id } });
  const style = folder.viewStyle === 'list' || folder.viewStyle === 'gallery' ? folder.viewStyle : CONFIG.defaults.views.notebook;
  // [Sort ▾]  [+ New note]  [⋯]   — Edit, Gallery | List and Delete live in the ⋯ menu (js/app.js → 'notebook-more')
  const sortLabel = CONFIG.notebookSorts.find(([k]) => k === sortMode)[1];
  const sortBtn = button({ action: 'notebook-sort', iconName: 'sort', label: sortLabel, data: { id } });
  const moreBtn = `<button type="button" class="btn btn--icon" data-action="notebook-more" data-id="${id}" aria-label="More" aria-haspopup="menu" title="More">${icon('more')}</button>`;
  const actions = sortBtn + newBtn + moreBtn;
  const body = notes.length
    ? (style === 'list' ? noteList(notes) : gallery(notes.map(noteCard)))
    : emptyState({ title: 'This notebook is empty', text: 'Add the first note to get started.', art: 'notes',
        actionHtml: button({ action: 'note-new', iconName: 'plus', label: 'Add a note', variant: 'btn--solid', data: { folder: id } }) });
  const subtitle = `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`;
  const description = folder.description
    ? `<p class="view-head__desc">${escapeHtml(folder.description)}</p>`
    : `<button type="button" class="view-head__add-desc" data-action="notebook-edit" data-id="${id}">Add a description</button>`;
  return { html: `<div class="view">${viewHead({ title: folder.name, description, actions })}${body}</div>` };
}
