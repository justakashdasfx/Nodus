/* ============================================================================
   POP-UP MENUS of the top bar:
     • the ⋯ button  — Theme (Light | Dark) · Font of this note (Sans | Mono | Serif) · Download all · As text ·
                       Copy / Export as Markdown · Move to Trash (or Restore / Delete forever) · About
     • the notebook picker — Inbox and every notebook; the current one is ticked.
   The notebook picker has a search box: type to filter, Enter picks the first match.
   The Light | Dark and Sans | Mono | Serif choices sit side by side like the Write | Read switch and the menu
   stays open so you see the highlight move. Everything else closes the menu.
   Items are ordinary data-action buttons, so app.js handles them like any other click.
   Look: the same .block-menu as the six-dot menu (css/editor.css); the side-by-side rows are .menu-row.
   ========================================================================== */

import { icon } from '../core/icons.js';
import { CONFIG } from '../core/config.js';
import * as store from '../core/store.js';
import { getTheme } from '../core/settings.js';
import { registerActions } from '../core/actions.js';
import { escapeHtml } from '../core/utils.js';
import { noteState } from './note-meta.js';
import { THEMES, LINES, LAYOUTS } from '../maps/config.js';

let menu = null;
let anchor = null;
let build = () => '';
let getRoute = () => ({});

const dataAttrs = (data) => Object.entries(data).map(([k, v]) => ` data-${k}="${escapeHtml(v)}"`).join('');

const item = ({ action, ic, label, data = {}, current = false, danger = false, tick = false }) =>
  `<button type="button" role="menuitem" class="block-menu__item${danger ? ' is-danger' : ''}${current ? ' is-current' : ''}" data-action="${action}"${dataAttrs(data)}>`
  + `<span class="block-menu__icon">${ic ? icon(ic, 16) : (current && !tick ? '✓' : '')}</span><span class="block-menu__label">${escapeHtml(label)}</span>`
  + `${tick && current ? '<span class="block-menu__hint">✓</span>' : ''}</button>`;

/** A row with a label on the left and side-by-side choices on the right (like Write | Read). */
const choiceRow = (label, buttons) =>
  `<div class="menu-row"><span class="menu-row__label">${escapeHtml(label)}</span><div class="seg" role="group" aria-label="${escapeHtml(label)}">`
  + buttons.map(({ text, on, action, data }) =>
    `<button type="button" class="seg__btn${on ? ' is-on' : ''}" data-action="${action}"${dataAttrs(data)} aria-pressed="${on}">${escapeHtml(text)}</button>`).join('')
  + '</div></div>';

/* ---------- Content ---------- */

function moreHtml() {
  const route = getRoute();
  const note = route.view === 'note' || route.view === 'map' ? store.getNote(route.id) : null;
  const isMap = note?.type === 'map';
  const theme = getTheme();
  const parts = [choiceRow('Theme', [
    { text: 'Light', on: theme === 'light', action: 'theme-set', data: { theme: 'light' } },
    { text: 'Dark', on: theme === 'dark', action: 'theme-set', data: { theme: 'dark' } },
  ])];

  if (isMap) {   // how this map looks (more of these move to the map's own side bar later)
    const m = note.map || {};
    const row = (label, key, list) => choiceRow(label, list.map(([value, text]) => ({ text, on: (m[key] || list[0][0]) === value, action: 'map-set', data: { id: note.id, key, value } })));
    parts.push(row('Map theme', 'theme', THEMES), row('Lines', 'line', LINES), row('Layout', 'layout', LAYOUTS));
  }

  if (note && !isMap) {
    const font = note.font === 'mono' || note.font === 'serif' ? note.font : 'sans';
    parts.push(choiceRow('Font', ['sans', 'mono', 'serif'].map(f => ({
      text: f[0].toUpperCase() + f.slice(1), on: font === f, action: 'note-font', data: { id: note.id, font: f },
    }))));
  }

  if (note && !note.deletedAt) parts.push('<div class="block-menu__sep"></div>', item({ action: 'note-pin', ic: 'pin', label: note.pinned ? 'Unpin from sidebar' : 'Pin to sidebar', data: { id: note.id } }));
  parts.push('<div class="block-menu__sep"></div>', item({ action: 'download-all', ic: 'download', label: 'Download all' }));
  if (note) {
    if (!isMap) parts.push(
      item({ action: 'download-text', ic: 'fileDown', label: 'Download as text' }),
      item({ action: 'copy-markdown', ic: 'copy', label: 'Copy as Markdown' }),
      item({ action: 'export-markdown', ic: 'filemd', label: 'Export as Markdown (.md)' }),
      ...(note.deletedAt ? [] : [item({ action: 'template-save', ic: 'copy', label: 'Save as template', data: { id: note.id } })]),
    );
    parts.push('<div class="block-menu__sep"></div>');
    const { folder, folderTrashed } = noteState(note);
    if (note.deletedAt) {
      parts.push(
        item({ action: 'note-restore', ic: 'restore', label: 'Restore', data: { id: note.id } }),
        item({ action: 'note-delete', ic: 'close', label: 'Delete forever', danger: true, data: { id: note.id } }),
      );
    } else if (folderTrashed) {
      parts.push(item({ action: 'notebook-restore', ic: 'restore', label: 'Restore notebook', data: { id: folder.id } }));
    } else {
      parts.push(item({ action: 'note-trash', ic: 'trash', label: 'Move to Trash', danger: true, data: { id: note.id } }));
    }
  }
  parts.push('<div class="block-menu__sep"></div>', item({ action: 'about-open', ic: 'info', label: `About ${CONFIG.appName}` }));
  return parts.join('');
}

