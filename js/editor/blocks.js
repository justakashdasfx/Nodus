/* ============================================================================
   BLOCKS — turn the current block into text / heading / quote.

   Used by the keyboard shortcuts (Ctrl+Shift+0–4) and the floating toolbar.
   • Inside a list item the block first LEAVES the list, then changes type
     (a heading can't live inside a bullet — that is what made text grow).
   • Pressing a heading's key again turns it back into normal text.
   • After the browser's formatBlock a safety check swaps the tag by hand if it
     did not take, and unwraps any heading nested inside a heading / list item.
   ========================================================================== */

import { tidyBlocks, currentLi } from './lists.js';
import { snapshotCaret } from './normalize.js';

const exec = (cmd, value) => document.execCommand(cmd, false, value);

function topBlock(node, root) {
  while (node && node.parentNode !== root) node = node.parentNode;
  return node && node.nodeType === 1 ? node : null;
}

const saveSel = () => {
  const s = getSelection();
  return s.rangeCount ? { a: s.anchorNode, ao: s.anchorOffset, f: s.focusNode, fo: s.focusOffset } : null;
};
const restoreSel = (k) => {
  if (k?.a?.isConnected && k.f?.isConnected) getSelection().setBaseAndExtent(k.a, k.ao, k.f, k.fo);
};

/** Removes headings/paragraphs nested inside `el` (keeps their text and formatting). */
function flatten(el) {
  const keep = saveSel();
  el.querySelectorAll('h1, h2, h3, h4, p, div').forEach(n => n.replaceWith(...n.childNodes));
  el.normalize();
  restoreSel(keep);
}

/** Makes sure the block holding the caret really is <tag>; swaps it by hand if the browser didn't. */
function ensureTag(root, tag) {
  const sel = getSelection();
  if (!sel.rangeCount) return;
  const block = topBlock(sel.anchorNode, root);
  if (!block || /^(UL|OL)$/.test(block.tagName)) return;
  flatten(block);
  if (block.tagName.toLowerCase() === tag) return;

  const keep = saveSel();
  const next = document.createElement(tag);
  next.className = block.className;
  next.append(...block.childNodes);
  if (!next.childNodes.length) next.innerHTML = '<br>';
  block.replaceWith(next);
  if (keep?.a?.isConnected) restoreSel(keep);
  else { const r = document.createRange(); r.setStart(next, 0); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); }
}

/** tag: 'p' | 'h1'…'h4' | 'blockquote'.  toggle: pressing the same block type again gives normal text. */
export function setBlock(root, tag, toggle = true) {
  if (!getSelection().rangeCount) return;
  snapshotCaret(root); // the block keeps its id and tags through the change

  // 1. Leave the list first (a few passes, in case the item is nested).
  let wasList = false;
  for (let i = 0; i < 6; i++) {
    const li = currentLi(root);
    if (!li) break;
    wasList = true;
    flatten(li);                                  // repairs <li><h1>… left by older versions
    const ordered = li.closest('ul, ol').tagName === 'OL';
    exec(ordered ? 'insertOrderedList' : 'insertUnorderedList');
    tidyBlocks(root);
  }
  if (currentLi(root)) return;                    // could not leave the list → do nothing rather than nest blocks

  // 2. Change the block type.
  const now = String(document.queryCommandValue('formatBlock')).toLowerCase().replace(/[<>]/g, '');
  const target = toggle && !wasList && now === tag && tag !== 'p' ? 'p' : tag;
  exec('formatBlock', target);
  ensureTag(root, target);

  root.dispatchEvent(new Event('input', { bubbles: true })); // autosave
}
