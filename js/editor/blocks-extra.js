/* ============================================================================
   NEW BLOCKS — divider, callout, toggle (collapsible).

   • Divider   <hr>                         a thin line. Made from "/" or the six-dot menu; a new text line is added after it.
   • Callout   <p data-callout="note">      a text block in a tinted box. Enter on an empty callout line leaves the box.
   • Toggle    <details open><summary>Title</summary><p>…</p></details>
               Click the little arrow to fold / unfold. Enter in the title jumps into the content; Enter on a second empty
               line inside leaves the toggle. The folded / open state is saved with the note.
   Look: css/editor.css (hr, p[data-callout], details) · colours: --divider-*, --callout-*, --toggle-* in css/tokens.css.
   ========================================================================== */

import { ownText } from '../core/blockindex.js';
import { idFactory } from './block-ops.js';
import { setBlock } from './blocks.js';
import { snapshotCaret, caretBlock } from './normalize.js';

const notify = (root) => root.dispatchEvent(new Event('input', { bubbles: true }));

/** Caret at the start (or end) of an element. */
function caretIn(el, atEnd = false) {
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(!atEnd);
  if (atEnd && el.lastChild?.nodeName === 'BR') { r.setStartBefore(el.lastChild); r.collapse(true); }
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
}

const topOf = (root, el) => { let t = el; while (t.parentElement && t.parentElement !== root) t = t.parentElement; return t; };

const newPara = (root) => {
  const p = document.createElement('p');
  p.setAttribute('data-bid', idFactory(root)());
  p.innerHTML = '<br>';
  return p;
};

/** A heading, quote or list item first becomes a plain paragraph (the caret is already in it). */
function toPlain(root, block) {
  if (block.tagName === 'P' && !block.hasAttribute('data-callout')) return block;
  snapshotCaret(root);
  setBlock(root, 'p', false);
  return caretBlock(root) || block;
}

/* ---------- Divider ---------- */

export function insertDivider(root, block) {
  const top = topOf(root, block);
  const wasEmpty = !ownText(block) && !block.querySelector(':scope > ul, :scope > ol') && !block.hasAttribute('data-tags');
  const hr = document.createElement('hr');
  top.after(hr);
  if (wasEmpty) {                        // an empty line becomes the divider; otherwise the divider goes below the line
    const list = block.tagName === 'LI' ? block.parentElement : null;
    block.remove();
    if (list && !list.querySelector('li')) list.remove();
  }
  let next = hr.nextElementSibling;
  if (!next || next.tagName !== 'P' || ownText(next) || next.hasAttribute('data-callout')) { next = newPara(root); hr.after(next); }
  caretIn(next);
}

/* ---------- Callout ---------- */

export function toCallout(root, block) {
  const p = toPlain(root, block);
  p.setAttribute('data-callout', 'note');
  caretIn(p, true);
}

/* ---------- Toggle ---------- */

export function toToggle(root, block) {
  const p = toPlain(root, block);
  p.removeAttribute('data-callout');
  const d = document.createElement('details');
  d.setAttribute('open', '');
  const s = document.createElement('summary');
  for (const a of ['data-bid', 'data-tags']) if (p.hasAttribute(a)) s.setAttribute(a, p.getAttribute(a));
  s.append(...p.childNodes);
  if (!s.childNodes.length) s.innerHTML = '<br>';
  d.append(s, newPara(root));
  p.replaceWith(d);
  caretIn(s, true);
}

/** The toggle goes away: its title becomes a paragraph and its content stays where it is. Returns that paragraph. */
export function unwrapToggle(root, summary) {
  const d = summary.parentElement;
  const p = document.createElement('p');
  for (const a of ['data-bid', 'data-tags']) if (summary.hasAttribute(a)) p.setAttribute(a, summary.getAttribute(a));
  p.append(...summary.childNodes);
  if (!p.childNodes.length) p.innerHTML = '<br>';
  const body = [...d.children].filter((c) => c !== summary);
  d.replaceWith(p, ...body);
  return p;
}

/* ---------- Behaviour inside the editor ---------- */