function notebookHtml(noteId) {
  const note = store.getNote(noteId);
  if (!note) return '';
  const rows = [{ id: '', name: 'Inbox', ic: 'inbox' }, ...store.folders().map(f => ({ id: f.id, name: f.name, ic: 'folder' }))];
  return '<div class="menu-search"><input type="text" class="menu-search__input" placeholder="Search notebooks" aria-label="Search notebooks" autocomplete="off" spellcheck="false"></div>'
    + '<div class="block-menu__title">Move to</div>'
    + rows.map(r => item({ action: 'note-move-to', ic: r.ic, label: r.name, current: (note.folderId || '') === r.id, tick: true, data: { id: noteId, folder: r.id } })).join('')
    + '<p class="block-menu__empty" hidden>No notebooks found</p>';
}

/* ---------- Open / close ---------- */

export function closeMenu() {
  if (!menu) return;
  menu.remove();
  menu = null;
  anchor?.setAttribute('aria-expanded', 'false');
  document.removeEventListener('pointerdown', onOutside, true);
  document.removeEventListener('keydown', onKey, true);
  window.removeEventListener('resize', closeMenu);
}

const onOutside = (e) => { if (menu && !menu.contains(e.target) && !anchor?.contains(e.target)) closeMenu(); };
const onKey = (e) => {
  if (!menu) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); anchor?.focus(); return; }
  const input = menu.querySelector('.menu-search__input');
  const items = [...(input ? [input] : []), ...menu.querySelectorAll('.block-menu__item:not([hidden]), .seg__btn')];
  const i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
};

/** align: 'right' lines the menu's right edge up with the button; 'left' its left edge. */
function openMenu(button, builder, { className = '', align = 'right' } = {}) {
  closeMenu();
  anchor = button;
  build = builder;
  menu = document.createElement('div');
  menu.className = `block-menu ${className}`.trim();
  menu.setAttribute('role', 'menu');
  menu.innerHTML = build();
  document.body.append(menu);
  const r = button.getBoundingClientRect();
  const left = align === 'right' ? r.right - menu.offsetWidth : r.left;
  menu.style.top = `${r.bottom + 6}px`;
  menu.style.left = `${Math.max(8, Math.min(left, innerWidth - menu.offsetWidth - 8))}px`;
  button.setAttribute('aria-expanded', 'true');
  menu.addEventListener('click', (e) => {
    if (e.target.closest('.seg__btn')) setTimeout(() => { if (menu) menu.innerHTML = build(); }, 0); // stay open; show the new highlight
    else if (e.target.closest('.block-menu__item')) setTimeout(closeMenu, 0);                        // after the action ran
  });
  document.addEventListener('pointerdown', onOutside, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', closeMenu);
  const search = menu.querySelector('.menu-search__input');
  if (search) {                                   // the notebook picker: type to filter, Enter picks the first match
    const empty = menu.querySelector('.block-menu__empty');
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      menu.querySelectorAll('.block-menu__item').forEach((it) => {
        const hit = !q || it.textContent.toLowerCase().includes(q);
        it.hidden = !hit;
        if (hit) shown += 1;
      });
      if (empty) empty.hidden = shown > 0;
    });
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); menu.querySelector('.block-menu__item:not([hidden])')?.click(); }
    });
  }
  (search || menu.querySelector('.is-current') || menu.querySelector('.block-menu__item, .seg__btn'))?.focus();
}

export function initMoreMenu({ route }) {
  getRoute = route;
  registerActions({
    'more-menu': (el) => (menu && anchor === el ? closeMenu() : openMenu(el, moreHtml)),
    'notebook-menu': (el) => (menu && anchor === el ? closeMenu() : openMenu(el, () => notebookHtml(el.dataset.id), { className: 'notebook-menu', align: 'left' })),
  });
}
