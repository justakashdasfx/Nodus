/* ============================================================================
   NORMALIZE — keeps the editor's blocks flat, valid and identified.

   Runs after every edit (js/editor/editor.js wires it up):
   • Loose text / stray <div> at the top level → proper <p> blocks.
   • Every block (paragraph, heading, quote, list item) has a unique data-bid.
   • Enter: the browser copies the old block's attributes onto the new one. The NEW
     block gets a fresh id and no tags; the original keeps its id and tags.
     (Enter at the very start of a block creates the empty block above and keeps the id on the text.)
   • Changing a block's type (paragraph → heading → bullet …) makes the browser build a new element;
     the id and tags of the block you were in move over to it.
   Shift+Enter only adds a line break inside the block, so it never creates a block or an id.
   ========================================================================== */

import { BID_RE } from '../core/utils.js';
import { CONFIG } from '../core/config.js';
import { blocksOf, ownText } from '../core/blockindex.js';
import { tidyBlocks } from './lists.js';

const newId = () => 'b' + (Math.random().toString(36) + '00000000').slice(2, 10);
const validId = (el) => BID_RE.test(el.getAttribute('data-bid') || '');
const isEmpty = (el) => !ownText(el);

/** The block (list item, paragraph, heading, quote) that holds the caret. */
export function caretBlock(root) {
  const sel = getSelection();
  if (!sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  let node = range.startContainer;
  if (node === root) node = root.childNodes[range.startOffset] || root.lastChild;
  const el = node && (node.nodeType === 1 ? node : node.parentElement);
  const block = el && el.closest('li, p, h1, h2, h3, h4, blockquote, div');
  return block && block !== root && root.contains(block) ? block : null;
}

/* The block you were in just before the edit — so its identity can follow it if the browser replaces the element. */
const lasts = new WeakMap(); // per editor, so two editors open at once never mix up their caret blocks

export function snapshotCaret(root) {
  const block = caretBlock(root);
  if (block && validId(block)) lasts.set(root, { id: block.getAttribute('data-bid'), tags: block.getAttribute('data-tags') });
}

function saveSel() {
  const s = getSelection();
  return s && s.rangeCount ? { a: s.anchorNode, ao: s.anchorOffset, f: s.focusNode, fo: s.focusOffset } : null;
}
function restoreSel(k) {
  if (k?.a?.isConnected && k.f?.isConnected) getSelection().setBaseAndExtent(k.a, k.ao, k.f, k.fo);
}

const isLoose = (n) =>
  (n.nodeType === 3 && n.nodeValue.trim() !== '') ||
  (n.nodeType === 1 && /^(B|I|U|EM|STRONG|CODE|MARK|SPAN|BR|A)$/.test(n.tagName));

/** Loose text and top-level <div>s become paragraphs. */
function structure(root) {
  let changed = false;
  if ([...root.childNodes].some(isLoose)) { tidyBlocks(root); changed = true; }
  for (const div of root.querySelectorAll(':scope > div')) {
    const keep = saveSel();
    const p = document.createElement('p');
    for (const { name, value } of [...div.attributes]) p.setAttribute(name, value);
    p.append(...div.childNodes);
    if (!p.childNodes.length) p.innerHTML = '<br>';
    div.replaceWith(p);
    restoreSel(keep);
    changed = true;
  }
  return changed;
}

/**
 * Brings the editor's blocks into order after an edit. Returns true if anything changed.
 * inputType is the input event's inputType ('insertParagraph' for Enter).
 */
export function reconcile(root, inputType = '') {
  let changed = structure(root);
  const cur = caretBlock(root);
  const blocks = blocksOf(root);
  const last = lasts.get(root) || null;

  // 1. The block you were in was replaced by a new element (type change) → its id and tags move over.
  if (cur && !validId(cur) && last && BID_RE.test(last.id || '') && !root.querySelector(`[data-bid="${last.id}"]`)) {
    cur.setAttribute('data-bid', last.id);
    if (last.tags) cur.setAttribute('data-tags', last.tags);
    changed = true;
  }

  // 2. Duplicates (Enter copies attributes): the original keeps the id, the copy gets a new one and no tags.
  const groups = new Map();
  for (const el of blocks) {
    if (!validId(el)) continue;
    const id = el.getAttribute('data-bid');
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(el);
  }
  const used = new Set(groups.keys());
  const fresh = () => { let id; do { id = newId(); } while (used.has(id)); used.add(id); return id; };

  for (const els of groups.values()) {
    if (els.length < 2) continue;
    let keeper = els[0];
    // Enter at the start of a block: the empty block above is the new one, the text keeps its identity.
    if (inputType === 'insertParagraph' && els.length === 2 && els[1] === cur && isEmpty(els[0]) && !isEmpty(cur)) keeper = cur;
    for (const el of els) {
      if (el === keeper) continue;
      el.setAttribute('data-bid', fresh());
      el.removeAttribute('data-tags');
      changed = true;
    }
  }

  // 3. Blocks without an id.
  for (const el of blocks) {
    if (validId(el)) continue;
    el.setAttribute('data-bid', fresh());
    changed = true;
  }

  if (cur) lasts.set(root, { id: cur.getAttribute('data-bid'), tags: cur.getAttribute('data-tags') });
  return changed;
}

/**
 * Ctrl/Cmd+A: select the text of the block you are in (not the whole note).
 * Press it again and the whole note is selected (config.js → selectAll.expand to turn that off).
 */
export function selectBlockText(root) {
  const sel = getSelection();
  const everything = () => { const r = document.createRange(); r.selectNodeContents(root); sel.removeAllRanges(); sel.addRange(r); };
  const block = caretBlock(root);
  if (!block) { everything(); return; }

  const range = sel.rangeCount ? sel.getRangeAt(0) : null;
  const inside = !range || (block.contains(range.startContainer) && block.contains(range.endContainer));
  if (!inside) return; // already reaches beyond this block → leave the wider selection alone

  const own = [...block.childNodes].filter((n) => !(n.nodeType === 1 && /^(UL|OL)$/.test(n.tagName)));
  const text = ownText(block);
  const selected = sel.toString().replace(/[\s\u00a0]+/g, ' ').trim();
  if (CONFIG.selectAll.expand && (!text || (selected && selected === text))) { everything(); return; }

  const r = document.createRange();
  if (!own.length) { r.setStart(block, 0); r.collapse(true); }
  else {
    r.setStartBefore(own[0]);
    const last = own[own.length - 1];
    if (last.nodeName === 'BR' && own.length > 1) r.setEndBefore(last); else r.setEndAfter(last);
  }
  sel.removeAllRanges();
  sel.addRange(r);
}
