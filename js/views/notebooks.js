/* NOTEBOOKS — every notebook as a card with its note count. */
import * as store from '../core/store.js';
import * as settings from '../core/settings.js';
import { button, viewHead, gallery, notebookCard, notebookList, viewSwitch, emptyState } from '../ui/components.js';

export function render() {
  const folders = store.folders();
  const style = settings.getViewStyle('notebooks');
  const add = button({ action: 'notebook-new', iconName: 'plus', label: 'Add notebook', variant: 'button' });
  const body = folders.length
    ? (style === 'list' ? notebookList(folders) : gallery(folders.map(notebookCard)))
    : emptyState({ title: 'No notebooks yet', text: 'Notebooks group related notes together.', actionHtml: add });
  return { html: `<div class="view">${viewHead({ title: 'Notebooks', actions: folders.length ? viewSwitch(style, { page: 'notebooks' }) + add : '' })}${body}</div>` };
}
