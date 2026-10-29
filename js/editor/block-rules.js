/* ============================================================================
   BLOCK RULES — what Enter, Backspace and Ctrl/Cmd+D do in each kind of block.
   Registered BEFORE the other key handlers (editor.js), so these rules win.

   GROUP 1 · Text · H1–H4 · Quote · Callout
     Enter at the end      → a new Text line below (the block does not repeat itself)
     Enter on an empty one → it becomes Text (no extra line)
     Enter in the middle   → the part after the caret becomes Text
     Backspace at the start → the block becomes Text; Backspace again goes back to the previous line
   GROUP 2 · Bullet · Number · Checklist · Task · Toggle
     Enter                 → another item of the same kind (the browser does this)
     Enter / Backspace on an empty item (or Backspace at the start of one) → it becomes Text
                             (an item inside another item steps out one level first)
     An empty toggle + Enter → Text
   CODE BLOCK (code-block.js): Enter adds a line · Enter or Backspace on the empty last line → Text · Backspace again → previous line
   ALL  · Shift+Enter always stays inside the block (a line break), as the browser does.
        · An empty Text line + Backspace removes it and puts the caret at the end of the line above
          (also after a code block, list or toggle). Next to a divider the divider logic in blocks-extra.js applies.
        · Ctrl/Cmd+D duplicates the block the caret is in (a list item with its sub-items, a toggle or code block whole).
          Key: config.js → shortcuts['block.duplicate'] (default Mod+D). With blocks selected, block-select.js does it.
        · Click a divider, then Delete / Backspace removes it.
   ========================================================================== */

import { CONFIG } from '../core/config.js';
import { matches } from '../core/keys.js';
import { ownText } from '../core/blockindex.js';
import { caretBlock } from './normalize.js';
import { setBlock } from './blocks.js';
import { idFactory, duplicateBlock } from './block-ops.js';
import { unwrapToggle } from './blocks-extra.js';

const NESTED = ':scope > ul, :scope > ol';

