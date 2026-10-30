/* FOLDER — the notebooks inside one folder (a "collection"), as cards or a list.
   The title is an input: click it to rename the folder. Under the title a link goes back up (Notebooks, or the folder around this one).
   Drag notebooks in from the sidebar or the Notebooks page; drag one out onto "Notebooks" in the sidebar. Menu: ⋯ (js/ui/item-menu.js). */
import * as store from '../core/store.js';
import * as settings from '../core/settings.js';
import { escapeHtml } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { button, gallery, notebookCard, notebookList, viewSwitch, emptyState, moreBtn } from '../ui/components.js';

const notFound = () => ({ html: `<div class="view">${emptyState({
  title: 'Folder not found', text: 'It may have been deleted.', art: 'notfound',
  actionHtml: '<a class="btn button" href="#/notebooks"><span class="btn__label">Back to notebooks</span></a>' })}</div>` });

export function render({ id }) {
  const folder = store.getFolder(id);
  if (!folder || !store.isCollection(folder) || folder.deletedAt) return notFound();

  const items = store.childrenOf(id);
  const style = settings.getViewStyle('collection');
  const parent = store.parentFolder(id);
  const up = parent ? { href: `#/collection/${parent.id}`, name: parent.name } : { href: '#/notebooks', name: 'Notebooks' };
  const add = button({ action: 'notebook-new', iconName: 'plus', label: 'New notebook', variant: 'button', data: { parent: id } });
  const body = items.length
    ? (style === 'list' ? notebookList(items) : gallery(items.map(notebookCard)))
    : emptyState({ title: 'This folder is empty', text: 'Add a notebook here, or drag notebooks into this folder.', art: 'notebooks', actionHtml: add });
  const actions = (items.length ? viewSwitch(style, { page: 'collection' }) + add : '') + moreBtn('folder', id).replace('class="item-more"', 'class="btn btn--icon"');

  return {
    html: `<div class="view" data-into="${id}">
      <header class="view-head">
        <div class="view-head__main">
          <a class="crumb" href="${up.href}">${icon('arrowLeft', 14)}<span>${escapeHtml(up.name)}</span></a>
          <input class="coll__title" type="text" value="${escapeHtml(folder.name)}" maxlength="80" spellcheck="false" aria-label="Folder name" autocomplete="off">
        </div>
        <div class="view-head__actions">${actions}</div>
      </header>${body}</div>`,
    mount(el) {
      const input = el.querySelector('.coll__title');
      if (!input) return null;
      let cancelled = false;
      const commit = () => {
        const name = input.value.trim();
        if (!cancelled && name && name !== folder.name) store.renameFolder(id, name);
        else input.value = folder.name;
      };
      const onKey = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        else if (e.key === 'Escape') { cancelled = true; input.blur(); }
      };
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', onKey);
      return () => { input.removeEventListener('blur', commit); input.removeEventListener('keydown', onKey); };
    },
  };
}
