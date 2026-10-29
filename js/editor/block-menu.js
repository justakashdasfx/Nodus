/* ============================================================================
   BLOCK MENU — one menu, three doors:
     • the six-dot handle        (block-handle.js)
     • typing "/"                (slash-menu.js)
     • the "…" on the selection toolbar (selection-toolbar.js)
   The list of block types lives in js/core/config.js → blockTypes. The look is .block-menu in css/editor.css.
   Every action here is one undo step (history.js).
   ========================================================================== */

import { icon } from '../core/icons.js';
import { insertThreadBlock } from './thread-block.js';
import { insertMapBlock } from './map-block.js';
import { CONFIG } from '../core/config.js';
import { comboLabel } from '../core/keys.js';
import { escapeHtml } from '../core/utils.js';
import { snapshotCaret, caretBlock } from './normalize.js';
import { toCode, codeToParagraph } from './code-block.js';
import { setBlock } from './blocks.js';
import { insertDivider, toCallout, toToggle, unwrapToggle, toTask } from './blocks-extra.js';
import { toggleList } from './lists.js';
import { stepBlock, canStep, duplicateBlock, deleteBlock, blockKind } from './block-ops.js';

const OWN_LIST = /^(UL|OL)$/;

/** Caret at the end of the block's own text (not inside a sub-list). */
export function placeCaret(root, block) {
  root.focus({ preventScroll: true });
  const own = [...block.childNodes].filter((n) => !(n.nodeType === 1 && OWN_LIST.test(n.tagName)));
  const last = own[own.length - 1];
  const r = document.createRange();
  if (!last) r.setStart(block, 0);
  else if (last.nodeName === 'BR') r.setStartBefore(last);
  else r.setStartAfter(last);
  r.collapse(true);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
}

export const saveSel = () => {
  const s = getSelection();
  return s && s.rangeCount ? { a: s.anchorNode, ao: s.anchorOffset, f: s.focusNode, fo: s.focusOffset } : null;
};
export const restoreSel = (k) => { if (k?.a?.isConnected && k.f?.isConnected) getSelection().setBaseAndExtent(k.a, k.ao, k.f, k.fo); };

/** Changes the block's type (no undo step, no save — the caller does that). place: false keeps a text selection as it is. */
export function turnInto(root, block, kind, { place = true } = {}) {
  if (blockKind(block) === kind) return;
  if (place) placeCaret(root, block);   // the existing commands work on the block holding the caret
  if (blockKind(block) === 'code') {    // leave the code block first: it becomes a text block, then takes the new type
    block = codeToParagraph(root, block);
    if (kind === 'p') return;
  }
  if (block.tagName === 'LI' && block.hasAttribute('data-task')) { block.removeAttribute('data-task'); if (kind === 'todo') return; }   // Task → plain checklist item
  if (block.tagName === 'P' && block.hasAttribute('data-callout')) { block.removeAttribute('data-callout'); if (kind === 'p') return; } // callout → normal text first
  if (block.tagName === 'SUMMARY') { block = unwrapToggle(root, block); placeCaret(root, block); if (kind === 'p') return; }   // toggle → its title becomes text, its content stays
  if (kind === 'thread') { insertThreadBlock(root, block); return; }
  if (kind === 'map') { insertMapBlock(root, block); return; }
  if (kind === 'task') { toTask(root, block); return; }
  if (kind === 'divider') { insertDivider(root, block); return; }
  if (kind === 'toggle')  { toToggle(root, block); return; }
  if (kind === 'callout') { toCallout(root, block); return; }
  if (kind === 'code') {
    if (block.tagName === 'LI') { snapshotCaret(root); setBlock(root, 'p', false); block = caretBlock(root) || block; } // out of the list first
    toCode(root, block);
    return;
  }
  if (kind === 'ul' || kind === 'ol' || kind === 'todo') { snapshotCaret(root); toggleList(root, kind); }
  else setBlock(root, kind === 'quote' ? 'blockquote' : kind, false);
}

/* ---------- What the menu offers ---------- */

const hintFor = (key) => {
  const combo = key && CONFIG.shortcuts[key];
  return combo ? comboLabel(combo).replace('ArrowUp', '↑').replace('ArrowDown', '↓') : '';
};

/**
 * The menu for one block, as sections: [{ title?, items: [{ act, label, ic, hint, danger, disabled, current, words }] }]
 * turnOnly: just "Turn into" (+ extra) — what the selection toolbar's "…" shows.
 */