export function mountBlockRules(root, { history = null } = {}) {
  const notify = () => root.dispatchEvent(new Event('input', { bubbles: true }));
  const done = () => { notify(); history?.record(); };

  const newPara = () => {
    const p = document.createElement('p');
    p.setAttribute('data-bid', idFactory(root)());
    p.innerHTML = '<br>';
    return p;
  };

  /* ---- caret helpers ---- */
  const place = (r) => { const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
  const caretStart = (el) => { const r = document.createRange(); r.selectNodeContents(el); r.collapse(true); place(r); };
  function caretEnd(el) {
    const r = document.createRange();
    r.selectNodeContents(el);
    const nested = el.tagName === 'LI' ? el.querySelector(NESTED) : null;
    if (nested) r.setEndBefore(nested);
    else if (el.lastChild?.nodeName === 'BR') r.setEndBefore(el.lastChild);
    r.collapse(false);
    place(r);
  }
  /** The very last editable thing inside a block (the last item of a list, the last line of a toggle). */
  function lastLeaf(el) {
    let t = el;
    for (;;) {
      const next = /^(UL|OL|DETAILS)$/.test(t.tagName) ? t.lastElementChild
        : t.tagName === 'LI' ? t.querySelector(':scope > ul:last-child, :scope > ol:last-child') : null;
      if (!next) return t;
      t = next;
    }
  }
  const atStart = (el) => {
    const s = getSelection();
    const r = document.createRange();
    r.selectNodeContents(el);
    r.setEnd(s.anchorNode, s.anchorOffset);
    return r.toString().replace(/\u200b/g, '') === '';
  };
  const atEnd = (el) => {
    const s = getSelection();
    const r = document.createRange();
    r.selectNodeContents(el);
    r.setStart(s.anchorNode, s.anchorOffset);
    const rest = r.cloneContents();
    rest.querySelectorAll('ul, ol').forEach((l) => l.remove());
    return (rest.textContent || '').replace(/\u200b/g, '') === '';
  };

  /* ---- turning a block into Text ---- */
  function toText(b) {
    if (b.tagName === 'P') b.removeAttribute('data-callout');    // a callout line just leaves its box
    else setBlock(root, 'p', false);                              // heading, quote, list item → Text (keeps its id and tags)
  }

  /* ---- a divider you clicked: Delete / Backspace removes it ---- */
  let pickedHr = null;
  const onMouseDown = (e) => { if (e.target.tagName !== 'HR') pickedHr = null; };
  const onClick = (e) => { pickedHr = e.target.tagName === 'HR' && root.contains(e.target) ? e.target : null; };

  function removePickedHr() {
    const hr = pickedHr;
    pickedHr = null;
    history?.commit();
    const next = hr.nextElementSibling;
    const prev = hr.previousElementSibling;
    hr.remove();
    if (!root.children.length) root.append(newPara());
    if (next) caretStart(next.tagName === 'UL' || next.tagName === 'OL' ? next.querySelector('li') || next : next);
    else if (prev) caretEnd(lastLeaf(prev));
    else caretStart(root.firstElementChild);
    root.focus({ preventScroll: true });
    done();
  }

  function duplicate() {
    const b = caretBlock(root);
    if (!b) return false;
    history?.commit();
    const copy = duplicateBlock(root, b.closest('blockquote') || b);
    caretEnd(copy.tagName === 'DETAILS' ? copy.querySelector('summary') || copy : copy);
    done();
    return true;
  }

  const onKeyDown = (e) => {
    if (e.target.closest?.('[data-thread-block], [data-map-block]')) return;      // typing inside a thread block is not typing in the note
    if (e.isComposing) return;
    const mod = e.ctrlKey || e.metaKey;
    const eat = () => { e.preventDefault(); e.stopPropagation(); };

    if (matches(e, CONFIG.shortcuts['block.duplicate'] || 'Mod+D')) {
      if (duplicate()) eat();
      return;
    }

    if (pickedHr) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && !mod && !e.altKey && pickedHr.isConnected) { eat(); removePickedHr(); return; }
      if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Meta') pickedHr = null;
    }

    if (mod || e.altKey || e.shiftKey) return;                  // Shift+Enter: a line break inside the block
    if (e.key !== 'Enter' && e.key !== 'Backspace') return;
    const sel = getSelection();
    if (!sel.rangeCount || !sel.isCollapsed || !root.contains(sel.anchorNode)) return;
    let b = caretBlock(root);
    if (!b || b.tagName === 'PRE' || b.tagName === 'DIV') return;      // code blocks have their own rules (code-block.js)
    b = b.closest('blockquote') || b;

    const tag = b.tagName;
    const isCallout = tag === 'P' && b.hasAttribute('data-callout');
    const isHead = /^H[1-4]$/.test(tag);
    const isQuote = tag === 'BLOCKQUOTE';
    const isLi = tag === 'LI';
    const empty = !ownText(b) && !b.querySelector(NESTED);

    /* ---------- Group 1: Text-like blocks ---------- */
    if (isHead || isQuote || isCallout) {
      if (e.key === 'Enter') {
        if (empty) { eat(); history?.commit(); toText(b); done(); return; }
        if (atEnd(b)) {
          eat(); history?.commit();
          const p = newPara();
          b.after(p);
          caretStart(p);
          done(); return;
        }
        if (!atStart(b)) {                                      // split in the middle: let the browser do it, then the second half becomes Text
          history?.commit();
          setTimeout(() => {
            const nb = caretBlock(root);
            if (!nb || nb === b) return;
            if (/^(H[1-4]|BLOCKQUOTE)$/.test(nb.tagName) || (nb.tagName === 'P' && nb.hasAttribute('data-callout'))) { toText(nb); done(); }
          }, 0);
        }
        return;
      }
      if (atStart(b)) { eat(); history?.commit(); toText(b); done(); }   // Backspace
      return;
    }

    /* ---------- Group 2: list items ---------- */
    if (isLi) {
      if (b.querySelector(NESTED)) return;                      // an item with sub-items: leave it to the browser
      const nested = b.parentElement?.parentElement?.tagName === 'LI';
      if ((e.key === 'Enter' && empty) || (e.key === 'Backspace' && atStart(b))) {
        eat(); history?.commit();
        if (nested) document.execCommand('outdent'); else toText(b);
        done();
      }
      return;
    }

    /* ---------- Toggle title: Enter on an empty toggle makes Text ---------- */
    if (tag === 'SUMMARY') {
      const d = b.parentElement;
      if (e.key === 'Enter' && empty && [...d.children].every((c) => c === b || !ownText(c))) {
        eat(); history?.commit();
        const p = unwrapToggle(root, b);
        const after = p.nextElementSibling;
        if (after?.matches('p') && !ownText(after)) after.remove();
        caretStart(p);
        done();
      }
      return;
    }

    /* ---------- An empty Text line + Backspace: remove it, caret to the end of the line above ---------- */
    if (tag === 'P' && e.key === 'Backspace' && empty && b.parentElement === root && !b.hasAttribute('data-tags')) {
      const prev = b.previousElementSibling;
      if (!prev || prev.tagName === 'HR') return;               // first line: nothing above · a divider: blocks-extra.js handles it
      eat(); history?.commit();
      b.remove();
      caretEnd(lastLeaf(prev));
      done();
    }
  };

  root.addEventListener('keydown', onKeyDown, true);
  root.addEventListener('mousedown', onMouseDown, true);
  root.addEventListener('click', onClick, true);
  return () => {
    root.removeEventListener('keydown', onKeyDown, true);
    root.removeEventListener('mousedown', onMouseDown, true);
    root.removeEventListener('click', onClick, true);
  };
}
