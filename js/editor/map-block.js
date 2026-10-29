/* ============================================================================
   MAP BLOCK — a mind map living inside a note ("/" → Mind map).

   In the note it is saved as an empty shell:   <div data-map-block="MAP-ID" data-map-h="380" data-bid="…"></div>
   (data-map-block="" = no map chosen yet). Everything you see is drawn into a shadow root, so none of it is saved in the note,
   counted as its text, searched or copied — it follows the map itself, so a change to the map shows up here.

   • Empty block      name on the left · [Add existing] [Create new] on the right. "Create new" makes a map in the note's notebook
                      and opens it as a full page.
   • With a map       its name (click to open) and an Open button · the map itself, wider than the text column: drag to move it,
                      Ctrl/⌘ + wheel or the buttons to zoom, double-click to open. You can look around but not edit: editing is the full page.
                      Drag the bar under it to change its height (remembered per block).
   • ⋯ menu (on hover): Open map · Fit to view · Choose another map · Delete block
   • A map that was deleted shows "This mind map no longer exists" with Choose another / Remove block.
   Look: the CSS string at the bottom. How much wider than the text: EMBED_BLEED. Heights: H_*.
   ========================================================================== */

import * as store from '../core/store.js';
import { escapeHtml } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { go } from '../core/router.js';
import { ownText } from '../core/blockindex.js';
import { countNodes } from '../maps/model.js';
import { mountPreview } from '../maps/preview.js';
import { renderMenu, placeMenu } from './block-menu.js';
import { idFactory } from './block-ops.js';
import { appSheets } from './thread-block.js';

const EMBED_BLEED = 170;                       // px the map may stick out on each side of the text column (less if the page is narrow)
const H_DEFAULT = 380, H_MIN = 180, H_MAX = 900;   // height of the map area
const STOP = ['keydown', 'keyup', 'keypress', 'beforeinput', 'input', 'paste', 'cut', 'copy', 'compositionstart', 'compositionend'];
const KEEP_OUT = ['pointerdown', 'mousedown', 'dragstart', 'selectstart'];   // dragging the map is not selecting text in the note

/* ---------- Putting a map block into a note ---------- */

/** "/" → Mind map: an empty line becomes the block, otherwise it goes below the line. A Text line always follows it. */
export function insertMapBlock(root, block) {
  const el = document.createElement('div');
  el.setAttribute('data-map-block', '');
  el.setAttribute('data-bid', idFactory(root)());
  el.contentEditable = 'false';
  const p = document.createElement('p');
  p.setAttribute('data-bid', idFactory(root)());
  p.innerHTML = '<br>';
  let top = block;
  while (top.parentElement && top.parentElement !== root) top = top.parentElement;
  const blank = top === block && block.tagName === 'P' && !block.hasAttribute('data-callout') && !ownText(block);
  if (blank) block.replaceWith(el); else top.after(el);
  el.after(p);
  const r = document.createRange();
  r.selectNodeContents(p);
  r.collapse(true);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
}

/* ---------- Mounting ---------- */

let own = null;
const ownSheet = () => { if (!own) { own = new CSSStyleSheet(); own.replaceSync(CSS); } return own; };

const heightOf = (el) => { const n = Number(el.getAttribute('data-map-h')); return n >= H_MIN && n <= H_MAX ? n : H_DEFAULT; };
const scrollerOf = (el) => { for (let p = el.parentElement; p; p = p.parentElement) if (/(auto|scroll)/.test(getComputedStyle(p).overflowY)) return p; return null; };

