/* ============================================================================
   SEARCH WINDOW (spotlight) — one window for finding things and running commands.
   Opens with Ctrl/Cmd+K, Ctrl/Cmd+P, Ctrl/Cmd+Shift+K (config.js → shortcuts) or a click on the sidebar's Search box.
   ↑ ↓ move · Enter opens · Shift+Enter opens in the side pane · Esc closes.
   The engine is js/core/search.js; the command list is config.js → commands.
   ========================================================================== */

import { CONFIG } from '../core/config.js';
import * as prefs from '../core/prefs.js';
import { search, commandsFor } from '../core/search.js';
import { matches, comboLabel } from '../core/keys.js';
import { registerActions } from '../core/actions.js';
import { go } from '../core/router.js';
import { icon } from '../core/icons.js';
import { escapeHtml, debounce } from '../core/utils.js';
import * as pane from './pane.js';

let getRoute = () => ({});
let root = null;
let input = null;
let list = null;
let items = [];
let active = 0;

const GROUPS = [['commands', 'Commands'], ['notes', 'Notes'], ['blocks', 'Blocks'], ['tags', 'Tags'], ['notebooks', 'Notebooks'], ['threads', 'Threads']];

/* ---------- Open / close ---------- */

function open() {
  if (root) { close(); return; }
  if (document.querySelector('.modal')) return;   // another dialog is open
  root = document.createElement('div');
  root.className = 'modal spot';
  root.innerHTML = `
    <div class="modal__scrim" data-spot="close"></div>
    <div class="spot__box" role="dialog" aria-modal="true" aria-label="Search">
      <div class="spot__field">${icon('search', 18)}<input class="spot__input" type="text" placeholder="${escapeHtml(CONFIG.search.placeholder)}" aria-label="Search" autocomplete="off" spellcheck="false"></div>
      <div class="spot__list" role="listbox"></div>
      <div class="spot__foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>⇧ ↵</kbd> open in side pane</span><span><kbd>Esc</kbd> close</span></div>
    </div>`;
  document.getElementById('modal-root').append(root);
  input = root.querySelector('.spot__input');
  list = root.querySelector('.spot__list');

  const repaint = debounce(() => { active = 0; paint(); }, CONFIG.search.typeDelay);
  input.addEventListener('input', repaint);
  root.addEventListener('keydown', onKey);
  root.addEventListener('click', onClick);
  list.addEventListener('mousemove', (e) => {
    const row = e.target.closest('.spot__item');
    if (row && +row.dataset.i !== active) { active = +row.dataset.i; markActive(false); }
  });
  paint();
  input.focus();
}

function close() {
  root?.remove();
  root = input = list = null;
  items = [];
}

/* ---------- Drawing ---------- */

const ICON = { note: 'note', journal: 'journal', block: 'bullets', tag: 'tag', notebook: 'folder', thread: 'threads', recent: 'clock' };

function rowHtml(it, i) {
  const ic = it.kind === 'command' ? it.icon : it.kind === 'note' && it.journal ? 'journal' : ICON[it.kind];
  const key = it.kind === 'command' && it.key ? `<kbd class="spot__key">${escapeHtml(comboLabel(CONFIG.shortcuts[it.key]))}</kbd>` : '';
  const title = it.kind === 'command' ? it.label : it.kind === 'recent' ? it.q : it.title;
  return `<div class="spot__item" role="option" data-i="${i}" id="spot-${i}">${icon(ic, 16)}<span class="spot__title">${escapeHtml(title)}</span>${it.sub ? `<span class="spot__sub">${escapeHtml(it.sub)}</span>` : ''}${key}</div>`;
}

