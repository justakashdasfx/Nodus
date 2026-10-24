/* ============================================================================
   BLOCK OPS — moving, duplicating and deleting blocks (the actions behind the six-dot handle).

   A block is a paragraph, heading, quote or list item. A list item travels with its sub-items.
   • A paragraph / heading / quote can go between any two top-level blocks (a whole list counts as one).
   • A list item can go next to any other list item (also in another list), or between top-level blocks,
     where it becomes a list of its own.
   Ids and tags travel with the block. A duplicate gets new ids and no tags.
   These functions only change the DOM; block-handle.js wraps them with undo, saving and the caret.
   ========================================================================== */

import { BID_RE } from '../core/utils.js';
import { BLOCK_SEL } from '../core/blockindex.js';

/** A toggle's title moves, copies and goes as one with its whole toggle. */
const unit = (el) => (el?.tagName === 'SUMMARY' ? el.parentElement : el);

export const isList = (el) => !!el && /^(UL|OL)$/.test(el.tagName);
const newId = () => 'b' + (Math.random().toString(36) + '00000000').slice(2, 10);

export function idFactory(root) {
  const used = new Set([...root.querySelectorAll('[data-bid]')].map((e) => e.getAttribute('data-bid')));
  return () => { let id; do { id = newId(); } while (used.has(id)); used.add(id); return id; };
}

/** 'p' | 'h1'…'h4' | 'quote' | 'ul' | 'ol' | 'todo' — what the block is right now. */
export function blockKind(el) {
  if (el.tagName === 'SUMMARY') return 'toggle';
  if (el.tagName === 'P' && el.hasAttribute('data-callout')) return 'callout';
  if (el.tagName === 'LI') {
    const list = el.parentElement;
    if (list.dataset.type === 'todo') return 'todo';
    return list.tagName === 'OL' ? 'ol' : 'ul';
  }
  if (/^H[1-4]$/.test(el.tagName)) return el.tagName.toLowerCase();
  if (el.tagName === 'PRE') return 'code';
  return el.tagName === 'BLOCKQUOTE' ? 'quote' : 'p';
}

/** A list item takes on the type of the list it lands in (checklist items carry data-check). */
function adopt(li, list) {
  if (list.dataset.type === 'todo') { if (!li.hasAttribute('data-check')) li.setAttribute('data-check', 'false'); }
  else li.removeAttribute('data-check');
}

function pruneEmpty(list) {
  if (list && isList(list) && !list.querySelector('li')) list.remove();
}

/** Puts `el` before / after `ref`. Returns false if that is not allowed or changes nothing. */
export function placeBlock(root, el, ref, where) {
  el = unit(el); ref = unit(ref);
  if (!ref || ref === el || el.contains(ref)) return false;
  const put = (node) => (where === 'before' ? ref.before(node) : ref.after(node));

  if (el.tagName === 'LI') {
    const from = el.parentElement;
    if (ref.tagName === 'LI') {
      put(el);
      adopt(el, ref.parentElement);
    } else {
      const own = document.createElement(from.tagName.toLowerCase());
      if (from.dataset.type) own.setAttribute('data-type', from.dataset.type);
      own.append(el);
      put(own);
    }
    pruneEmpty(from);
    return true;
  }
  if (ref.parentElement !== root) return false;
  put(el);
  return true;
}

/** Can the block move one step up (-1) / down (+1) among its siblings? */
export function canStep(el, dir) {
  el = unit(el);
  const sib = dir < 0 ? el.previousElementSibling : el.nextElementSibling;
  return !!sib && sib.tagName !== 'SUMMARY' && (el.tagName === 'LI') === (sib.tagName === 'LI');
}

/** One step up (-1) or down (+1) among its siblings. */
export function stepBlock(el, dir) {
  el = unit(el);
  const sib = dir < 0 ? el.previousElementSibling : el.nextElementSibling;
  if (!sib || sib.tagName === 'SUMMARY' || (el.tagName === 'LI') !== (sib.tagName === 'LI')) return false;
  if (dir < 0) sib.before(el); else sib.after(el);
  return true;
}

/** Copy right after the original, with new ids (also for sub-items) and no tags. Returns the copy. */
export function duplicateBlock(root, el) {
  el = unit(el);
  const makeId = idFactory(root);
  const copy = el.cloneNode(true);
  for (const b of [copy, ...copy.querySelectorAll('li')]) {
    if (b.hasAttribute('data-bid') || b === copy) b.setAttribute('data-bid', makeId());
    b.removeAttribute('data-tags');
    b.classList.remove('is-active', 'is-dragging', 'is-target');
  }
  el.after(copy);
  return copy;
}

/** Removes the block (a list item with its sub-items). Returns a neighbouring block for the caret. */
export function deleteBlock(root, el) {
  el = unit(el);
  const all = [...root.querySelectorAll(BLOCK_SEL)];
  const i = all.indexOf(el);
  const around = all.filter((b) => b !== el && !el.contains(b));
  const near = all.slice(0, i).reverse().find((b) => around.includes(b)) || all.slice(i + 1).find((b) => around.includes(b)) || null;
  const list = el.tagName === 'LI' ? el.parentElement : null;
  el.remove();
  pruneEmpty(list);
  if (!root.children.length) {
    const p = document.createElement('p');
    p.setAttribute('data-bid', idFactory(root)());
    p.innerHTML = '<br>';
    root.append(p);
    return p;
  }
  return near && near.isConnected ? near : root.firstElementChild;
}

/** Candidate neighbours when dragging `el`, in document order. */
export function dropTargets(root, el) {
  const out = [];
  if (el.tagName === 'LI') {
    for (const c of root.querySelectorAll(BLOCK_SEL)) {
      if (c !== el && !el.contains(c)) out.push(c);
    }
  } else {
    for (const c of root.children) if (c !== el && c.nodeType === 1) out.push(c);
  }
  return out;
}

export { BID_RE };
