/* ============================================================================
   BLOCK SELECTION — select whole blocks, then act on them together.

   • Drag in the empty space beside the writing column (left or right of the text, or above / below it): a frame appears and
     every block it touches is selected. A plain click there selects the block at that height.
   • Shift+click on a block extends the selection from the first one. Esc, or a click anywhere else, clears it.
   • A bar over the selection: Copy · Cut · Duplicate · Turn into · Tag · ↑ ↓ (move as a group) · Delete.
     Keys: Ctrl/Cmd+C, Ctrl/Cmd+X, Ctrl/Cmd+D, Delete / Backspace, Alt+Shift+↑↓ (your block-move keys), Esc.
   • "Block" here = a top-level block: a paragraph, heading, quote, code block, divider, callout, a whole list or a whole toggle.
     Turn into and Tag reach the lines inside a list.
   • Dragging INSIDE the text still selects text, across blocks too — nothing changes there.
   Look: .block-sel-bar, .block-band, .is-block-selected in css/editor.css · colours: --block-select-* in css/tokens.css.
   ========================================================================== */

import { CONFIG } from '../core/config.js';
import { icon } from '../core/icons.js';
import { matches } from '../core/keys.js';
import { htmlToText, parseTags } from '../core/utils.js';
import * as modal from '../ui/modal.js';
import { idFactory } from './block-ops.js';
import { turnInto, renderMenu, placeMenu } from './block-menu.js';

const SK = CONFIG.shortcuts;
const SELECTED = 'is-block-selected';
const NO_START = '.editor, .block-handle, button, a, input, select, textarea, .tag-rail, .note__bar, .block-menu, .block-sel-bar, .code-bar, .find-bar, .calendar';
const toast = (m) => window.dispatchEvent(new CustomEvent('app-toast', { detail: m }));

