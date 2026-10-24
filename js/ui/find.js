/* ============================================================================
   FIND IN NOTE — Ctrl/Cmd+F opens a small bar at the top-right of the page.
     • Every match is highlighted (css/editor.css → ::highlight(find), the current one ::highlight(find-current)).
     • Enter / Shift+Enter (or the arrows) jump to the next / previous match, with a count. Esc closes.
     • The ▸ button opens Replace: "Replace" changes the current match, "All" changes every match (one undo step each).
     • It searches the note you are working in (the page, or the side pane if that is where your cursor is).
   Colours: --find-bg and --find-current-bg in css/tokens.css (section 9). The shortcut: config.js → shortcuts['find.open'].
   ========================================================================== */

import { icon } from '../core/icons.js';
import { focusedEditor } from '../editor/editor.js';

const BLOCK = 'li, p, h1, h2, h3, h4, blockquote, pre, div';
let bar = null;
let root = null;
let matches = [];
let index = -1;
let timer = 0;

const supported = () => typeof CSS !== 'undefined' && !!CSS.highlights && typeof Highlight !== 'undefined';
const currentRoot = () => focusedEditor() || document.querySelector('#view .editor') || document.querySelector('.pane .editor');

/* ---------- Searching ---------- */

function locate(spans, pos, isStart) {
  for (const sp of spans) {
    const len = sp.n.data.length;
    if (isStart ? pos < sp.start + len : pos <= sp.start + len) return { n: sp.n, off: pos - sp.start };
  }
  const last = spans[spans.length - 1];
  return { n: last.n, off: last.n.data.length };
}

function collect(editor, query) {
  const out = [];
  if (!query) return out;
  const needle = query.toLowerCase();
  const groups = new Map();            // block → its text nodes (so a match never runs from one block into the next)
  const w = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const b = n.parentElement?.closest(BLOCK);
    if (!b || b === editor) continue;
    if (!groups.has(b)) groups.set(b, []);
    groups.get(b).push(n);
  }
  groups.forEach((nodes) => {
    let text = '';
    const spans = nodes.map((n) => { const s = { n, start: text.length }; text += n.data; return s; });
    const hay = text.toLowerCase();
    for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length)) {
      const a = locate(spans, i, true);
      const b = locate(spans, i + needle.length, false);
      const r = document.createRange();
      r.setStart(a.n, a.off);
      r.setEnd(b.n, b.off);
      out.push(r);
    }
  });
  return out;
}

function paint() {
  if (supported()) {
    if (matches.length) CSS.highlights.set('find', new Highlight(...matches)); else CSS.highlights.delete('find');
    if (matches[index]) CSS.highlights.set('find-current', new Highlight(matches[index])); else CSS.highlights.delete('find-current');
  }
  const count = bar?.querySelector('.find-bar__count');
  if (count) count.textContent = !input().value ? '' : matches.length ? `${index + 1} / ${matches.length}` : 'No results';
}

function reveal() {
  const r = matches[index];
  if (!r) return;
  const rect = r.getBoundingClientRect();
  const scroller = (r.startContainer.parentElement || root)?.closest('.pane__scroll, .card__scroll');
  if (!scroller) return;
  const s = scroller.getBoundingClientRect();
  if (rect.top < s.top + 60 || rect.bottom > s.bottom - 60) scroller.scrollTop += (rect.top - s.top) - s.height / 2;
}

const input = () => bar.querySelector('.find-bar__input:not([data-replace])');

function search(keep = false) {
  if (!root?.isConnected) { closeFind(); return; }
  const prev = index;
  matches = collect(root, input().value);
  index = matches.length ? (keep ? Math.min(Math.max(prev, 0), matches.length - 1) : 0) : -1;
  paint();
  reveal();
}

function step(dir) {
  if (!matches.length) return;
  index = (index + dir + matches.length) % matches.length;
  paint();
  reveal();
}

/* ---------- Replace ---------- */

