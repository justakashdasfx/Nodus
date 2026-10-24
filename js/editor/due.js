/* ============================================================================
   DUE DATES — a date on a checklist item.

   • Type "@" in a checklist item: a small menu offers Today, Tomorrow, Next week… Keep typing to narrow it
     ("@fri", "@3 nov", "@in 2 weeks"); ↑ ↓ choose, Enter or Tab applies, Esc closes. The typed "@…" is removed.
   • Click the date on the right of an item, or press Ctrl/Cmd+Shift+D in the item, to change or remove it.
   • The date is saved on the item (data-due). The label next to it (Today, Fri, 3 Nov…) is drawn by CSS from
     data-due-label, which is worked out here and never saved. Look: css/tokens.css → section 17.
   Shortcut: config.js → shortcuts['task.due'].
   ========================================================================== */

import { CONFIG } from '../core/config.js';
import { icon } from '../core/icons.js';
import { matches } from '../core/keys.js';
import { DUE_RE, escapeHtml } from '../core/utils.js';
import { parseDue, labelFor, dueState, longLabel, presets } from '../core/dates.js';
import { pickDate } from '../ui/calendar.js';
import { currentLi } from './lists.js';

/** Writes the label and state next to every dated item (and clears them from items that lost their date). */
export function refreshDue(root) {
  const now = new Date();
  root.querySelectorAll('li[data-due]').forEach((li) => {
    const due = li.getAttribute('data-due');
    if (!DUE_RE.test(due)) { li.removeAttribute('data-due'); return; }
    li.setAttribute('data-due-label', labelFor(due, now));
    li.setAttribute('data-due-state', dueState(due, now));
  });
  root.querySelectorAll('li[data-due-label]:not([data-due])').forEach((li) => {
    li.removeAttribute('data-due-label');
    li.removeAttribute('data-due-state');
  });
}

const isTodoItem = (li) => !!li && li.parentElement?.dataset.type === 'todo';

