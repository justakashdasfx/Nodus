/* ============================================================================
   THREAD BLOCK — a thread living inside a note ("/" → Threads).

   In the note it is saved as an empty shell:   <div data-thread-block="THREAD-ID" data-limit="10|20|30|all" data-bid="…"></div>
   (data-thread-block="" = no thread chosen yet). Everything you see is drawn into a shadow root, so none of it is saved in the
   note, counted as its text, searched, or copied. The block borrows the app's own stylesheets, so buttons, rule fields and rows
   look exactly like on the Threads page.

   • Empty block      name on the left · [Add existing] [Create new] on the right
   • With a thread    the thread's own page, made compact (js/views/thread.js): editable name · rules (menu → Edit thread) ·
                      matching blocks, newest note first. Click a block → its note opens in the side pane.
                      The thread never lists the blocks of the note it sits in.
   • ⋯ menu (shows on hover): Show 10 / 20 / 30 / All blocks · Edit thread · Expand (full page) · Open in side pane · Delete block
   Look: the CSS string at the bottom (--thread-bg, --thread-border, --thread-radius can be set in css/tokens.css).
   ========================================================================== */

import * as store from '../core/store.js';
import { escapeHtml } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { go } from '../core/router.js';
import { ruleCount } from '../core/threads.js';
import { ownText } from '../core/blockindex.js';
import * as pane from '../ui/pane.js';
import * as threadView from '../views/thread.js';
import { renderMenu, placeMenu } from './block-menu.js';
import { idFactory } from './block-ops.js';

const LIMITS = ['10', '20', '30', 'all'];
const STOP = ['keydown', 'keyup', 'keypress', 'beforeinput', 'input', 'paste', 'cut', 'copy', 'compositionstart', 'compositionend'];

/* ---------- Putting a thread block into a note ---------- */

