/* ============================================================================
   SHORTCUTS — markdown-style typing and keyboard helpers.
   Key combos come from config.js → shortcuts (edit them there).

   Type at the start of a line (empty, or with text already on it), then press Space:
     #  ##  ###  ####   → Heading 1–4          >      → quote
     -  or  *            → bulleted list         1.     → numbered list
     []  or  [ ]         → checklist  ( [x] = already ticked )
   Typing  []  at the start of a bullet item turns that list into a checklist.
   Only text BEFORE the caret counts, so "a - b" or "see #1" are left alone.
   ========================================================================== */

import { CONFIG } from '../core/config.js';
import { matches } from '../core/keys.js';
import { toggleList, todoify } from './lists.js';
import { setBlock } from './blocks.js';
import { snapshotCaret, selectBlockText } from './normalize.js';

const exec = (cmd, value) => document.execCommand(cmd, false, value);
const SK = CONFIG.shortcuts;

const BLOCK_KEYS = { 'block.text': 'p', 'block.h1': 'h1', 'block.h2': 'h2', 'block.h3': 'h3', 'block.h4': 'h4' };
const LIST_KEYS = { 'list.bullet': 'ul', 'list.number': 'ol', 'list.todo': 'todo' };

function topBlock(node, root) {
  while (node && node.parentNode !== root) node = node.parentNode;
  return node && node.nodeType === 1 ? node : null;
}

const TODO_MARK = /^\[( |x|X)?\] $/;

export function initShortcuts(root) {
  /**
   * Fires after a space is typed. If everything between the start of the block and the caret is a
   * marker ("# ", "- ", "[] " …), the marker is deleted and the block is converted — whether the
   * block was empty or already had text after the caret.
   */
  const onInput = (e) => {
    if (e.inputType !== 'insertText' || e.data !== ' ') return;
    const sel = getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return;
    const caret = sel.getRangeAt(0);
    const anchor = caret.startContainer.nodeType === 1 ? caret.startContainer : caret.startContainer.parentElement;
    const li = anchor?.closest('li');
    const inList = !!li && root.contains(li);
    const block = inList ? li : topBlock(caret.startContainer, root);
    if (!block || block.tagName === 'UL' || block.tagName === 'OL' || block.tagName === 'PRE') return; // code stays code: no "# " or "- " shortcuts

    const before = document.createRange(); // block start → caret
    before.selectNodeContents(block);
    before.setEnd(caret.startContainer, caret.startOffset);
    const typed = before.toString().replace(/\u00a0/g, ' ');

    let action = null;
    if (inList) {
      if (block.parentElement.tagName === 'UL' && block.parentElement.dataset.type !== 'todo' && TODO_MARK.test(typed)) action = 'todo-in-list';
    } else if (/^#{1,4} $/.test(typed))  action = `h${typed.length - 1}`;
    else if (/^[-*] $/.test(typed))      action = 'ul';
    else if (/^1\. $/.test(typed))       action = 'ol';
    else if (/^> $/.test(typed))         action = 'quote';
    else if (TODO_MARK.test(typed))      action = 'todo';
    if (!action) return;

    // Remove the marker, keep whatever text follows it, and put the caret at the start of that text.
    before.deleteContents();
    if (block.textContent) block.normalize(); else block.innerHTML = '<br>'; // drop empty text nodes the browser left behind
    const start = document.createRange();
    start.setStart(block, 0);
    start.collapse(true);
    sel.removeAllRanges();
    sel.addRange(start);

    const ticked = /^\[[xX]\]/.test(typed);
    if (action === 'todo-in-list') { todoify(block.parentElement); block.setAttribute('data-check', ticked ? 'true' : 'false'); }
    else if (action === 'quote') exec('formatBlock', 'blockquote');
    else if (action.startsWith('h')) exec('formatBlock', action);
    else {
      toggleList(root, action);
      if (action === 'todo' && ticked) getSelection().anchorNode?.parentElement?.closest('li')?.setAttribute('data-check', 'true');
    }
    root.dispatchEvent(new Event('input', { bubbles: true })); // autosave
  };

  const onKeydown = (e) => {
    // Backspace with the caret at the very start of a heading → the heading becomes a paragraph.
    if (e.key === 'Backspace' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      const sel = getSelection();
      if (sel.rangeCount && sel.isCollapsed) {
        const caret = sel.getRangeAt(0);
        const block = topBlock(caret.startContainer, root);
        if (block && /^H[1-4]$/.test(block.tagName)) {
          const before = document.createRange();
          before.selectNodeContents(block);
          before.setEnd(caret.startContainer, caret.startOffset);
          if (!before.toString()) {
            e.preventDefault();
            exec('formatBlock', 'p');
            root.dispatchEvent(new Event('input', { bubbles: true })); // autosave
            return;
          }
        }
      }
    }
    if (matches(e, SK['select.all'])) { e.preventDefault(); selectBlockText(root); return; }
    if (e.key === 'Tab') {
      const node = getSelection().anchorNode;
      const el = node?.nodeType === 1 ? node : node?.parentElement;
      if (el?.closest('li') && root.contains(el)) { e.preventDefault(); exec(e.shiftKey ? 'outdent' : 'indent'); }
      return;
    }
    for (const [action, tag] of Object.entries(BLOCK_KEYS)) {
      if (matches(e, SK[action])) { e.preventDefault(); setBlock(root, tag); return; }
    }
    for (const [action, kind] of Object.entries(LIST_KEYS)) {
      if (matches(e, SK[action])) { e.preventDefault(); snapshotCaret(root); toggleList(root, kind); return; }
    }
  };

  root.addEventListener('input', onInput);
  root.addEventListener('keydown', onKeydown);
  return () => { root.removeEventListener('input', onInput); root.removeEventListener('keydown', onKeydown); };
}