export function mountDue(root, { editable = true } = {}) {
  refreshDue(root);
  const onVisible = () => { if (document.visibilityState === 'visible') refreshDue(root); };   // a new day → "Tomorrow" becomes "Today"
  document.addEventListener('visibilitychange', onVisible);
  if (!editable) return () => document.removeEventListener('visibilitychange', onVisible);

  let menu = null;
  let ctx = null;      // { li, node, start, end, query, edit }
  let items = [];
  let active = 0;

  const notify = () => root.dispatchEvent(new Event('input', { bubbles: true }));   // autosave + undo, like ticking a box

  /* ---------- Applying ---------- */

  function setDue(li, iso) {
    if (!li?.isConnected) return;
    if (iso) li.setAttribute('data-due', iso); else li.removeAttribute('data-due');
    refreshDue(root);
    notify();
  }

  /** Removes the typed "@query" (and the space before it when it ends the item). */
  function strip(c) {
    if (!c.node?.isConnected) return;
    const r = document.createRange();
    r.setStart(c.node, c.start);
    r.setEnd(c.node, c.end);
    r.deleteContents();
    let at = c.start;
    if (at === c.node.nodeValue.length && /[\s\u00a0]$/.test(c.node.nodeValue)) {
      c.node.nodeValue = c.node.nodeValue.replace(/[\s\u00a0]+$/, '');
      at = c.node.nodeValue.length;
    }
    if (!c.li.textContent && !c.li.querySelector('br')) c.li.append(document.createElement('br'));
    const sel = getSelection();
    sel.collapse(c.node, at);
  }

  /** "Pick a date…" opens a calendar (ui/calendar.js). Typing a date still works with "@" in the item. */
  async function askDate(li) {
    const r = li.getBoundingClientRect();
    const iso = await pickDate({ value: li.getAttribute('data-due') || '', rect: { left: r.right - 280, top: r.top, bottom: r.top + 28 } });
    root.focus({ preventScroll: true });
    if (iso !== null) setDue(li, iso);
  }

  /* ---------- The menu ---------- */

  function close() {
    if (!menu) return;
    menu.remove();
    menu = null;
    ctx = null;
    items = [];
    document.removeEventListener('pointerdown', onOutside, true);
    window.removeEventListener('resize', close);
    window.removeEventListener('scroll', close, true);
  }
  const onOutside = (e) => { if (menu && !menu.contains(e.target)) close(); };

  function build() {
    const now = new Date();
    if (ctx.edit) {
      const list = presets(now).filter(p => p.top).map(p => ({ iso: p.iso, label: p.label, hint: p.hint }));
      list.push({ pick: true, label: 'Pick a date…', hint: '' });
      if (ctx.li.hasAttribute('data-due')) list.push({ remove: true, label: 'Remove date', hint: '' });
      return list;
    }
    const q = ctx.query.replace(/\u00a0/g, ' ').trim().toLowerCase();
    const parsed = q ? parseDue(q, now) : null;
    const list = [];
    if (parsed) list.push({ iso: parsed, label: longLabel(parsed), hint: 'this date' });
    for (const p of presets(now)) {
      if (p.iso === parsed) continue;
      const shown = q ? (p.label.toLowerCase().startsWith(q) || p.keys.some(k => k.startsWith(q))) : p.top;
      if (shown) list.push({ iso: p.iso, label: p.label, hint: p.hint });
    }
    if (!q) list.push({ pick: true, label: 'Pick a date…', hint: '' });
    return list;
  }

  function paint() {
    menu.innerHTML = `<div class="block-menu__title">Due date</div>${items.map((it, i) =>
      `<button type="button" role="menuitem" class="block-menu__item${i === active ? ' is-active' : ''}${it.remove ? ' is-danger' : ''}" data-i="${i}">`
      + `<span class="block-menu__icon">${icon(it.remove ? 'close' : it.pick ? 'calendar' : 'clock', 16)}</span>`
      + `<span class="block-menu__label">${escapeHtml(it.label)}</span>${it.hint ? `<span class="block-menu__hint">${escapeHtml(it.hint)}</span>` : ''}</button>`).join('')}`;
  }

  function place(rect) {
    const w = menu.offsetWidth;
    const h = menu.offsetHeight;
    let top = rect.bottom + 6;
    if (top + h > innerHeight - 8) top = Math.max(8, rect.top - h - 6);
    menu.style.top = `${top}px`;
    menu.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - w - 8))}px`;
  }

  function show(rect) {
    items = build();
    if (!items.length) { close(); return; }
    active = Math.min(active, items.length - 1);
    if (!menu) {
      menu = document.createElement('div');
      menu.className = 'block-menu due-menu';
      menu.setAttribute('role', 'menu');
      menu.addEventListener('mousedown', (e) => e.preventDefault());   // keep the cursor in the note
      menu.addEventListener('click', (e) => {
        const b = e.target.closest('.block-menu__item');
        if (b) choose(+b.dataset.i);
      });
      document.body.append(menu);
      document.addEventListener('pointerdown', onOutside, true);
      window.addEventListener('resize', close);
      window.addEventListener('scroll', close, true);
    }
    paint();
    place(rect);
  }

  function choose(i) {
    const it = items[i];
    const c = ctx;
    if (!it || !c) return;
    close();
    if (!c.edit) strip(c);
    if (it.pick) askDate(c.li);
    else if (it.remove) setDue(c.li, '');
    else setDue(c.li, it.iso);
  }

  /* ---------- Opening it ---------- */

  function caretRect(li) {
    const sel = getSelection();
    const r = sel.rangeCount ? sel.getRangeAt(0).getClientRects()[0] : null;
    return r && (r.width || r.height) ? r : li.getBoundingClientRect();
  }

  /** "@" typed in a checklist item. */
  function scan() {
    const sel = getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) { close(); return; }
    const li = currentLi(root);
    const node = sel.anchorNode;
    if (!isTodoItem(li) || !node || node.nodeType !== 3 || !li.contains(node)) { close(); return; }
    const before = node.nodeValue.slice(0, sel.anchorOffset);
    const m = /(?:^|[\s\u00a0])@([^@\n]{0,24})$/.exec(before);
    if (!m) { close(); return; }
    const query = m[1];
    ctx = { li, node, start: sel.anchorOffset - query.length - 1, end: sel.anchorOffset, query, edit: false };
    show(caretRect(li));
  }

  /** Change or remove the date of an item (the chip, or Ctrl/Cmd+Shift+D). */
  function openEdit(li, rect) {
    close();
    ctx = { li, edit: true };
    active = 0;
    show(rect);
  }

  /* ---------- Events ---------- */

  const onInput = (e) => {
    if (e.isComposing) return;
    if (e.inputType === 'insertParagraph') dropCopiedDate();
    if (ctx?.edit) { close(); return; }
    scan();
  };

  /** Enter copies the item's attributes onto the new item: the new one must not inherit the date. */
  function dropCopiedDate() {
    const cur = currentLi(root);
    if (!cur || !cur.hasAttribute('data-due')) return;
    const prev = cur.previousElementSibling;
    const same = prev?.tagName === 'LI' && prev.getAttribute('data-due') === cur.getAttribute('data-due');
    if (!same) return;
    const newer = (cur.textContent.trim() && !prev.textContent.trim()) ? prev : cur;   // Enter at the very start makes the empty item above
    newer.removeAttribute('data-due');
    refreshDue(root);
  }

  const onKey = (e) => {
    if (menu) {
      const k = e.key;
      if (k === 'ArrowDown' || k === 'ArrowUp') { active = (active + (k === 'ArrowDown' ? 1 : -1) + items.length) % items.length; paint(); }
      else if (k === 'Enter' || k === 'Tab') choose(active);
      else if (k === 'Escape') close();
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (matches(e, CONFIG.shortcuts['task.due'])) {
      const li = currentLi(root);
      if (!isTodoItem(li)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const r = li.getBoundingClientRect();
      openEdit(li, { left: r.right - 160, top: r.top, bottom: r.top + 28 });
    }
  };

  /** A click in the space reserved for the date, at the right end of the item's first line. */
  const onClick = (e) => {
    const li = e.target === e.target.closest?.('li[data-due]') ? e.target : null;
    if (!li || !root.contains(li) || !isTodoItem(li)) return;
    const r = li.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(li).paddingRight) || 0;
    if (e.clientX < r.right - pad || e.clientY - r.top > 40) return;
    e.preventDefault();
    openEdit(li, { left: r.right - pad, top: r.top, bottom: r.top + 28 });
  };

  const onBlur = () => setTimeout(() => { if (menu && !root.contains(document.activeElement) && !menu.contains(document.activeElement)) close(); }, 0);

  root.addEventListener('keydown', onKey, true);   // capture: the menu's keys never reach the editor
  root.addEventListener('input', onInput);
  root.addEventListener('click', onClick);
  root.addEventListener('focusout', onBlur);

  return () => {
    close();
    root.removeEventListener('keydown', onKey, true);
    root.removeEventListener('input', onInput);
    root.removeEventListener('click', onClick);
    root.removeEventListener('focusout', onBlur);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
