/* ============================================================================
   SLASH MENU — type "/" at the start of a block (or after a space) and the block menu opens under the caret.
     • Keep typing to filter ("/h2", "/check", "/del").  ↑ ↓ choose · Enter or Tab apply · Esc closes · click works too.
     • Applying removes the typed "/…" and then does the action (turn into…, duplicate, move, delete).
     • "and/or" and web addresses do not trigger it (the "/" must follow a space or start the block).
   The items are the six-dot menu's (block-menu.js ← config.js → blockTypes). Look: .block-menu / .slash-menu in css/editor.css.
   ========================================================================== */

import { caretBlock } from './normalize.js';
import { menuModel, renderMenu, placeMenu, runAction } from './block-menu.js';

export function mountSlashMenu(root, history) {
  let menu = null;
  let st = null; // { node, offset (of the "/"), block, active }

  const items = () => [...menu.querySelectorAll('.block-menu__item:not([disabled])')];

  function close() {
    if (!menu) return;
    menu.remove();
    menu = null;
    st = null;
    document.removeEventListener('selectionchange', refresh);
  }

  /** The text typed after the "/", or null if the menu should close. */
  function query() {
    const sel = getSelection();
    if (!st || !st.node.isConnected || !sel.rangeCount || !sel.isCollapsed || sel.anchorNode !== st.node) return null;
    const end = sel.anchorOffset;
    if (end <= st.offset || st.node.data[st.offset] !== '/') return null;
    return st.node.data.slice(st.offset + 1, end);
  }

  function setActive(i) {
    const list = items();
    if (!list.length) return;
    st.active = (i + list.length) % list.length;
    list.forEach((el, n) => el.classList.toggle('is-active', n === st.active));
    list[st.active].scrollIntoView({ block: 'nearest' });
  }

  function place() {
    const sel = getSelection();
    const r = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    let rect = r && (r.getClientRects()[0] || r.getBoundingClientRect());
    if (!rect || (!rect.width && !rect.height && !rect.top)) rect = st.block.getBoundingClientRect();
    placeMenu(menu, rect);
  }

  function refresh() {
    if (!menu) return;
    const q = query();
    if (q === null) { close(); return; }
    const { html, count } = renderMenu(menuModel(st.block), q);
    if (!count) {
      if (/\s$/.test(q)) { close(); return; } // typed a space and nothing matches: it was just a slash
      menu.innerHTML = '<div class="block-menu__empty">No matches</div>';
    } else {
      menu.innerHTML = html;
      setActive(0);
    }
    place();
  }

  function open(node, offset, block) {
    st = { node, offset, block, active: 0 };
    menu = document.createElement('div');
    menu.className = 'block-menu slash-menu';
    menu.setAttribute('role', 'menu');
    document.body.append(menu);
    menu.addEventListener('mousedown', (e) => e.preventDefault()); // the caret stays in the text
    menu.addEventListener('mousemove', (e) => {
      const el = e.target.closest('.block-menu__item');
      const i = el ? items().indexOf(el) : -1;
      if (i >= 0 && i !== st.active) setActive(i);
    });
    menu.addEventListener('click', (e) => {
      const el = e.target.closest('.block-menu__item');
      if (el && !el.disabled) pick(el.dataset.act);
    });
    document.addEventListener('selectionchange', refresh);
    refresh();
  }

  function pick(act) {
    if (!st) return;
    const { node, offset, block } = st;
    const sel = getSelection();
    const r = document.createRange();
    r.setStart(node, offset);
    r.setEnd(node, sel.anchorNode === node ? sel.anchorOffset : node.data.length);
    const parent = node.parentNode;
    const at = [...parent.childNodes].indexOf(node);
    r.deleteContents();                       // remove "/query"
    if (node.data === '') node.remove();
    // A block with nothing left needs its <br>, or the browser moves the caret to the block above.
    const hasOwn = [...block.childNodes].some((n) => (n.nodeType === 3 ? n.data.length > 0 : !(n.nodeType === 1 && /^(UL|OL|BR)$/.test(n.tagName))));
    if (!hasOwn && !block.querySelector(':scope > br')) block.insertBefore(document.createElement('br'), block.firstChild);
    const caret = document.createRange();
    if (node.isConnected) caret.setStart(node, offset);
    else if (!hasOwn) caret.setStart(block, 0);
    else caret.setStart(parent, Math.min(at, parent.childNodes.length));
    caret.collapse(true);
    sel.removeAllRanges();
    sel.addRange(caret);
    close();
    runAction(root, history, act, block, { place: false });
    if (act !== 'delete') root.focus({ preventScroll: true });
  }

  /* ---------- Events ---------- */

  const onInput = (e) => {
    if (menu) { refresh(); return; } // typing narrows the list right away (selectionchange also keeps it in step)
    if (e.inputType !== 'insertText' || e.data !== '/') return;
    const sel = getSelection();
    if (!sel.rangeCount || !sel.isCollapsed || sel.anchorNode?.nodeType !== 3) return;
    const node = sel.anchorNode;
    const at = sel.anchorOffset - 1;
    if (at < 0 || node.data[at] !== '/') return;
    if (node.parentElement?.closest('code')) return;
    const block = caretBlock(root);
    if (!block) return;
    const before = document.createRange();
    before.selectNodeContents(block);
    before.setEnd(node, at);
    const text = before.toString();
    if (text && !/\s$/.test(text)) return;    // "and/or", "https://…": not a menu
    open(node, at, block);
  };

  const onKeyDown = (e) => {
    if (!menu) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); setActive(st.active + (e.key === 'ArrowDown' ? 1 : -1)); }
    else if (e.key === 'Enter' || e.key === 'Tab') {
      const el = items()[st.active];
      e.preventDefault(); e.stopPropagation();
      if (el) pick(el.dataset.act); else close();
    } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  };

  root.addEventListener('input', onInput);
  root.addEventListener('keydown', onKeyDown, true);   // before the editor's own Enter / Tab / arrow handling
  root.addEventListener('blur', close);
  const onScroll = (e) => { if (menu && !menu.contains(e.target)) place(); }; // the page moved under the caret: follow it
  window.addEventListener('scroll', onScroll, true);

  return () => {
    close();
    root.removeEventListener('input', onInput);
    root.removeEventListener('keydown', onKeyDown, true);
    root.removeEventListener('blur', close);
    window.removeEventListener('scroll', onScroll, true);
  };
}