export function mountMapBlocks(root, { readOnly = false, history = null } = {}) {
  const notify = () => root.dispatchEvent(new Event('input', { bubbles: true }));
  const handles = new Set();
  const hostNote = () => root.dataset.noteId || '';
  const changed = (fn) => { history?.commit(); fn(); notify(); history?.record(); };

  const mapNote = (id) => { const n = id ? store.getNote(id) : null; return n && n.type === 'map' && !n.deletedAt ? n : null; };
  const sigOf = (id) => { const n = id ? store.getNote(id) : null; return n ? `${n.type}|${n.deletedAt || ''}|${n.updatedAt}` : ''; };

  function ensure(el) {
    if (el._mb || !el.isConnected) return;
    el.contentEditable = 'false';
    const shadow = el.shadowRoot || el.attachShadow({ mode: 'open' });
    if ('adoptedStyleSheets' in shadow) shadow.adoptedStyleSheets = [...appSheets(), ownSheet()];
    for (const t of STOP) shadow.addEventListener(t, (e) => e.stopPropagation());       // typing in the block is not typing in the note
    const h = { el, shadow, preview: null, ro: null, ok: false, sig: '' };
    el._mb = h;
    handles.add(h);
    paint(h);
  }

  /** The map sticks out a little on both sides of the text column (never past the edge of the page). */
  function widen(h) {
    const wrap = h.shadow.querySelector('.mb');
    const scroller = scrollerOf(h.el);
    if (!wrap || !scroller) return;
    const room = Math.max(0, (scroller.clientWidth - h.el.clientWidth) / 2 - 16);
    wrap.style.marginInline = `${-Math.min(EMBED_BLEED, room)}px`;
  }

  function release(h) { h.preview?.destroy(); h.preview = null; h.ro?.disconnect(); h.ro = null; }

  function paint(h) {
    release(h);
    const { el, shadow } = h;
    const id = el.getAttribute('data-map-block') || '';
    const note = mapNote(id);
    h.ok = !!note;
    h.sig = sigOf(id);
    shadow.replaceChildren();
    const wrap = document.createElement('div');
    wrap.className = 'tb mb';
    if (readOnly) wrap.dataset.ro = '';
    const menuBtn = `<button type="button" class="btn btn--icon tb__menu" data-mb="menu" aria-label="Mind map options" aria-haspopup="menu" title="Options">${icon('more')}</button>`;

    if (note) {
      wrap.innerHTML = `
        <div class="mb__head">
          <button type="button" class="mb__title" data-mb="open" title="Open the map">${icon('mindmap', 16)}<span>${escapeHtml(note.title || 'Untitled map')}</span></button>
          <button type="button" class="btn btn--secondary" data-mb="open">Open</button>
        </div>
        <div class="mb__view" style="height:${heightOf(el)}px"></div>
        ${readOnly ? '' : '<div class="mb__grip" data-mb="grip" title="Drag to change the height"></div>'}
        ${menuBtn}`;
      shadow.append(wrap);
      const view = wrap.querySelector('.mb__view');
      for (const t of KEEP_OUT) view.addEventListener(t, (e) => e.stopPropagation());
      h.preview = mountPreview(view, { getMap: () => store.getNote(id)?.map, onOpen: () => go(`#/map/${id}`) });
    } else {
      wrap.classList.add('tb--empty');
      wrap.innerHTML = `
        <div class="tb__top">
          <span class="tb__name">${id ? 'This mind map no longer exists' : 'Mind map'}</span>
          <span class="tb__acts">${readOnly ? '' : (id
            ? '<button type="button" class="btn btn--secondary" data-mb="existing">Choose another</button><button type="button" class="btn btn--secondary" data-mb="remove">Remove block</button>'
            : '<button type="button" class="btn btn--secondary" data-mb="existing">Add existing</button><button type="button" class="btn btn--primary" data-mb="new">Create new</button>')}</span>
        </div>
        <p class="tb__hint">${readOnly ? 'No mind map chosen.' : 'Show a mind map inside this note. Add one you already have, or create a new one: it opens as a full page.'}</p>
        <div class="tb__pick" hidden><input class="tb__search" type="search" placeholder="Search mind maps" autocomplete="off" spellcheck="false" aria-label="Search mind maps"><div class="tb__items"></div></div>
        ${readOnly || !id ? (readOnly ? '' : menuBtn) : ''}`;
      shadow.append(wrap);
    }

    wrap.addEventListener('click', (e) => onClick(e, h, wrap));
    wrap.addEventListener('input', (e) => { if (e.target.classList?.contains('tb__search')) fillItems(wrap, e.target.value); });
    wrap.addEventListener('keydown', (e) => onKey(e, h, wrap));
    wrap.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-mb="grip"]')) startResize(e, h, wrap); });

    h.ro = new ResizeObserver(() => widen(h));
    h.ro.observe(el);
    const sc = scrollerOf(el);
    if (sc) h.ro.observe(sc);
    widen(h);
  }

  /* ---- choosing / creating ---- */
  function assign(h, id, { open = false } = {}) {
    changed(() => { h.el.setAttribute('data-map-block', id); });
    paint(h);
    if (open) setTimeout(() => go(`#/map/${id}`), 120);            // a moment for the note to be saved first
  }

  function fillItems(wrap, q = '') {
    const needle = q.trim().toLowerCase();
    const list = store.maps().filter((m) => !needle || (m.title || '').toLowerCase().includes(needle));
    wrap.querySelector('.tb__items').innerHTML = list.length
      ? list.map((m, i) => `<button type="button" class="tb__item${i === 0 ? ' is-active' : ''}" data-map="${m.id}"><span class="tb__item-name">${escapeHtml(m.title || 'Untitled map')}</span><span class="tb__item-meta">${countNodes(m.map)} nodes</span></button>`).join('')
      : `<p class="tb__none">${store.maps().length ? 'No mind map matches.' : 'You have no mind maps yet. Use Create new.'}</p>`;
  }

  function onKey(e, h, wrap) {
    if (!e.target.classList?.contains('tb__search')) return;
    const items = [...wrap.querySelectorAll('.tb__item')];
    const at = items.findIndex((i) => i.classList.contains('is-active'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      items[at]?.classList.remove('is-active');
      const next = items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
      next.classList.add('is-active');
      next.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = items[at] || items[0];
      if (pick) assign(h, pick.dataset.map);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      wrap.querySelector('.tb__pick').hidden = true;
    }
  }

  function onClick(e, h, wrap) {
    const item = e.target.closest('.tb__item');
    if (item) { assign(h, item.dataset.map); return; }
    const act = e.target.closest('[data-mb]')?.dataset.mb;
    const id = h.el.getAttribute('data-map-block') || '';
    if (act === 'open') go(`#/map/${id}`);
    else if (act === 'existing') {
      const pick = wrap.querySelector('.tb__pick');
      pick.hidden = !pick.hidden;
      if (!pick.hidden) { fillItems(wrap); pick.querySelector('.tb__search').focus(); }
    } else if (act === 'new') {
      const host = store.getNote(hostNote());
      const m = store.createMap({ folderId: host?.folderId ?? null });
      assign(h, m.id, { open: true });
    } else if (act === 'remove') {
      changed(() => { h.el.remove(); if (!root.children.length) root.innerHTML = '<p><br></p>'; });
    } else if (act === 'menu') openMenu(h, e.target.closest('[data-mb="menu"]'));
  }

  /* ---- resizing: the bar under the map ---- */
  function startResize(e, h, wrap) {
    e.preventDefault();
    const view = wrap.querySelector('.mb__view');
    const y0 = e.clientY, h0 = view.offsetHeight;
    let now = h0;
    const move = (ev) => { now = Math.round(Math.min(H_MAX, Math.max(H_MIN, h0 + ev.clientY - y0))); view.style.height = `${now}px`; };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (now !== h0) changed(() => { h.el.setAttribute('data-map-h', String(now)); });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /* ---- the ⋯ menu ---- */
  let menu = null;
  const closeMenu = () => {
    if (!menu) return;
    menu.remove(); menu = null;
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onMenuKey, true);
  };
  const onOutside = (e) => { if (menu && !e.composedPath().includes(menu)) closeMenu(); };
  const onMenuKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); } };

  function openMenu(h, btn) {
    closeMenu();
    const id = h.el.getAttribute('data-map-block');
    const sections = h.ok ? [
      { items: [
        { act: 'open', label: 'Open map', ic: 'external' },
        { act: 'fit', label: 'Fit to view', ic: 'fit' },
        ...(readOnly ? [] : [{ act: 'change', label: 'Choose another map', ic: 'mindmap' }]),
      ] },
      ...(readOnly ? [] : [{ items: [{ act: 'delete', label: 'Delete block', ic: 'trash', danger: true }] }]),
    ] : [{ items: [{ act: 'delete', label: 'Delete block', ic: 'trash', danger: true }] }];
    menu = document.createElement('div');
    menu.className = 'block-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = renderMenu(sections).html;
    document.body.append(menu);
    placeMenu(menu, btn.getBoundingClientRect());
    menu.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      closeMenu();
      if (act === 'open') go(`#/map/${id}`);
      else if (act === 'fit') h.preview?.fit();
      else if (act === 'change') { changed(() => { h.el.setAttribute('data-map-block', ''); }); paint(h); }
      else if (act === 'delete') changed(() => { h.el.remove(); if (!root.children.length) root.innerHTML = '<p><br></p>'; });
    });
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onMenuKey, true);
  }

  /* ---- keeping up ---- */
  const sweep = () => { for (const h of handles) if (!root.contains(h.el)) { release(h); handles.delete(h); } };
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.matches('[data-map-block]')) ensure(n);
        n.querySelectorAll?.('[data-map-block]').forEach(ensure);
      }
    }
    sweep();
  });
  mo.observe(root, { childList: true, subtree: true });
  root.querySelectorAll('[data-map-block]').forEach(ensure);

  const off = store.subscribe(() => {                              // the map was edited, renamed, deleted or restored somewhere else
    for (const h of handles) {
      const id = h.el.getAttribute('data-map-block') || '';
      const sig = sigOf(id);
      if (sig === h.sig || h.shadow.activeElement) continue;
      const wasOk = h.ok;
      h.sig = sig;
      if (!!mapNote(id) !== wasOk) paint(h);
      else if (wasOk) { h.preview?.refresh(); const t = h.shadow.querySelector('.mb__title span'); if (t) t.textContent = mapNote(id)?.title || 'Untitled map'; }
    }
  });

  return () => {
    mo.disconnect();
    off();
    closeMenu();
    for (const h of handles) release(h);
    handles.clear();
  };
}

/* ---------- Look (the block reuses the Threads block's frame, .tb; this adds the map area) ---------- */
const CSS = `
.mb { padding: 12px 14px 8px; }
.mb__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 36px 10px 4px; }
.mb__title { display: inline-flex; align-items: center; gap: 8px; min-width: 0; color: var(--text); font-size: 15px; font-weight: 600; cursor: pointer; }
.mb__title .icon { flex: none; color: var(--text-muted); }
.mb__title span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mb__view { position: relative; overflow: hidden; border: 1px solid var(--border); border-radius: var(--r-sm); }
.mb__grip { display: flex; align-items: center; justify-content: center; height: 16px; margin-top: 2px; cursor: ns-resize; touch-action: none; }
.mb__grip::after { content: ''; width: 44px; height: 4px; border-radius: 2px; background: var(--border-strong); opacity: 0; transition: opacity var(--t-fast); }
.mb:hover .mb__grip::after, .mb__grip:hover::after { opacity: 1; }
.mb[data-ro] { padding-bottom: 14px; }
.mm--preview .mm__viewport { cursor: grab; }
.mm--preview .mm__viewport.is-panning { cursor: grabbing; }
`;