/** "/" → Threads: an empty line becomes the block, otherwise it goes below the line. A Text line always follows it. */
export function insertThreadBlock(root, block) {
  const el = document.createElement('div');
  el.setAttribute('data-thread-block', '');
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

let sheets = null;
/** The app's stylesheets, copied once so they also apply inside the shadow roots (+ the block's own). */
function appSheets() {
  if (sheets) return sheets;
  sheets = [];
  for (const s of document.styleSheets) {
    try {
      const c = new CSSStyleSheet();
      c.replaceSync([...s.cssRules].map((r) => r.cssText).join('\n'));
      sheets.push(c);
    } catch { /* a sheet we cannot read: skip it */ }
  }
  const own = new CSSStyleSheet();
  own.replaceSync(CSS);
  sheets.push(own);
  return sheets;
}

export function mountThreadBlocks(root, { readOnly = false, history = null } = {}) {
  const notify = () => root.dispatchEvent(new Event('input', { bubbles: true }));
  const handles = new Set();
  const hostNote = () => root.dataset.noteId || '';

  const changed = (fn) => { history?.commit(); fn(); notify(); history?.record(); };

  function ensure(el) {
    if (el._tb || !el.isConnected) return;
    el.contentEditable = 'false';
    const shadow = el.shadowRoot || el.attachShadow({ mode: 'open' });
    if ('adoptedStyleSheets' in shadow) shadow.adoptedStyleSheets = appSheets();
    for (const t of STOP) shadow.addEventListener(t, (e) => e.stopPropagation());   // typing in the block is not typing in the note
    const h = { el, shadow, stop: null, ok: false };
    el._tb = h;
    handles.add(h);
    paint(h);
  }

  function paint(h) {
    h.stop?.();
    h.stop = null;
    const { el, shadow } = h;
    const id = el.getAttribute('data-thread-block') || '';
    const thread = id ? store.getThread(id) : null;
    h.ok = !!thread;
    shadow.replaceChildren();
    const wrap = document.createElement('div');
    wrap.className = 'tb';
    if (readOnly) wrap.dataset.ro = '';
    wrap.dataset.limit = LIMITS.includes(el.getAttribute('data-limit')) ? el.getAttribute('data-limit') : '10';
    wrap.dataset.hostNote = hostNote();
    const menuBtn = `<button type="button" class="btn btn--icon tb__menu" data-tb="menu" aria-label="Thread options" aria-haspopup="menu" title="Options">${icon('more')}</button>`;

    if (thread) {
      const out = threadView.render({ id });
      wrap.innerHTML = out.html + menuBtn;
      shadow.append(wrap);
      h.stop = out.mount?.(wrap) || null;
      if (readOnly) { const t = wrap.querySelector('#thread-title'); if (t) t.readOnly = true; }
    } else {
      wrap.classList.add('tb--empty');
      wrap.innerHTML = `
        <div class="tb__top">
          <span class="tb__name">${id ? 'This thread no longer exists' : 'Thread'}</span>
          <span class="tb__acts">${readOnly ? '' : `<button type="button" class="btn btn--secondary" data-tb="existing">Add existing</button><button type="button" class="btn btn--primary" data-tb="new">Create new</button>`}</span>
        </div>
        <p class="tb__hint">${readOnly ? 'No thread chosen.' : 'Gather blocks from all your notes here. Add a thread you already have, or create a new one.'}</p>
        <div class="tb__pick" hidden><input class="tb__search" type="search" placeholder="Search threads" autocomplete="off" spellcheck="false" aria-label="Search threads"><div class="tb__items"></div></div>
        ${readOnly ? '' : menuBtn}`;
      shadow.append(wrap);
    }

    wrap.addEventListener('click', (e) => onClick(e, h, wrap));
    wrap.addEventListener('input', (e) => { if (e.target.classList?.contains('tb__search')) fillItems(wrap, e.target.value); });
    wrap.addEventListener('keydown', (e) => onKey(e, h, wrap));
  }

  /* ---- choosing / creating ---- */
  function assign(h, id) { changed(() => { h.el.setAttribute('data-thread-block', id); }); paint(h); }

  function fillItems(wrap, q = '') {
    const needle = q.trim().toLowerCase();
    const list = store.threads().filter((t) => !needle || t.title.toLowerCase().includes(needle));
    wrap.querySelector('.tb__items').innerHTML = list.length
      ? list.map((t, i) => `<button type="button" class="tb__item${i === 0 ? ' is-active' : ''}" data-thread="${t.id}"><span class="tb__item-name">${escapeHtml(t.title)}</span><span class="tb__item-meta">${ruleCount(t.rules)} ${ruleCount(t.rules) === 1 ? 'rule' : 'rules'}</span></button>`).join('')
      : `<p class="tb__none">${store.threads().length ? 'No thread matches.' : 'You have no threads yet. Use Create new.'}</p>`;
  }

  function onKey(e, h, wrap) {
    const search = e.target.classList?.contains('tb__search');
    if (!search) return;
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
      if (pick) assign(h, pick.dataset.thread);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      wrap.querySelector('.tb__pick').hidden = true;
    }
  }

  function onClick(e, h, wrap) {
    const row = e.target.closest('a.block-row');                  // a block in the thread → its note in the side pane
    if (row) {
      e.preventDefault();
      const m = /#\/note\/([^/]+)\/?([^/]*)/.exec(row.getAttribute('href') || '');
      if (m) pane.openNote(m[1], m[2] || null);
      return;
    }
    const item = e.target.closest('.tb__item');
    if (item) { assign(h, item.dataset.thread); return; }
    const act = e.target.closest('[data-tb]')?.dataset.tb;
    if (act === 'existing') {
      const pick = wrap.querySelector('.tb__pick');
      pick.hidden = !pick.hidden;
      if (!pick.hidden) { fillItems(wrap); pick.querySelector('.tb__search').focus(); }
    } else if (act === 'new') {
      const t = store.createThread({ title: 'Untitled thread' });
      assign(h, t.id);
    } else if (act === 'menu') {
      openMenu(h, wrap, e.target.closest('[data-tb="menu"]'));
    }
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

  function openMenu(h, wrap, btn) {
    closeMenu();
    const id = h.el.getAttribute('data-thread-block');
    const lim = wrap.dataset.limit;
    const sections = h.ok ? [
      { items: [
        { act: 'show', label: 'Show', ic: 'list', hint: lim === 'all' ? 'All' : lim },
        ...(readOnly ? [] : [{ act: 'edit', label: 'Edit thread', ic: 'pencil' }]),
        { act: 'expand', label: 'Expand', ic: 'external' },
        { act: 'pane', label: 'Open in side pane', ic: 'sidepanel' },
      ] },
      ...(readOnly ? [] : [{ items: [{ act: 'delete', label: 'Delete block', ic: 'trash', danger: true }] }]),
    ] : [{ items: [{ act: 'delete', label: 'Delete block', ic: 'trash', danger: true }] }];

    menu = document.createElement('div');
    menu.className = 'block-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = renderMenu(sections).html;
    document.body.append(menu);
    placeMenu(menu, btn.getBoundingClientRect());
    const showRow = menu.querySelector('[data-act="show"]');
    if (showRow) showRow.insertAdjacentHTML('beforeend', `<span class="block-menu__check" style="transition:transform var(--t-fast)">${icon('caret', 12)}</span>`);
    menu.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      if (act === 'show') {                                       // a dropdown inside the menu: 10 · 20 · 30 · All
        const open = menu.querySelector('.block-menu__sub');
        if (open) open.remove();
        else {
          const opts = LIMITS.map((n) => `<button type="button" role="menuitem" class="block-menu__item${lim === n ? ' is-current' : ''}" data-act="limit:${n}" style="padding-left:34px"><span class="block-menu__label">${n === 'all' ? 'All blocks' : `${n} blocks`}</span>${lim === n ? `<span class="block-menu__check">${icon('check', 14)}</span>` : ''}</button>`).join('');
          showRow.insertAdjacentHTML('afterend', `<div class="block-menu__sub">${opts}</div>`);
        }
        showRow.querySelector('.block-menu__check').style.transform = open ? '' : 'rotate(90deg)';
        placeMenu(menu, btn.getBoundingClientRect());
        return;
      }
      closeMenu();
      if (act.startsWith('limit:')) {
        const v = act.slice(6);
        changed(() => { h.el.setAttribute('data-limit', v); });
        wrap.dataset.limit = v;
      } else if (act === 'edit') wrap.querySelector('#thread-edit')?.click();
      else if (act === 'expand') go(`#/thread/${id}`);
      else if (act === 'pane') pane.openThread(id);
      else if (act === 'delete') {
        changed(() => { h.el.remove(); if (!root.children.length) root.innerHTML = '<p><br></p>'; });
      }
    });
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onMenuKey, true);
  }

  /* ---- keeping up ---- */
  const sweep = () => { for (const h of handles) if (!root.contains(h.el)) { h.stop?.(); handles.delete(h); } };
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.matches('[data-thread-block]')) ensure(n);
        n.querySelectorAll?.('[data-thread-block]').forEach(ensure);
      }
    }
    sweep();
  });
  mo.observe(root, { childList: true, subtree: true });
  root.querySelectorAll('[data-thread-block]').forEach(ensure);

  const off = store.subscribe((kind) => {                         // a thread was deleted or created somewhere else
    if (kind !== 'thread') return;
    for (const h of handles) {
      const id = h.el.getAttribute('data-thread-block');
      if (!!(id && store.getThread(id)) !== h.ok && !h.shadow.activeElement) paint(h);
    }
  });

  return () => {
    mo.disconnect();
    off();
    closeMenu();
    for (const h of handles) h.stop?.();
    handles.clear();
  };
}