function replaceAt(i, text) {
  const r = matches[i];
  if (!r || !root.isConnected) return;
  const sel = getSelection();
  root.focus({ preventScroll: true });
  sel.removeAllRanges();
  sel.addRange(r);
  document.execCommand('insertText', false, text); // a normal edit: it saves, and Ctrl+Z undoes it
}

function replaceCurrent() {
  const text = bar.querySelector('[data-replace]').value;
  if (index < 0) return;
  replaceAt(index, text);
  search(true);
  input().focus();
}

function replaceAll() {
  const text = bar.querySelector('[data-replace]').value;
  for (let i = matches.length - 1; i >= 0; i--) replaceAt(i, text); // from the end, so earlier matches keep their place
  search();
  input().focus();
}

/* ---------- Open / close ---------- */

export function closeFind() {
  clearTimeout(timer);
  if (supported()) { CSS.highlights.delete('find'); CSS.highlights.delete('find-current'); }
  root?.removeEventListener('input', onEditorInput);
  bar?.remove();
  bar = null;
  matches = [];
  index = -1;
}

function onEditorInput() { clearTimeout(timer); timer = setTimeout(() => search(true), 200); }

export function openFind() {
  const editor = currentRoot();
  if (!editor) return;
  if (bar && root === editor) { input().focus(); input().select(); return; }
  closeFind();
  root = editor;
  const editable = root.isContentEditable;
  const picked = getSelection().toString();

  bar = document.createElement('div');
  bar.className = 'find-bar';
  bar.setAttribute('role', 'search');
  bar.innerHTML = `
    <div class="find-bar__row">
      ${editable ? `<button type="button" class="find-bar__btn find-bar__toggle" data-find="toggle" title="Replace" aria-expanded="false">${icon('caret', 12)}</button>` : ''}
      <input class="find-bar__input" type="text" placeholder="Find in note" aria-label="Find in note" autocomplete="off" spellcheck="false">
      <span class="find-bar__count" aria-live="polite"></span>
      <button type="button" class="find-bar__btn" data-find="prev" title="Previous (Shift+Enter)" aria-label="Previous match">${icon('arrowUp', 14)}</button>
      <button type="button" class="find-bar__btn" data-find="next" title="Next (Enter)" aria-label="Next match">${icon('arrowDown', 14)}</button>
      <button type="button" class="find-bar__btn" data-find="close" title="Close (Esc)" aria-label="Close find">${icon('close', 14)}</button>
    </div>
    ${editable ? `<div class="find-bar__row find-bar__replace" hidden>
      <input class="find-bar__input" data-replace type="text" placeholder="Replace with" aria-label="Replace with" autocomplete="off" spellcheck="false">
      <button type="button" class="find-bar__btn find-bar__text" data-find="replace">Replace</button>
      <button type="button" class="find-bar__btn find-bar__text" data-find="replace-all">All</button>
    </div>` : ''}`;
  document.body.append(bar);

  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-find]');
    if (!b) return;
    const act = b.dataset.find;
    if (act === 'next') step(1);
    else if (act === 'prev') step(-1);
    else if (act === 'close') { const r = root; closeFind(); r?.focus({ preventScroll: true }); }
    else if (act === 'replace') replaceCurrent();
    else if (act === 'replace-all') replaceAll();
    else if (act === 'toggle') {
      const row = bar.querySelector('.find-bar__replace');
      row.hidden = !row.hidden;
      b.setAttribute('aria-expanded', String(!row.hidden));
      (row.hidden ? input() : row.querySelector('input')).focus();
    }
  });
  bar.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); const r = root; closeFind(); r?.focus({ preventScroll: true }); }
    else if (e.key === 'Enter') { e.preventDefault(); if (e.target.matches('[data-replace]')) replaceCurrent(); else step(e.shiftKey ? -1 : 1); }
  });
  input().addEventListener('input', () => search());
  root.addEventListener('input', onEditorInput);

  if (picked && picked.length < 80 && !picked.includes('\n')) input().value = picked;
  input().focus();
  input().select();
  search();
}
