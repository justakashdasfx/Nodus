/* NOTEBOOKS — your notebooks and folders (a folder holds notebooks) as cards or a list, with Add notebook and New folder.
   Drag one notebook onto another to make a folder of the two; drag onto a folder to put it inside (js/ui/folder-dnd.js). */
import * as store from '../core/store.js';
import * as settings from '../core/settings.js';
import { button, viewHead, gallery, notebookCard, notebookList, viewSwitch, emptyState } from '../ui/components.js';

export function render() {
  const items = store.topLevel();
  const style = settings.getViewStyle('notebooks');
  const add = button({ action: 'notebook-new', iconName: 'plus', label: 'Add notebook', variant: 'button' });
  const addFolder = button({ action: 'coll-new', iconName: 'folder', label: 'New folder' });
  const body = items.length
    ? (style === 'list' ? notebookList(items) : gallery(items.map(notebookCard)))
    : emptyState({ title: 'No notebooks yet', text: 'Notebooks group related notes together. Drag one notebook onto another to make a folder.', art: 'notebooks', actionHtml: add });
  return { html: `<div class="view">${viewHead({ title: 'Notebooks', actions: items.length ? viewSwitch(style, { page: 'notebooks' }) + addFolder + add : addFolder })}${body}</div>` };
}
