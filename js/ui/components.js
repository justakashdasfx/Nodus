/* ============================================================================
   COMPONENTS — small HTML-string builders shared by the views.
   Class names map 1:1 to css/components.css and css/gallery.css.
   ========================================================================== */

import { CONFIG } from '../core/config.js';
import { icon } from '../core/icons.js';
import * as store from '../core/store.js';
import { escapeHtml, formatDate, sanitizeHtml } from '../core/utils.js';
import { emptyArt } from './empty-art.js';

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

export const caretHtml = `<span class="lrow__caret">${icon('caret', 16)}</span>`;
export const countText = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** The List view of notes: note icon · full name ............ notebook · date. */
export function noteList(notes) {
  return `<div class="list">${notes.map((n) => {
    const folder = n.folderId ? store.getFolder(n.folderId) : null;
    return `<a class="lrow lrow--note" href="#/note/${n.id}">
      <span class="lrow__lead">${icon('note', 20)}</span>
      <span class="lrow__main">
        <span class="lrow__title">${escapeHtml(n.title || 'Untitled')}</span></span>
      <span class="lrow__meta">${folder ? `<span class="row__where">${icon('folder', 12)}${escapeHtml(folder.name)}</span>` : ''}<span>${formatDate(n.updatedAt)}</span></span>
    </a>`;
  }).join('')}</div>`;
}

/** The List view of notebooks (Linear-style): icon tile · name / note count / description ............ caret. */
export function notebookList(folders) {
  return `<div class="list">${folders.map((f) => {
    const count = store.noteCount(f.id);
    return `<a class="lrow lrow--notebook" href="#/notebook/${f.id}">
      <span class="lrow__tile">${icon('folder', 22)}</span>
      <span class="lrow__main">
        <span class="lrow__title">${escapeHtml(f.name)}</span>
      </span>
       <span class="lrow__sub">${icon('note', 14)}${countText(count, 'note', 'notes')}</span>
      ${caretHtml}
    </a>`;
  }).join('')}</div>`;
}

export function emptyState({ title, text = '', actionHtml = '', art = '' }) {
  return `<div class="empty">${art ? `<div class="empty__art">${emptyArt(art)}</div>` : ''}<p class="empty__title">${escapeHtml(title)}</p>${text ? `<p class="empty__text">${escapeHtml(text)}</p>` : ''}${actionHtml}</div>`;
}

/** The note's body without its title line, trimmed to a few blocks for the card preview.
    The title is the note's first line of text (see deriveTitle), whatever kind of block it is. */
function previewHtml(note) {
  const doc = new DOMParser().parseFromString(`<body>${sanitizeHtml(note.html)}</body>`, 'text/html');
  const blocks = [...doc.body.children];
  const hasText = (el) => !!el.textContent.trim();
  const hasMedia = (el) => !!el.querySelector('img, table, svg, video');

  // drop everything up to and including the block that holds the title (this also drops empty blocks above it)
  const titleAt = blocks.findIndex(hasText);
  if (titleAt >= 0) blocks.splice(0, titleAt + 1);

  // start the preview with real content: no leading dividers or empty blocks
  while (blocks.length && (blocks[0].tagName === 'HR' || (!hasText(blocks[0]) && !hasMedia(blocks[0])))) blocks.shift();

  return blocks.slice(0, CONFIG.gallery.previewMaxBlocks).map((el) => el.outerHTML).join('');
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

/** Notebook gallery card: description + latest notes on top, icon · name · count · date below. Same 210px as a note card. */
export function notebookCard(folder) {
  const notes = store.notesInFolder(folder.id);
  const latest = [...notes].sort((x, y) => y.updatedAt - x.updatedAt);
  const peek = latest.slice(0, 4).map(n => `<span class="g-card__peek-note">${icon('note', 12)}<span>${escapeHtml(n.title || 'Untitled')}</span></span>`).join('');
  const updated = latest[0] ? ` · ${formatDate(latest[0].updatedAt)}` : '';
  return `<a class="g-card g-card--notebook" href="#/notebook/${folder.id}">
    <div class="g-card__peek">
      ${folder.description ? `<span class="g-card__peek-desc">${escapeHtml(folder.description)}</span>` : ''}
      ${peek || (folder.description ? '' : '<span class="g-card__empty">No notes yet</span>')}
    </div>
    <div class="g-card__meta">
      <span class="g-card__titlerow">${icon('folder', 16)}<span class="g-card__title">${escapeHtml(folder.name)}</span></span>
      <span class="g-card__sub"><span>${countText(notes.length, 'note', 'notes')}${updated}</span></span>
    </div>
  </a>`;
}
