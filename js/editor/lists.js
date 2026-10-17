/* ============================================================================
   LISTS — bulleted, numbered and checklist (to-do) lists.

   A checklist is a normal <ul> marked  data-type="todo"  whose <li> items
   carry  data-check="true|false".  CSS draws the squircle box (editor.css).
   ========================================================================== */

const exec = (cmd, value) => document.execCommand(cmd, false, value);
const notify = (root) => root.dispatchEvent(new Event('input', { bubbles: true })); // triggers autosave

export function currentLi(root) {
  const node = getSelection().anchorNode;
  const el = node?.nodeType === 1 ? node : node?.parentElement;
  const li = el?.closest('li');
  return li && root.contains(li) ? li : null;
}

export function todoify(ul) {
  ul.setAttribute('data-type', 'todo');
  [...ul.children].forEach(li => { if (li.tagName === 'LI' && !li.hasAttribute('data-check')) li.setAttribute('data-check', 'false'); });
}

export function untodo(ul) {
  ul.removeAttribute('data-type');
  [...ul.children].forEach(li => li.removeAttribute('data-check'));
}

const INLINE_TAGS = new Set(['B', 'I', 'U', 'EM', 'STRONG', 'CODE', 'MARK', 'SPAN', 'BR']);

/**
 * Browsers sometimes leave the document in a shape this editor doesn't expect after a list command:
 *   • a list INSIDE a paragraph  (<p><ul>…</ul></p>, invalid HTML that breaks later typing)
 *   • loose text with no paragraph around it (after turning a one-item list back into text)
 * This lifts lists out, wraps loose text in <p>, and keeps the caret where it was.
 */
export function tidyBlocks(root) {
  const sel = getSelection();
  const keep = sel.rangeCount ? { a: sel.anchorNode, ao: sel.anchorOffset, f: sel.focusNode, fo: sel.focusOffset } : null;
  let changed = false;

  root.querySelectorAll('ul, ol').forEach(list => {
    const parent = list.parentElement;
    if (!parent || parent === root || !/^(P|H[1-4]|BLOCKQUOTE|DIV)$/.test(parent.tagName)) return;
    const others = [...parent.childNodes].filter(n => n !== list && n.nodeName !== 'BR' && !(n.nodeType === 3 && !n.nodeValue.trim()));
    if (others.length) parent.after(list); else parent.replaceWith(list);
    changed = true;
  });

  let run = [];
  const closeRun = () => {
    if (!run.length) return;
    const p = document.createElement('p');
    run[0].before(p);
    run.forEach(n => p.append(n));
    run = [];
    changed = true;
  };
  [...root.childNodes].forEach(n => {
    const loose = n.nodeType === 3 || (n.nodeType === 1 && INLINE_TAGS.has(n.tagName));
    if (!loose) { closeRun(); return; }
    if (n.nodeType === 3 && !n.nodeValue.trim() && !run.length) return; // whitespace between blocks
    run.push(n);
  });
  closeRun();

  if (changed && keep?.a?.isConnected) sel.setBaseAndExtent(keep.a, keep.ao, keep.f, keep.fo);
}

/** kind: 'ul' | 'ol' | 'todo' — toggles that list type on the current block. */
export function toggleList(root, kind) {
  const ul = currentLi(root)?.closest('ul, ol') || null;
  const isTodo = ul?.dataset.type === 'todo';

  if (kind === 'todo') {
    if (isTodo) untodo(ul);
    else if (ul && ul.tagName === 'UL') todoify(ul);
    else {
      exec('insertUnorderedList');
      tidyBlocks(root);
      const made = currentLi(root)?.closest('ul');
      if (made) todoify(made);
    }
  } else {
    if (isTodo) untodo(ul);           // checklist → plain bullets
    if (!(isTodo && kind === 'ul')) { exec(kind === 'ul' ? 'insertUnorderedList' : 'insertOrderedList'); tidyBlocks(root); }
  }
  notify(root);
}

/** Click the box to tick it · Enter starts an unchecked item · Ctrl/Cmd+Enter ticks the current item. */
export function initTodoInteractions(root) {
  const flip = (li) => { li.setAttribute('data-check', li.getAttribute('data-check') === 'true' ? 'false' : 'true'); notify(root); };

  const onMouseDown = (e) => {
    const li = e.target.closest?.('li[data-check]');
    if (!li || !root.contains(li) || li.parentElement.dataset.type !== 'todo') return;
    const box = li.getBoundingClientRect();
    const em = parseFloat(getComputedStyle(li).fontSize) || 16;
    if (e.clientX >= box.left || e.clientX < box.left - em * 1.9) return; // only the box area, not the text
    e.preventDefault();
    flip(li);
  };

  const onInput = (e) => {
    if (e.inputType !== 'insertParagraph') return;
    const li = currentLi(root);
    if (li?.parentElement.dataset.type === 'todo') li.setAttribute('data-check', 'false'); // the new item starts unchecked
  };

  const onKeydown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const li = currentLi(root);
      if (li?.hasAttribute('data-check')) { e.preventDefault(); flip(li); }
    }
  };

  root.addEventListener('mousedown', onMouseDown);
  root.addEventListener('input', onInput);
  root.addEventListener('keydown', onKeydown);
  return () => {
    root.removeEventListener('mousedown', onMouseDown);
    root.removeEventListener('input', onInput);
    root.removeEventListener('keydown', onKeydown);
  };
}