/* ---------- Look (only the block's own frame; everything inside uses the app's stylesheets) ---------- */
const CSS = `
:host { display: block; margin: 0 0 var(--prose-block-gap, 0.9em); }
.tb {
  position: relative; padding: 16px 18px 6px; border-radius: var(--thread-radius, var(--r-md));
  background: var(--thread-bg, var(--grey-300)); border: 1px solid var(--thread-border, var(--border));
  color: var(--text); font-family: var(--font-sans); font-size: var(--fs-ui); line-height: 1.5; text-align: left;
}
.tb .view { max-width: none; margin: 0; padding: 0; }
.tb .view-head { margin: 0 0 12px; padding-right: 36px; }
.tb .view-head__actions, .tb .view-head__sub { display: none; }
.tb .thread__title { width: 100%; font-size: 16px; font-weight: 600; }
.tb .tr { margin: 0 0 16px; background: var(--bg-card); }
.tb .list { margin: 0; }
.tb .row { padding-left: 4px; padding-right: 4px; }

.tb__menu { position: absolute; top: 10px; right: 10px; opacity: 0; transition: opacity var(--t-fast); }
.tb:hover .tb__menu, .tb__menu:focus-visible { opacity: 1; }
@media (hover: none) { .tb__menu { opacity: 1; } }

.tb[data-limit="10"] #thread-list > :nth-child(n+11),
.tb[data-limit="20"] #thread-list > :nth-child(n+21),
.tb[data-limit="30"] #thread-list > :nth-child(n+31) { display: none; }
.tb[data-ro] .thread__title { pointer-events: none; }

.tb--empty { padding-bottom: 16px; }
.tb__top { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-right: 36px; }
.tb__name { font-size: 16px; font-weight: 600; color: var(--text-muted); }
.tb__acts { display: inline-flex; gap: 8px; }
.tb__hint { margin: 10px 0 0; color: var(--text-muted); font-size: var(--fs-small); }
.tb__pick { margin-top: 14px; border: 1px solid var(--border-strong); border-radius: var(--r-sm); background: var(--bg-card); overflow: hidden; }
.tb__pick[hidden] { display: none; }
.tb__search { width: 100%; height: 38px; padding: 0 12px; border: 0; border-bottom: 1px solid var(--border); background: transparent; outline: none; color: var(--text); font: inherit; }
.tb__search::placeholder { color: var(--text-faint); }
.tb__items { max-height: 220px; overflow-y: auto; padding: 6px; }
.tb__item { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; height: 34px; padding: 0 10px; border-radius: var(--r-sm); color: var(--text-dim); text-align: left; }
.tb__item:hover, .tb__item.is-active { background: var(--bg-hover); color: var(--text); }
.tb__item-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tb__item-meta { flex: none; font-size: var(--fs-tiny); color: var(--text-faint); }
.tb__none { margin: 0; padding: 12px 10px; color: var(--text-muted); font-size: var(--fs-small); }
`;
