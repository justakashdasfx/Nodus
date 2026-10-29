/* ============================================================================
   MAP OUTLINE — the same map as a bullet list you can type in. Floating nodes are listed under "Floating".
   Every row is a node: the text edits like in the canvas (bold, colours, lists, checklists), and the tree changes with the keyboard:
     Enter  a new row on the same level          Tab / Shift+Tab  one level in / out
     Backspace on an empty row  deletes it       Alt+↑ / Alt+↓    moves the row among its siblings
     ↑ / ↓ at the start / end of a row  jump to the row above / below       the arrow at the left folds a branch
   It works on the same data as the canvas (js/maps/model.js) and tells the engine when something changed through `ctx`.
   Styling: css/maps.css section 9.
   ========================================================================== */

import * as M from './model.js';
import { readNode, inList, fixChecklists } from './richtext.js';
import { parseOutline } from './clip.js';

export function mountOutline(box, ctx) {
  const { map, readOnly } = ctx;
  const touched = new Set();                    // rows already typed in since they got the focus (one undo step per row)

  /* ---------- Drawing ---------- */

  function render() {
    const by = {};
    M.visible(map).forEach((v) => { by[v.id] = v; });
    const rows = (id, level, out) => {
      const n = map.nodes[id];
      const ci = by[id]?.ci;
      out.push(`<div class="mo-row" data-id="${id}" data-level="${Math.min(level, 3)}" style="--lvl:${level}">
        <button type="button" class="mo-fold${n.ch.length && id !== map.root ? '' : ' is-empty'}" data-fold tabindex="-1" aria-label="Fold">${n.col ? '▸' : '▾'}</button>
        <span class="mo-bullet"${ci == null ? '' : ` data-ci="${ci}"`}></span>
        <div class="mo-text" contenteditable="${readOnly ? 'false' : 'true'}" spellcheck="false"></div>
      </div>`);
      if (!n.col || id === map.root) n.ch.forEach((c) => rows(c, level + 1, out));
    };
    const main = [];
    rows(map.root, 0, main);
    const floats = Object.values(map.nodes).filter((n) => n.fl);
    const loose = [];
    floats.forEach((f) => rows(f.id, 1, loose));
    box.innerHTML = `<div class="mo-page">${main.join('')}${floats.length ? `<p class="mo-label">Floating</p>${loose.join('')}` : ''}</div>`;
    box.querySelectorAll('.mo-text').forEach((el) => {                    // set the content through the DOM: no escaping needed
      const n = map.nodes[el.closest('.mo-row').dataset.id];
      if (n.h) el.innerHTML = n.h; else el.textContent = n.t;
    });
  }

  const rowEls = () => [...box.querySelectorAll('.mo-row')];
  const rowOf = (id) => box.querySelector(`.mo-row[data-id="${id}"]`);

  function focus(id, atEnd = true) {
    const el = rowOf(id)?.querySelector('.mo-text');
    if (!el) return;
    el.focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(!atEnd);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    el.scrollIntoView({ block: 'nearest' });
  }

  /** Where the caret is, counted in characters from the start of the row's text. */
  function caret(el) {
    const s = getSelection();
    if (!s.rangeCount || !s.isCollapsed) return -1;
    const r = document.createRange();
    r.selectNodeContents(el);
    r.setEnd(s.anchorNode, s.anchorOffset);
    return r.toString().length;
  }

  /* ---------- Changing the tree ---------- */

  /** Runs a change, redraws and puts the caret in the row it returns. */
  function change(fn) {
    if (readOnly) return;
    ctx.snap();
    const focusId = fn();
    ctx.changed();
    render();
    if (focusId) focus(focusId);
  }

  const addAfter = (id) => change(() => (id === map.root ? M.addChild(map, id) : M.addSibling(map, id)));

  const indent = (id) => change(() => {
    const n = map.nodes[id];
    const par = n.p && map.nodes[n.p];
    const i = par ? par.ch.indexOf(id) : -1;
    if (i > 0) M.moveNodes(map, [id], par.ch[i - 1], 'child');                  // becomes the last child of the row above on its level
    return id;
  });

  const outdent = (id) => change(() => {
    const n = map.nodes[id];
    const par = n.p && map.nodes[n.p];
    if (par && par.id !== map.root && par.p) M.moveNodes(map, [id], par.id, 'after');   // becomes a sibling right after its parent
    return id;
  });

  const move = (id, dir) => change(() => {
    const n = map.nodes[id];
    const par = n.p && map.nodes[n.p];
    if (!par) return id;
    const i = par.ch.indexOf(id), j = i + dir;
    if (j >= 0 && j < par.ch.length) [par.ch[i], par.ch[j]] = [par.ch[j], par.ch[i]];
    return id;
  });

  function removeRow(id) {
    const rows = rowEls();
    const i = rows.findIndex((r) => r.dataset.id === id);
    const back = rows[i - 1]?.dataset.id;
    change(() => { M.removeNode(map, id); return back || map.root; });
  }

  /* ---------- Events ---------- */

  function onInput(e) {
    const el = e.target.closest('.mo-text');
    if (!el || readOnly) return;
    const id = el.closest('.mo-row').dataset.id;
    const n = map.nodes[id];
    if (!touched.has(id)) { touched.add(id); ctx.snap(); }
    fixChecklists(el);
    const r = readNode(el);
    n.t = r.t;
    if (r.h) n.h = r.h; else delete n.h;
    ctx.changed();
  }

  function onKey(e) {
    const el = e.target.closest('.mo-text');
    if (!el || readOnly) return;
    const id = el.closest('.mo-row').dataset.id;
    const n = map.nodes[id];
    const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
    const rows = rowEls();
    const i = rows.findIndex((r) => r.dataset.id === id);
    if (e.key === 'Enter' && plain && !e.shiftKey) {
      if (inList()) return;                                                      // inside a list Enter adds an item
      e.preventDefault();
      addAfter(id);
    } else if (e.key === 'Tab' && plain) {
      e.preventDefault();
      if (e.shiftKey) outdent(id); else indent(id);
    } else if (e.key === 'Backspace' && plain && !el.textContent && !n.ch.length && id !== map.root) {
      e.preventDefault();
      removeRow(id);
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      move(id, e.key === 'ArrowUp' ? -1 : 1);
    } else if (plain && e.key === 'ArrowUp' && caret(el) === 0 && i > 0) {
      e.preventDefault();
      focus(rows[i - 1].dataset.id);
    } else if (plain && e.key === 'ArrowDown' && caret(el) === el.textContent.length && i < rows.length - 1) {
      e.preventDefault();
      focus(rows[i + 1].dataset.id, false);
    }
  }

  function onClick(e) {
    const fold = e.target.closest('[data-fold]');
    if (!fold || fold.classList.contains('is-empty')) return;
    const id = fold.closest('.mo-row').dataset.id;
    const n = map.nodes[id];
    ctx.snap();
    n.col = !n.col;
    ctx.changed();
    render();
    focus(id);
  }

  /** Pasting several lines makes several rows (nested by indentation); one line is pasted as plain text. */
  function onPaste(e) {
    const el = e.target.closest('.mo-text');
    if (!el || readOnly) return;
    e.preventDefault();
    const text = (e.clipboardData?.getData('text/plain') || '').replace(/\r/g, '');
    const trees = text.includes('\n') ? parseOutline(text) : [];
    if (trees.length < 2 && !(trees[0]?.ch.length)) { document.execCommand('insertText', false, text.replace(/\n/g, ' ')); return; }
    const id = el.closest('.mo-row').dataset.id;
    const n = map.nodes[id];
    change(() => {
      const parent = n.p ?? id;
      let index = n.p ? map.nodes[n.p].ch.indexOf(id) + 1 : undefined;
      let last = id;
      for (const t of trees) { last = M.importTree(map, t, parent, { index }); if (index != null) index += 1; }
      if (!n.t && n.p && !n.ch.length) M.removeNode(map, id);                  // pasted into an empty row: it is replaced
      return last;
    });
  }

  const onFocusIn = (e) => { const row = e.target.closest('.mo-row'); if (row) ctx.select(row.dataset.id); };
  const onFocusOut = (e) => { const row = e.target.closest('.mo-row'); if (row) touched.delete(row.dataset.id); };

  box.addEventListener('input', onInput);
  box.addEventListener('keydown', onKey);
  box.addEventListener('click', onClick);
  box.addEventListener('paste', onPaste);
  box.addEventListener('focusin', onFocusIn);
  box.addEventListener('focusout', onFocusOut);

  return {
    render, focus,
    destroy() {
      box.removeEventListener('input', onInput);
      box.removeEventListener('keydown', onKey);
      box.removeEventListener('click', onClick);
      box.removeEventListener('paste', onPaste);
      box.removeEventListener('focusin', onFocusIn);
      box.removeEventListener('focusout', onFocusOut);
      box.innerHTML = '';
    },
  };
}