export function menuModel(block, { turnOnly = false, extra = [] } = {}) {
  const kind = blockKind(block);
  const turn = {
    title: 'Turn into',
    items: CONFIG.blockTypes.filter(([k]) => !(turnOnly && (k === 'divider' || k === 'thread' || k === 'map'))).map(([k, label, sk, words, ic]) => ({ act: 'turn:' + k, label, ic, hint: hintFor(sk), current: k === kind, words })),
  };
  if (turnOnly) return [turn, ...extra];
  const tagged = !!block.getAttribute('data-tags');
  return [
    turn,
    { items: [
      { act: 'duplicate', label: 'Duplicate', ic: 'copy', words: 'copy clone' },
      { act: 'up', label: 'Move up', ic: 'arrowUp', hint: hintFor('block.moveUp'), disabled: !canStep(block, -1), words: 'shift' },
      { act: 'down', label: 'Move down', ic: 'arrowDown', hint: hintFor('block.moveDown'), disabled: !canStep(block, 1), words: 'shift' },
      ...(tagged ? [{ act: 'untag', label: 'Remove tags', ic: 'tag-remove', words: 'untag' }] : []),
      ...(kind === 'todo' || kind === 'task' ? [{ act: 'due', label: 'Set date…', ic: 'calendar', hint: hintFor('task.due'), words: 'due deadline task' }] : []),
    ] },
    ...extra,
    { items: [{ act: 'delete', label: 'Delete', ic: 'trash', danger: true, words: 'remove' }] },
  ];
}

const itemHtml = (it) =>
  `<button type="button" role="menuitem" class="block-menu__item${it.danger ? ' is-danger' : ''}${it.current ? ' is-current' : ''}" data-act="${it.act}"${it.disabled ? ' disabled' : ''}>
     <span class="block-menu__icon">${it.ic ? icon(it.ic, 16) : ''}</span><span class="block-menu__label">${escapeHtml(it.label)}</span>${it.hint ? `<span class="block-menu__hint">${escapeHtml(it.hint)}</span>` : ''}${it.current ? `<span class="block-menu__check">${icon('check', 14)}</span>` : ''}
   </button>`;

/** Markup for the sections. filter: only items whose name or keywords contain every typed word. Returns { html, count }. */
export function renderMenu(sections, filter = '') {
  const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (it) => { const hay = `${it.label} ${it.words || ''}`.toLowerCase(); return words.every((w) => hay.includes(w)); };
  const parts = [];
  let count = 0;
  for (const sec of sections) {
    const items = sec.items.filter(hit);
    if (!items.length) continue;
    count += items.length;
    parts.push(`${sec.title ? `<div class="block-menu__title">${escapeHtml(sec.title)}</div>` : ''}${items.map(itemHtml).join('')}`);
  }
  return { html: parts.join('<div class="block-menu__sep"></div>'), count };
}

/** Puts a fixed-position menu next to a rectangle, inside the window; flips above if there is no room below. */
export function placeMenu(menu, rect, { gap = 6, side = 'below' } = {}) {
  const mr = menu.getBoundingClientRect();
  let left; let top;
  if (side === 'right') { left = rect.right + gap; top = rect.top; }
  else { left = rect.left; top = rect.bottom + gap; if (top + mr.height > innerHeight - 8 && rect.top - gap - mr.height > 8) top = rect.top - gap - mr.height; }
  menu.style.left = `${Math.max(8, Math.min(left, innerWidth - mr.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(top, innerHeight - mr.height - 8))}px`;
}

/* ---------- Doing things ---------- */

/**
 * Runs one menu action on a block as a single undo step. Returns true if it was one of ours.
 * history: from mountHistory(). place: false keeps a text selection (selection toolbar).
 */
export function runAction(root, history, act, block, { place = true } = {}) {
  const finish = (focusBlock) => {
    root.dispatchEvent(new Event('input', { bubbles: true })); // autosave + margin refresh
    if (focusBlock) placeCaret(root, focusBlock);
    history.record();
  };
  history.commit();
  if (act.startsWith('turn:')) {
    const keep = place ? null : saveSel();            // the selection toolbar: your selected text stays selected
    turnInto(root, block, act.slice(5), { place });
    if (keep) restoreSel(keep);
    finish(null);
    return true;
  }
  if (act === 'duplicate') { finish(duplicateBlock(root, block)); return true; }
  if (act === 'up' || act === 'down') {
    const sel = saveSel();
    if (stepBlock(block, act === 'up' ? -1 : 1)) { restoreSel(sel); finish(null); }
    return true;
  }
  if (act === 'due') { block.dispatchEvent(new CustomEvent('due-open', { bubbles: true, detail: { li: block } })); history.record(); return true; }
  if (act === 'untag') { block.removeAttribute('data-tags'); finish(null); return true; }
  if (act === 'delete') { finish(deleteBlock(root, block)); return true; }
  return false;
}