export function mountBlockSelect(root, { history }) {
  const scroller = root.closest('.pane__scroll, .card__scroll');
  if (!scroller) return () => {};

  let sel = [];          // selected top-level blocks, in document order
  let anchor = null;     // the block a Shift+click extends from
  let drag = null;       // { x, y, top, moved, extend, base, last }
  let menu = null;
  let raf = 0;

  const units = () => [...root.children].filter((c) => c.nodeType === 1);
  const notify = () => root.dispatchEvent(new Event('input', { bubbles: true }));

  /* ---------- The bar ---------- */

  const bar = document.createElement('div');
  bar.className = 'block-sel-bar';
  bar.hidden = true;
  bar.innerHTML = `<span class="block-sel-bar__count"></span>
    <button type="button" data-b="copy">Copy</button>
    <button type="button" data-b="cut">Cut</button>
    <button type="button" data-b="dup">Duplicate</button>
    <button type="button" data-b="turn">Turn into ${icon('caret', 12)}</button>
    <button type="button" data-b="tag">${icon('tag', 14)}<span>Tag</span></button>
    <button type="button" data-b="up" aria-label="Move up" title="Move up">${icon('arrowUp', 14)}</button>
    <button type="button" data-b="down" aria-label="Move down" title="Move down">${icon('arrowDown', 14)}</button>
    <button type="button" data-b="del" class="is-danger" aria-label="Delete" title="Delete">${icon('trash', 14)}</button>`;
  document.body.append(bar);
  const countEl = bar.querySelector('.block-sel-bar__count');

  function placeBar() {
    if (!sel.length) { bar.hidden = true; return; }
    const a = sel[0].getBoundingClientRect();
    const b = sel[sel.length - 1].getBoundingClientRect();
    const s = scroller.getBoundingClientRect();
    if (b.bottom < s.top || a.top > s.bottom) { bar.style.visibility = 'hidden'; return; }
    bar.style.visibility = '';
    bar.hidden = false;
    const h = bar.offsetHeight;
    let top = a.top - h - 8;
    if (top < s.top + 4) top = Math.min(b.bottom + 8, s.bottom - h - 4);
    const left = Math.max(8, Math.min(a.left, innerWidth - bar.offsetWidth - 8));
    bar.style.top = `${Math.max(top, 4)}px`;
    bar.style.left = `${left}px`;
  }

  function setSel(list) {
    for (const u of units()) u.classList.remove(SELECTED);
    sel = list.filter((u) => u.isConnected);
    for (const u of sel) u.classList.add(SELECTED);
    countEl.textContent = `${sel.length} ${sel.length === 1 ? 'block' : 'blocks'}`;
    closeMenu();
    placeBar();
    document.body.classList.toggle('has-block-selection', sel.length > 0);
  }
  function clear() { anchor = null; setSel([]); }

  const rangeBetween = (a, b) => {
    const all = units();
    const i = all.indexOf(a); const j = all.indexOf(b);
    return i < 0 || j < 0 ? [] : all.slice(Math.min(i, j), Math.max(i, j) + 1);
  };
  const unitOf = (node) => { let t = node?.nodeType === 1 ? node : node?.parentElement; while (t && t.parentElement !== root) t = t.parentElement; return t || null; };

  /** Keeps the keyboard working without a text caret. */
  function focusQuietly() {
    root.focus({ preventScroll: true });
    getSelection().removeAllRanges();
  }

  /* ---------- Dragging a frame ---------- */

  const band = document.createElement('div');
  band.className = 'block-band';
  band.hidden = true;
  document.body.append(band);

  function updateDrag(e) {
    const s = scroller.getBoundingClientRect();
    const y0 = drag.y + (drag.top - scroller.scrollTop);        // where the drag started, after any scrolling
    const top = Math.min(y0, e.clientY);
    const bottom = Math.max(y0, e.clientY);
    const left = Math.min(drag.x, e.clientX);
    const right = Math.max(drag.x, e.clientX);
    band.hidden = false;
    band.style.left = `${left}px`;
    band.style.width = `${right - left}px`;
    band.style.top = `${Math.max(top, s.top)}px`;
    band.style.height = `${Math.max(0, Math.min(bottom, s.bottom) - Math.max(top, s.top))}px`;
    const hit = units().filter((u) => { const r = u.getBoundingClientRect(); return r.bottom >= top && r.top <= bottom; });
    const merged = drag.base.length ? [...new Set([...drag.base, ...hit])] : hit;
    setSel(units().filter((u) => merged.includes(u)));
    anchor = sel[0] || null;
  }

  function autoscroll() {
    if (!drag?.moved) return;
    const s = scroller.getBoundingClientRect();
    const y = drag.last.clientY;
    if (y < s.top + 36) scroller.scrollTop -= 14; else if (y > s.bottom - 36) scroller.scrollTop += 14;
    else { raf = requestAnimationFrame(autoscroll); return; }
    updateDrag(drag.last);
    raf = requestAnimationFrame(autoscroll);
  }

  function onMove(e) {
    if (!drag) return;
    drag.last = e;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
    if (!drag.moved) { drag.moved = true; getSelection().removeAllRanges(); cancelAnimationFrame(raf); raf = requestAnimationFrame(autoscroll); }
    updateDrag(e);
  }

  function onUp(e) {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    cancelAnimationFrame(raf);
    band.hidden = true;
    const d = drag;
    drag = null;
    if (!d) return;
    if (!d.moved) {                                              // a click in the empty space: the block at that height
      const hit = units().find((u) => { const r = u.getBoundingClientRect(); return e.clientY >= r.top - 4 && e.clientY <= r.bottom + 4; });
      if (!hit) { clear(); return; }
      if (d.extend && anchor) setSel(rangeBetween(anchor, hit));
      else { anchor = hit; setSel([hit]); }
    }
    if (sel.length) focusQuietly();
  }

  /* ---------- Starting a selection ---------- */

  function onDocDown(e) {
    if (e.button !== 0) return;
    if (e.target.closest('.block-sel-bar, .block-menu')) return;

    // Shift+click on a block while blocks are selected: extend
    if (sel.length && e.shiftKey && root.contains(e.target)) {
      const u = unitOf(e.target);
      if (u) { e.preventDefault(); setSel(rangeBetween(anchor || sel[0], u)); focusQuietly(); return; }
    }

    // The empty space beside the column
    const empty = scroller.contains(e.target) && !e.target.closest(NO_START) && e.target.isConnected;
    if (empty) {
      e.preventDefault();                                        // no text selection, no lost focus
      drag = { x: e.clientX, y: e.clientY, top: scroller.scrollTop, moved: false, extend: e.shiftKey, base: e.shiftKey ? [...sel] : [], last: e };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      return;
    }
    if (sel.length) clear();                                     // any other click lets go
  }

  /* ---------- What you can do ---------- */

  function copyData() {
    const html = sel.map((u) => {
      const c = u.cloneNode(true);
      for (const el of [c, ...c.querySelectorAll('*')]) { el.classList?.remove(SELECTED, 'is-active', 'is-target'); if (el.getAttribute?.('class') === '') el.removeAttribute('class'); }
      return c.outerHTML;
    }).join('');
    return { html, text: htmlToText(html, { markers: true }) };
  }

  async function copy() {
    const { html, text } = copyData();
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
    } catch {
      try { await navigator.clipboard.writeText(text); } catch { toast('Could not copy'); return false; }
    }
    return true;
  }

  /* The highlight class is not part of the note: take it off while the undo history looks at the page */
  const marks = (on) => { for (const u of sel) u.classList.toggle(SELECTED, on); };
  const commit = () => { marks(false); commit(); marks(true); };
  const finish = () => { marks(false); notify(); history.record(); marks(true); };

  function remove() {
    if (!sel.length) return;
    commit();
    const last = sel[sel.length - 1];
    const neighbour = last.nextElementSibling || sel[0].previousElementSibling;
    for (const u of sel) u.remove();
    if (!root.children.length) {
      const p = document.createElement('p');
      p.setAttribute('data-bid', idFactory(root)());
      p.innerHTML = '<br>';
      root.append(p);
    }
    clear();
    finish();
    const at = (neighbour && neighbour.isConnected ? neighbour : root.firstElementChild);
    if (at) { const r = document.createRange(); r.selectNodeContents(at); r.collapse(true); root.focus({ preventScroll: true }); getSelection().removeAllRanges(); getSelection().addRange(r); }
  }

  async function cut() { if (await copy()) { remove(); toast('Cut'); } }

  function duplicate() {
    commit();
    const makeId = idFactory(root);
    let ref = sel[sel.length - 1];
    const copies = [];
    for (const u of sel) {
      const c = u.cloneNode(true);
      for (const el of [c, ...c.querySelectorAll('[data-bid]')]) {
        if (el.hasAttribute('data-bid')) el.setAttribute('data-bid', makeId());
        el.removeAttribute('data-tags');
        el.classList.remove(SELECTED, 'is-active', 'is-target');
      }
      ref.after(c);
      ref = c;
      copies.push(c);
    }
    anchor = copies[0];
    setSel(copies);
    finish();
  }

  function move(dir) {
    if (!sel.length) return;
    const first = sel[0]; const last = sel[sel.length - 1];
    const sib = dir < 0 ? first.previousElementSibling : last.nextElementSibling;
    if (!sib) return;
    commit();
    if (dir < 0) sib.before(...sel); else sib.after(...sel);
    placeBar();
    finish();
  }

  /** The lines inside the selection that can be turned or tagged: list items, a toggle's title, or the block itself. */
  const leaves = (what) => sel.flatMap((u) => {
    if (/^(UL|OL)$/.test(u.tagName)) return [...u.querySelectorAll('li')];
    if (u.tagName === 'DETAILS') return what === 'tag' ? [u.querySelector(':scope > summary')].filter(Boolean) : [];
    if (u.tagName === 'HR') return [];
    return [u];
  });

  function turn(kind) {
    const ids = leaves('turn').map((b) => b.getAttribute('data-bid')).filter(Boolean);
    if (!ids.length) return;
    commit();
    for (const id of ids) {
      const b = root.querySelector(`[data-bid="${id}"]`);
      if (b) turnInto(root, b, kind, { place: true });
    }
    const tops = new Set(ids.map((id) => unitOf(root.querySelector(`[data-bid="${id}"]`))).filter(Boolean));
    const now = units().filter((u) => tops.has(u));
    anchor = now[0] || null;
    setSel(now);
    focusQuietly();
    finish();
  }

  async function tag() {
    const value = await modal.prompt({ title: 'Tag these blocks', message: `Type one or more tags, e.g. work idea. They are added to ${sel.length === 1 ? 'the block' : `all ${sel.length} blocks`}.`, placeholder: 'work idea', confirmLabel: 'Add tags' });
    if (value == null) return;
    const add = parseTags(String(value).replace(/#/g, ' '));
    if (!add.length) return;
    commit();
    for (const b of leaves('tag')) {
      const have = parseTags(b.getAttribute('data-tags'));
      b.setAttribute('data-tags', [...new Set([...have, ...add])].join(' '));
    }
    finish();
    focusQuietly();
  }

  /* ---------- Turn-into menu ---------- */

  function closeMenu() {
    menu?.remove();
    menu = null;
    document.removeEventListener('mousedown', onMenuOutside, true);
  }
  const onMenuOutside = (e) => { if (menu && !menu.contains(e.target) && !e.target.closest('[data-b="turn"]')) closeMenu(); };

  function openTurnMenu(button) {
    if (menu) { closeMenu(); return; }
    const items = CONFIG.blockTypes.filter(([k]) => k !== 'divider' && k !== 'toggle').map(([k, label, , words]) => ({ act: 'turn:' + k, label, words }));
    menu = document.createElement('div');
    menu.className = 'block-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = renderMenu([{ title: 'Turn into', items }]).html;
    menu.addEventListener('mousedown', (e) => e.preventDefault());
    menu.addEventListener('click', (e) => {
      const it = e.target.closest('[data-act]');
      if (!it) return;
      closeMenu();
      turn(it.dataset.act.slice(5));
    });
    document.body.append(menu);
    placeMenu(menu, button.getBoundingClientRect());
    document.addEventListener('mousedown', onMenuOutside, true);
  }

  /* ---------- Events ---------- */

  bar.addEventListener('mousedown', (e) => e.preventDefault());       // keep the keyboard focus where it is
  bar.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-b]');
    if (!b || !sel.length) return;
    switch (b.dataset.b) {
      case 'copy': if (await copy()) toast('Copied'); break;
      case 'cut': await cut(); break;
      case 'dup': duplicate(); break;
      case 'turn': openTurnMenu(b); break;
      case 'tag': await tag(); break;
      case 'up': move(-1); break;
      case 'down': move(1); break;
      case 'del': remove(); break;
      default:
    }
  });

  function onKey(e) {
    if (!sel.length || e.isComposing) return;
    const ae = document.activeElement;
    if (ae !== root && ae !== document.body && !bar.contains(ae)) return;       // typing in a dialog or the search box
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    const eat = () => { e.preventDefault(); e.stopPropagation(); };
    if (e.key === 'Escape') { eat(); clear(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { eat(); remove(); return; }
    if (mod && !e.shiftKey && !e.altKey && k === 'c') { eat(); copy().then((ok) => ok && toast('Copied')); return; }
    if (mod && !e.shiftKey && !e.altKey && k === 'x') { eat(); cut(); return; }
    if (mod && !e.shiftKey && !e.altKey && k === 'd') { eat(); duplicate(); return; }
    if (matches(e, SK['block.moveUp']) || matches(e, SK['block.moveUp.alt'])) { eat(); move(-1); return; }
    if (matches(e, SK['block.moveDown']) || matches(e, SK['block.moveDown.alt'])) { eat(); move(1); return; }
    if (mod || e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta' || e.key.startsWith('Arrow') || e.key === 'Tab') return;
    // anything else you type: let go of the selection and carry on writing after the last selected block
    const at = sel[sel.length - 1];
    clear();
    const r = document.createRange();
    r.selectNodeContents(at); r.collapse(false);
    root.focus({ preventScroll: true });
    getSelection().removeAllRanges(); getSelection().addRange(r);
  }

  const onScroll = () => placeBar();
  document.addEventListener('mousedown', onDocDown, true);
  document.addEventListener('keydown', onKey, true);
  scroller.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  root.addEventListener('input', () => { if (sel.length && !sel.every((u) => u.isConnected)) clear(); });

  return () => {
    cancelAnimationFrame(raf);
    document.removeEventListener('mousedown', onDocDown, true);
    document.removeEventListener('keydown', onKey, true);
    scroller.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    closeMenu();
    document.body.classList.remove('has-block-selection');
    for (const u of units()) u.classList.remove(SELECTED);
    bar.remove(); band.remove();
  };
}
