/* ============================================================================
   COMPONENTS — small HTML-string builders shared by the views.
   Class names map 1:1 to css/components.css and css/gallery.css.
   ========================================================================== */

import { CONFIG } from '../core/config.js';
import { icon } from '../core/icons.js';
import * as store from '../core/store.js';
import { escapeHtml, formatDate, sanitizeHtml } from '../core/utils.js';

/** A toolbar-style button: icon + text label. */
export function button({ action, iconName, label, variant = '', data = {}, title = '' }) {
  const attrs = Object.entries(data).map(([k, v]) => `data-${k}="${escapeHtml(v)}"`).join(' ');
  return `<button type="button" class="btn ${variant}" data-action="${action}" ${attrs}${title ? ` title="${escapeHtml(title)}"` : ''}>`
    + `${iconName ? icon(iconName) : ''}${label ? `<span class="btn__label">${escapeHtml(label)}</span>` : ''}</button>`;
}

/** Page header inside the card: title (+ optional subtitle / description HTML) on the left, actions on the right. */
export function viewHead({ title, titleStyle = '', subtitle = '', description = '', actions = '' }) {
  return `<header class="view-head">
    <div><h1 class="view-head__title"${titleStyle ? ` style="${titleStyle}"` : ''}>${escapeHtml(title)}</h1>${subtitle ? `<p class="view-head__sub">${escapeHtml(subtitle)}</p>` : ''}${description}</div>
    <div class="view-head__actions">${actions}</div>
  </header>`;
}

export const gallery = (cards) => `<div class="gallery">${cards.join('')}</div>`;

/** Gallery | List switch for a page header. page = where it is remembered; id = a notebook (its choice lives on the notebook). */
export function viewSwitch(style, { page = '', id = '' } = {}) {
  const btn = (s, ic, label) => `<button type="button" class="seg__btn ${style === s ? 'is-on' : ''}" data-action="view-style" data-style="${s}" data-page="${page}"${id ? ` data-id="${id}"` : ''} aria-pressed="${style === s}" title="${label} view" aria-label="${label} view">${icon(ic, 16)}</button>`;
  return `<div class="seg seg--plain seg--view" role="group" aria-label="View style">${btn('gallery', 'notebooks', 'Gallery')}${btn('list', 'bullets', 'List')}</div>`;
}

const snippetOf = (n) => (n.blocks || []).slice(1).map(b => b.text).filter(Boolean).join(' ').slice(0, 160);

/** The List view of notes: title · a line of text · notebook and date. */
export function noteList(notes) {
  return `<div class="list">${notes.map((n) => {
    const folder = n.folderId ? store.getFolder(n.folderId) : null;
    return `<a class="row" href="#/note/${n.id}">
      <span class="row__title">${escapeHtml(n.title || 'Untitled')}</span>
      <span class="row__text">${escapeHtml(snippetOf(n))}</span>
      <span class="row__meta">${folder ? `<span class="row__where">${icon('folder', 12)}${escapeHtml(folder.name)}</span>` : ''}<span>${formatDate(n.updatedAt)}</span></span>
    </a>`;
  }).join('')}</div>`;
}

/** The List view of notebooks. */
export function notebookList(folders) {
  return `<div class="list">${folders.map((f) => {
    const count = store.noteCount(f.id);
    return `<a class="row" href="#/notebook/${f.id}">
      <span class="row__title row__title--icon">${icon('folder', 16)}${escapeHtml(f.name)}</span>
      <span class="row__text">${escapeHtml(f.description || '')}</span>
      <span class="row__meta"><span>${count} ${count === 1 ? 'note' : 'notes'}</span></span>
    </a>`;
  }).join('')}</div>`;
}

export function emptyState({ title, text = '', actionHtml = '' }) {
  return `<div class="empty"><p class="empty__title">${escapeHtml(title)}</p>${text ? `<p class="empty__text">${escapeHtml(text)}</p>` : ''}${actionHtml}</div>`;
}

/** The note's body without its title line, trimmed to a few blocks for the card preview. */
function previewHtml(note) {
  const doc = new DOMParser().parseFromString(`<body>${sanitizeHtml(note.html)}</body>`, 'text/html');
  const first = doc.body.firstElementChild;
  if (first && /^H[1-4]$/.test(first.tagName)) first.remove();
  return [...doc.body.children].slice(0, CONFIG.gallery.previewMaxBlocks).map(el => el.outerHTML).join('');
}

/** Notion-style gallery card: a glimpse of the page, then title and date. */
export function noteCard(note) {
  const folder = note.folderId ? store.getFolder(note.folderId) : null;
  const preview = previewHtml(note);
  return `<a class="g-card" href="#/note/${note.id}">
    <div class="g-card__preview prose prose--mini">${preview || '<span class="g-card__empty">No content yet</span>'}</div>
    <div class="g-card__meta">
      <span class="g-card__title">${escapeHtml(note.title || 'Untitled')}</span>
      <span class="g-card__sub"><span>${formatDate(note.updatedAt)}</span>${folder ? `<span class="g-card__folder">${icon('folder', 12)}${escapeHtml(folder.name)}</span>` : ''}</span>
    </div>
  </a>`;
}

export function notebookCard(folder) {
  const count = store.noteCount(folder.id);
  return `<a class="g-card g-card--notebook" href="#/notebook/${folder.id}">
    <div class="g-card__glyph">${icon('folder', 28)}</div>
    <div class="g-card__meta">
      <span class="g-card__title">${escapeHtml(folder.name)}</span>
      ${folder.description ? `<span class="g-card__desc">${escapeHtml(folder.description)}</span>` : ''}
      <span class="g-card__sub"><span>${count} ${count === 1 ? 'note' : 'notes'}</span></span>
    </div>
  </a>`;
}
