/* ============================================================================
   BLOCK HANDLE — the six-dot grip beside a block.

   • Hover a block: the grip appears in the left margin.
   • Click it: a menu (turn into, duplicate, move up / down, remove tags, delete).
   • Drag it: a line shows where the block will land; let go to drop it.
   • Keyboard: Alt+Shift+↑ / ↓ (or Mod+Shift+↑ / ↓) moves the block you are in.
   Every action is one undo step (history.js).
   Touch: on a phone or tablet the grip appears beside the block you tap, and dragging it works with a finger.
   The menu itself is shared with the "/" menu (block-menu.js).
   Look: --handle-* in css/tokens.css, .block-handle / .block-menu / .drop-line in css/editor.css.
   ========================================================================== */

import { icon } from '../core/icons.js';
import { CONFIG } from '../core/config.js';
import { matches } from '../core/keys.js';
import { blocksOf } from '../core/blockindex.js';
import { caretBlock } from './normalize.js';
import { placeBlock, stepBlock, canStep, dropTargets, deleteBlock } from './block-ops.js';
import * as store from '../core/store.js';
import { sanitizeHtml } from '../core/utils.js';
import { menuModel, renderMenu, placeMenu, runAction, placeCaret, saveSel, restoreSel } from './block-menu.js';

export function mountBlockHandle(root, history) {
  const body = root.parentElement;               // .note__body — the handle and the drop line live here
  const note = root.closest('.note');
  if (!body || !note) return () => {};

  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'block-handle';
  handle.hidden = true;
  handle.setAttribute('aria-label', 'Drag to move this block, click for the menu');
  handle.title = 'Drag to move · click for menu';
  handle.innerHTML = icon('grip', 16);
  body.append(handle);

  let current = null;   // the block the handle sits beside
  let menu = null;
  let drag = null;
  let line = null;
  let frame = 0;
  let scrollFrame = 0;

  /* ---------- Showing the handle ---------- */

  const hide = () => { if (menu || drag) return; handle.hidden = true; current = null; };

  function show(block) {
    const b = body.getBoundingClientRect();
    const r = block.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(block).lineHeight);
    const firstLine = Math.min(Number.isFinite(lh) ? lh : r.height, r.height);
    const wide = block.matches?.('[data-map-block]') ? block.shadowRoot?.querySelector('.mb') : null;   // a map block sticks out to the left of the text:
    handle.style.left = wide ? `${Math.max(2, wide.getBoundingClientRect().left - b.left - 30)}px` : '';  // the grip goes beside it, not over it
    handle.style.top = `${r.top - b.top + Math.max(0, (firstLine - 24) / 2)}px`;
    handle.hidden = false;
    current = block;
  }

  /** The block under a vertical position (deepest wins: a sub-item over its parent). */
  function blockAtY(y) {
    let hit = null;
    let best = Infinity;
    for (const el of blocksOf(root)) {
      const r = el.getBoundingClientRect();
      const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      if (d < best || (d === 0 && best === 0)) { best = d; hit = el; }
    }
    return best <= 14 ? hit : null;
  }

  function onMove(e) {
    if (menu || drag || frame) return;
    const { clientX: x, clientY: y } = e;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const r = root.getBoundingClientRect();
      const block = blockAtY(y);
      const wide = block?.matches?.('[data-map-block]') ? block.shadowRoot?.querySelector('.mb')?.getBoundingClientRect() : null;
      const left = wide ? Math.min(r.left, wide.left) : r.left;      // the pointer may travel to a grip that sits left of a wide map block
      const right = wide ? Math.max(r.right, wide.right) : r.right;
      if (x < left - 90 || x > right + 2 || y < r.top - 6 || y > r.bottom + 6) { hide(); return; }
      if (block) show(block); else hide();
    });
  }

  /* Touch: no hover, so the grip shows beside the block you tap, and goes away while you type. */
  const onTap = (e) => {
    if (e.pointerType !== 'touch') return;
    requestAnimationFrame(() => { const b = blockAtY(e.clientY) || caretBlock(root); if (b) show(b); else hide(); }); // the block under your finger
  };
  const onInputHide = () => { if (matchMedia('(pointer: coarse)').matches) hide(); };

  const onLeave = () => hide();
  const onTyping = (e) => { if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) hide(); }; // out of the way while writing

  /* ---------- The menu ---------- */

  function closeMenu(refocus = false) {
    if (!menu) return;
    menu.remove();
    menu = null;
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('scroll', closeOnScroll, true);
    if (refocus) root.focus({ preventScroll: true });
  }
  const onOutside = (e) => { if (menu && !menu.contains(e.target) && !handle.contains(e.target)) closeMenu(); };
  const closeOnScroll = (e) => { if (menu && !menu.contains(e.target)) closeMenu(); };

  function openMenu(block) {
    closeMenu();
    menu = document.createElement('div');
    menu.className = 'block-menu block-menu--handle';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = renderMenu(menuModel(block)).html;
    document.body.append(menu);
    placeMenu(menu, handle.getBoundingClientRect(), { side: 'right' });

    menu.addEventListener('click', (e) => {
      const btn = e.target.closest('.block-menu__item');
      if (btn && !btn.disabled) run(btn.dataset.act, block);
    });
    menu.addEventListener('keydown', (e) => {
      const items = [...menu.querySelectorAll('.block-menu__item:not([disabled])')];
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
      else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus(); }
      else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
      else if (e.key === 'Tab') { e.preventDefault(); closeMenu(true); }
    });
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('scroll', closeOnScroll, true);
    (menu.querySelector('.is-current') || menu.querySelector('.block-menu__item:not([disabled])'))?.focus();
  }

  /* ---------- Doing things ---------- */

  function run(act, block) {
    closeMenu();
    runAction(root, history, act, block);
    handle.hidden = true;
    if (!act.startsWith('turn:')) root.focus({ preventScroll: true });
  }

  /** A finished change from a drag or the keyboard: save, refresh the margin, and make it one undo step. */
  function finish(focusBlock) {
    root.dispatchEvent(new Event('input', { bubbles: true }));
    if (focusBlock) placeCaret(root, focusBlock);
    history.record();
  }

  /* ---------- Dragging ---------- */

  function updateSlot() {
    if (!drag?.active) return;
    let best = null;
    for (const c of dropTargets(root, drag.block)) {
      const r = c.getBoundingClientRect();
      const bias = c.tagName === 'LI' && drag.block.tagName === 'LI' ? 0.5 : 0; // inside a list beats "between two paragraphs"
      for (const [where, y] of [['before', r.top], ['after', r.bottom]]) {
        const d = Math.abs(drag.py - y) - bias;
        if (!best || d < best.d) best = { d, ref: c, where, y, r };
      }
    }
    drag.slot = best && { ref: best.ref, where: best.where };
    if (!best) { line.hidden = true; return; }
    const b = body.getBoundingClientRect();
    line.hidden = false;
    line.style.top = `${best.y - b.top - 1}px`;
    line.style.left = `${best.r.left - b.left}px`;
    line.style.width = `${best.r.width}px`;
  }

  function autoScroll() {
    if (!drag?.active) return;
    const scroller = root.closest('.pane__scroll, .card__scroll') || document.scrollingElement;
    const r = scroller.getBoundingClientRect();
    const edge = 56;
    let dy = 0;
    if (drag.py < r.top + edge) dy = -Math.ceil((r.top + edge - drag.py) / 4);
    else if (drag.py > r.bottom - edge) dy = Math.ceil((drag.py - (r.bottom - edge)) / 4);
    if (dy) { scroller.scrollTop += dy; updateSlot(); }
    scrollFrame = requestAnimationFrame(autoScroll);
  }

  function startDrag() {
    drag.active = true;
    document.body.classList.add('is-block-dragging');
    drag.block.classList.add('is-dragging');
    line = document.createElement('div');
    line.className = 'drop-line';
    line.hidden = true;
    body.append(line);
    document.addEventListener('keydown', onDragKey, true);
    scrollFrame = requestAnimationFrame(autoScroll);
  }

  /* Dragging a block onto a note in the sidebar moves the block into that note (at its end) */
  let hoverRow = null;
  const noteRowAt = (x, y) => {
    const row = document.elementFromPoint(x, y)?.closest('#sidebar .tree-note');
    const id = row?.querySelector('a.tree-link')?.getAttribute('href')?.match(/^#\/note\/([^/]+)/)?.[1];
    return id ? { row, id } : null;
  };
  function moveBlockToNote(block, noteId) {
    const target = store.getNote(noteId);
    if (!target || location.hash.startsWith(`#/note/${noteId}`)) return;
    const holder = document.createElement('div');
    if (block.tagName === 'LI') { const list = block.parentElement.cloneNode(false); list.append(block.cloneNode(true)); holder.append(list); }
    else holder.append((block.tagName === 'SUMMARY' ? block.parentElement : block).cloneNode(true));
    holder.querySelectorAll('[class]').forEach((n) => n.removeAttribute('class'));
    history.commit();
    store.updateNoteContent(noteId, sanitizeHtml(target.html || '') + sanitizeHtml(holder.innerHTML));
    deleteBlock(root, block);
    finish(null);
    window.dispatchEvent(new CustomEvent('app-toast', { detail: `Moved to “${target.title || 'Untitled'}”` }));
  }

  function endDrag() {
    hoverRow?.classList.remove('is-drop-target');
    hoverRow = null;
    cancelAnimationFrame(scrollFrame);
    document.removeEventListener('keydown', onDragKey, true);
    document.body.classList.remove('is-block-dragging');
    drag?.block.classList.remove('is-dragging');
    line?.remove();
    line = null;
  }

  function cancelDrag() { if (!drag) return; endDrag(); drag = null; handle.hidden = true; }
  const onDragKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelDrag(); } };

  const onPointerDown = (e) => {
    if (e.button !== 0 || !current) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    drag = { block: current, x: e.clientX, y: e.clientY, px: e.clientX, py: e.clientY, active: false, slot: null };
  };
  const onPointerMove = (e) => {
    if (!drag) return;
    drag.px = e.clientX; drag.py = e.clientY;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
      startDrag();
    }
    updateSlot();
    const over = noteRowAt(e.clientX, e.clientY);                 // over a note in the sidebar?
    if (hoverRow !== (over?.row || null)) { hoverRow?.classList.remove('is-drop-target'); hoverRow = over?.row || null; hoverRow?.classList.add('is-drop-target'); }
    drag.toNote = over?.id || null;
    if (over) { drag.slot = null; if (line) line.hidden = true; }
  };
  const onPointerUp = () => {
    if (!drag) return;
    const d = drag;
    endDrag();
    drag = null;
    if (!d.active) { openMenu(d.block); return; }
    if (d.toNote) { moveBlockToNote(d.block, d.toNote); handle.hidden = true; return; }
    if (!d.slot) { handle.hidden = true; return; }
    history.commit();
    const sel = saveSel();
    if (placeBlock(root, d.block, d.slot.ref, d.slot.where)) { restoreSel(sel); finish(null); }
    handle.hidden = true;
  };

  /* ---------- Keyboard: move the block you are in ---------- */

  const onKeyDown = (e) => {
    const SK = CONFIG.shortcuts;
    const up = matches(e, SK['block.moveUp']) || matches(e, SK['block.moveUp.alt']);
    const down = matches(e, SK['block.moveDown']) || matches(e, SK['block.moveDown.alt']);
    if (!up && !down) return;
    e.preventDefault();
    const block = caretBlock(root);
    if (!block || !canStep(block, up ? -1 : 1)) return;
    history.commit();
    const sel = saveSel();
    stepBlock(block, up ? -1 : 1);
    restoreSel(sel);
    finish(null);
    block.scrollIntoView({ block: 'nearest' });
  };

  /* ---------- Wiring ---------- */

  note.addEventListener('mousemove', onMove);
  note.addEventListener('mouseleave', onLeave);
  root.addEventListener('keydown', onTyping);
  root.addEventListener('keydown', onKeyDown);
  root.addEventListener('pointerup', onTap);
  root.addEventListener('input', onInputHide);
  handle.addEventListener('mousedown', (e) => e.preventDefault()); // keep the caret where it is
  handle.addEventListener('pointerdown', onPointerDown);
  handle.addEventListener('pointermove', onPointerMove);
  handle.addEventListener('pointerup', onPointerUp);
  handle.addEventListener('pointercancel', cancelDrag);

  return () => {
    cancelAnimationFrame(frame);
    cancelDrag();
    closeMenu();
    note.removeEventListener('mousemove', onMove);
    note.removeEventListener('mouseleave', onLeave);
    root.removeEventListener('keydown', onTyping);
    root.removeEventListener('keydown', onKeyDown);
    root.removeEventListener('pointerup', onTap);
    root.removeEventListener('input', onInputHide);
    handle.remove();
  };
}