export function mountExtraBlocks(root, { history = null, readOnly = false } = {}) {
  if (readOnly) return () => {};   // Read mode: the browser folds / unfolds a toggle by itself

  const atStart = (el) => {
    const sel = getSelection();
    if (!sel.rangeCount || !sel.isCollapsed || !el.contains(sel.anchorNode)) return false;
    const r = document.createRange();
    r.selectNodeContents(el);
    r.setEnd(sel.anchorNode, sel.anchorOffset);
    return r.toString() === '';
  };
  const done = () => { notify(root); history?.record(); };

  /* A toggle always keeps its title first and at least one line of content */
  function repair() {
    let changed = false;
    for (const d of root.querySelectorAll('details')) {
      if (d.firstElementChild?.tagName !== 'SUMMARY') {
        const s = document.createElement('summary');
        s.innerHTML = '<br>';
        d.prepend(s);
        changed = true;
      }
      if (d.children.length < 2) { d.append(newPara(root)); changed = true; }
    }
    return changed;
  }

  const onClick = (e) => {
    const s = e.target.closest?.('summary');
    if (!s || !root.contains(s)) return;
    e.preventDefault();                                           // clicking the title must not fold it; only the arrow does
    if (e.clientX - s.getBoundingClientRect().left < 28) {
      history?.commit();
      const d = s.parentElement;
      if (d.hasAttribute('open')) d.removeAttribute('open'); else d.setAttribute('open', '');
      done();
    }
  };
  const onKeyUp = (e) => { if (e.key === ' ' && e.target.closest?.('summary')) e.preventDefault(); };   // Firefox folds on Space

  const onKeyDown = (e) => {
    if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key !== 'Enter' && e.key !== 'Backspace') return;
    const sel = getSelection();
    if (!sel.rangeCount || !sel.isCollapsed || !root.contains(sel.anchorNode)) return;
    const block = caretBlock(root);
    if (!block) return;
    const stop = () => { e.preventDefault(); e.stopPropagation(); };

    /* Callout: Enter or Backspace on an empty line leaves the box */
    if (block.tagName === 'P' && block.hasAttribute('data-callout') && !ownText(block) && (e.key === 'Enter' || atStart(block))) {
      stop(); history?.commit(); block.removeAttribute('data-callout'); done(); return;
    }

    /* Toggle title */
    if (block.tagName === 'SUMMARY') {
      const d = block.parentElement;
      if (e.key === 'Enter' && !e.shiftKey) {
        stop(); history?.commit();
        d.setAttribute('open', '');
        let body = block.nextElementSibling;
        if (!body) { body = newPara(root); d.append(body); }
        caretIn(body);
        done(); return;
      }
      if (e.key === 'Backspace' && atStart(block)) {
        stop();
        const rest = [...d.children].filter((c) => c !== block);
        if (!ownText(block) && rest.every((c) => !ownText(c))) {       // empty toggle → back to a plain line
          history?.commit();
          const p = unwrapToggle(root, block);
          p.nextElementSibling?.matches('p') && !ownText(p.nextElementSibling) && p.nextElementSibling.remove();
          caretIn(p); done();
        }
        return;
      }
      return;
    }

    /* Inside a toggle: Enter on an empty second line leaves it */
    if (e.key === 'Enter' && !e.shiftKey && block.parentElement?.tagName === 'DETAILS' && block.tagName === 'P'
        && !ownText(block) && block.previousElementSibling?.tagName !== 'SUMMARY' && !block.nextElementSibling) {
      stop(); history?.commit();
      const d = block.parentElement;
      block.remove();
      let after = d.nextElementSibling;
      if (!after || after.tagName !== 'P' || ownText(after)) { after = newPara(root); d.after(after); }
      caretIn(after);
      done();
    }
  };

  const onInput = () => { if (repair()) notify(root); };

  root.addEventListener('click', onClick);
  root.addEventListener('keyup', onKeyUp);
  root.addEventListener('keydown', onKeyDown, true);
  root.addEventListener('input', onInput);
  repair();
  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('keyup', onKeyUp);
    root.removeEventListener('keydown', onKeyDown, true);
    root.removeEventListener('input', onInput);
  };
}