function paint() {
  if (!root) return;
  const q = input.value;
  const ctx = { onNote: getRoute().view === 'note' };
  const groups = [];

  const found = search(q);
  if (!found) {
    const recents = prefs.getRecents();
    if (recents.length) groups.push({ title: 'Recent', clear: true, rows: recents.map(r => ({ kind: 'recent', q: r })) });
    groups.push({ title: 'Commands', rows: commandsFor(null, ctx) });
  } else {
    found.commands = commandsFor(q, ctx);
    const order = GROUPS.map(([k, title], n) => ({ title, rows: found[k] || [], n })).filter(g => g.rows.length);
    order.sort((a, b) => (b.rows[0].s || 0) - (a.rows[0].s || 0) || a.n - b.n);   // the group with the best match comes first
    groups.push(...order);
  }

  items = groups.flatMap(g => g.rows);
  let i = 0;
  list.innerHTML = items.length
    ? groups.map(g => `<div class="spot__group"><span>${g.title}</span>${g.clear ? '<button type="button" class="spot__clear" data-spot="clear">Clear</button>' : ''}</div>${g.rows.map(r => rowHtml(r, i++)).join('')}`).join('')
    : `<p class="spot__empty">Nothing found for “${escapeHtml(q.trim())}”.</p>`;
  active = Math.min(active, Math.max(items.length - 1, 0));
  markActive(true);
}

function markActive(scroll) {
  list.querySelectorAll('.spot__item.is-active').forEach(el => { el.classList.remove('is-active'); el.removeAttribute('aria-selected'); });
  const row = list.querySelector(`[data-i="${active}"]`);
  if (!row) return;
  row.classList.add('is-active');
  row.setAttribute('aria-selected', 'true');
  input.setAttribute('aria-activedescendant', row.id);
  if (scroll) row.scrollIntoView({ block: 'nearest' });
}

/* ---------- Using a result ---------- */

function runCommand({ kind, target, data }) {
  if (kind === 'go') go(target);
  else if (kind === 'event') window.dispatchEvent(new CustomEvent('app-command', { detail: target }));
  else {   // 'action': the same handler a button with data-action would reach
    const b = document.createElement('button');
    b.type = 'button';
    b.hidden = true;
    b.dataset.action = target;
    if (data) Object.assign(b.dataset, data);
    document.body.append(b);
    b.click();
    b.remove();
  }
}

function activate(i, shift) {
  const it = items[i];
  if (!it) return;
  if (it.kind === 'recent') { input.value = it.q; active = 0; paint(); input.focus(); return; }
  const q = input.value.trim();
  close();
  if (it.kind === 'command') { runCommand(it.run); return; }
  if (q) prefs.addRecent(q);
  if (it.kind === 'note') { shift ? pane.openNote(it.id) : go(`#/note/${it.id}`); }
  else if (it.kind === 'block') { shift ? pane.openNote(it.noteId, it.id) : go(`#/note/${it.noteId}/${it.id}`); }
  else if (it.kind === 'tag') { shift ? pane.openTag(it.id) : go(`#/tag/${encodeURIComponent(it.id)}`); }
  else if (it.kind === 'notebook') go(`#/notebook/${it.id}`);
  else if (it.kind === 'thread') go(`#/thread/${it.id}`);
}

/* ---------- Events ---------- */

function onKey(e) {
  if (e.isComposing) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!items.length) return;
    active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    markActive(true);
    return;
  }
  if (e.key === 'Enter') { e.preventDefault(); activate(active, e.shiftKey); }
}

function onClick(e) {
  const t = e.target.closest('[data-spot]');
  if (t?.dataset.spot === 'close') { close(); return; }
  if (t?.dataset.spot === 'clear') { prefs.clearRecents(); paint(); input.focus(); return; }
  const row = e.target.closest('.spot__item');
  if (row) activate(+row.dataset.i, e.shiftKey);
}

/* ---------- Start ---------- */

export function initSearch({ route }) {
  getRoute = route;
  registerActions({ 'search-open': () => open() });
  document.addEventListener('keydown', (e) => {
    if (e.repeat || !CONFIG.search.shortcuts.some(name => matches(e, CONFIG.shortcuts[name]))) return;
    e.preventDefault();      // the browser's own Print / address-bar search stays out of the way
    e.stopPropagation();
    open();
  }, true);
}
