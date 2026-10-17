/* NOTEBOOKS — every notebook as a card with its note count. */
import * as store from '../core/store.js';
import { button, viewHead, gallery, notebookCard, emptyState } from '../ui/components.js';

export function render() {
  const folders = store.folders();
  const add = button({ action: 'notebook-new', iconName: 'plus', label: 'Add notebook', variant: 'btn--solid' });
  const body = folders.length
    ? gallery(folders.map(notebookCard))
    : emptyState({ title: 'No notebooks yet', text: 'Notebooks group related notes together.', actionHtml: add });
  return { html: `<div class="view">${viewHead({ title: 'Notebooks', actions: folders.length ? add : '' })}${body}</div>` };
}
