/* ============================================================================
   PANE — the second panel beside the page (right side of the card).

   What it can show
     • a note        → Shift+click any note link (sidebar, galleries, tag/thread lists);
                       a plain click on a block in a thread or tag list opens it here too
     • a tag's blocks → Shift+click a tag chip in a note

   Rules
     • Inside the pane, clicking a block of a tag list swaps the pane to that note; ← goes back to the list.
     • A note is never open twice. If it is already on the page (or in the pane) you are only taken to the block.
     • The pane closes on reload. Its width is remembered (config.js → storage.pane).
     • The divider: drag to resize · double-click = reset to the default width · ←/→ when focused.
     • On phones (≤760px) the pane is a full-screen sheet: there is no Shift key, so a tap on a block in a thread or tag list
       opens it (other links open as normal pages). The phone's back gesture closes the sheet.

   Each editor in the pane is a full editor with its own floating toolbar, block handle and tag margin.
   Look: .pane / .divider in css/layout.css, --pane-* in css/tokens.css.
   ========================================================================== */

import { CONFIG } from '../core/config.js';
import * as store from '../core/store.js';
import * as settings from '../core/settings.js';
import { icon } from '../core/icons.js';
import { go } from '../core/router.js';
import { registerActions } from '../core/actions.js';
import { debounce, escapeHtml, tagHue } from '../core/utils.js';
import * as noteView from '../views/note.js';
import * as tagView from '../views/tag.js';
import * as threadView from '../views/thread.js';

let els = null;                    // { card, view, pane, divider }
let getRoute = () => ({});
let state = null;                  // { kind: 'note' | 'tag', id, block?, prev? }  — prev = what the ← button returns to
let stopContent = null;            // tears down the pane's editor (flushes its save)
let frac = CONFIG.pane.defaultWidth;
let pushed = false;                // phones: the sheet added a history entry, so Back closes it

const LINK = /^#\/(note|tag)\/([^/?#]+)(?:\/([^/?#]+))?$/;

/* ---------- Width ---------- */

function readFrac() {
  try {
    const v = parseFloat(localStorage.getItem(CONFIG.storage.pane));
    if (v > 0.1 && v < 0.9) return v;
  } catch { /* storage unavailable */ }
  return CONFIG.pane.defaultWidth;
}
function saveFrac(reset = false) {
  try { reset ? localStorage.removeItem(CONFIG.storage.pane) : localStorage.setItem(CONFIG.storage.pane, String(frac)); } catch { /* ignore */ }
}
function clampFrac(f) {
  const w = els.card.getBoundingClientRect().width || 1;
  const min = parseFloat(getComputedStyle(els.card).getPropertyValue('--pane-min')) || 320;
  const m = Math.min(0.45, min / w);          // each side keeps at least --pane-min (css/tokens.css)
  return Math.min(Math.max(f, m), 1 - m);
}
function setFrac(f) {
  frac = clampFrac(f);
  els.card.style.setProperty('--pane-frac', frac.toFixed(4));
}

function initDivider() {
  const { card, divider } = els;
  divider.innerHTML = `<span class="divider__grip">${icon('dividerGrip', 0)}</span>`; // appears when you point at the gap (css/layout.css)
  let dragging = false;
  const fromX = (x) => { const r = card.getBoundingClientRect(); return (r.right - x) / r.width; };

  divider.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    divider.setPointerCapture(e.pointerId); // mouse, pen and finger all use this
    document.body.classList.add('is-pane-resizing');
    e.preventDefault();
  });
  divider.addEventListener('pointermove', (e) => { if (dragging) setFrac(fromX(e.clientX)); });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove('is-pane-resizing');
    saveFrac();
  };
  divider.addEventListener('pointerup', end);
  divider.addEventListener('pointercancel', end);
  divider.addEventListener('dblclick', () => { setFrac(CONFIG.pane.defaultWidth); saveFrac(true); });
  divider.addEventListener('keydown', (e) => {
    const step = CONFIG.pane.keyStep;
    if (e.key === 'ArrowLeft') setFrac(frac + step);           // divider moves left → pane wider
    else if (e.key === 'ArrowRight') setFrac(frac - step);
    else if (e.key === 'Home' || e.key === 'Enter') setFrac(CONFIG.pane.defaultWidth);
    else return;
    e.preventDefault();
    saveFrac();
  });
  window.addEventListener('resize', () => setFrac(frac)); // keep both sides above the minimum
}

/* ---------- Drawing ---------- */

const paneScroller = () => els.pane.querySelector('.pane__scroll');
const paneEditor = () => els.pane.querySelector('.editor');
const mainEditor = () => els.view.querySelector('.editor');
const editingInPane = () => { const a = document.activeElement; return !!a && a.classList.contains('editor') && els.pane.contains(a); };

function draw({ keepScroll = false } = {}) {
  const keep = keepScroll ? (paneScroller()?.scrollTop || 0) : 0;
  stopContent?.();
  stopContent = null;

  if (!state) {
    els.card.classList.remove('has-pane');
    els.pane.hidden = true;
    els.divider.hidden = true;
    els.pane.innerHTML = '';
    return;
  }

  let out, title, titleStyle = '';
  if (state.kind === 'note') {
    out = noteView.render({ id: state.id, block: state.block }, { pane: true });
    title = store.getNote(state.id)?.title || 'Untitled';
  } else if (state.kind === 'thread') {
    out = threadView.render({ id: state.id });
    title = store.getThread(state.id)?.title || 'Thread';
  } else {
    out = tagView.render({ id: state.id });
    title = state.id;
    titleStyle = ` style="--tag-h:${tagHue(state.id)}"`;
  }

  const btn = (action, iconName, label) =>
    `<button type="button" class="btn btn--icon" data-action="${action}" aria-label="${label}" title="${label}">${icon(iconName)}</button>`;
  const phone = settings.isMobile(); // on a phone the first button is always ← (back to the list, or close the sheet)
  const lead = state.prev ? btn('pane-back', 'arrowLeft', 'Back') : (phone ? btn('pane-close', 'arrowLeft', 'Back') : '');
  const tail = btn('pane-full', 'external', 'Open full page') + (state.prev || !phone ? btn('pane-close', 'close', 'Close') : '');
  els.pane.innerHTML = `
    <header class="pane__head">
      ${lead}
      <span class="pane__title"${titleStyle}>${escapeHtml(title)}</span>
      ${tail}
    </header>
    <div class="pane__scroll">${out.html}</div>`;

  setFrac(frac);
  els.card.classList.add('has-pane');
  els.pane.hidden = false;
  els.divider.hidden = false;
  const scroller = paneScroller();
  stopContent = out.mount ? out.mount(scroller) : null;
  if (keep) scroller.scrollTop = keep;
}

/* ---------- Opening and closing ---------- */

export const isOpen = () => !!state;

/** Re-draw the pane as it is (after Write ⇄ Read changes how notes open). */
export function refresh() { if (state) draw({ keepScroll: true }); }

export function openNote(id, block = null, { fromPane = false } = {}) {
  if (!store.getNote(id)) return;
  const route = getRoute();
  if (route.view === 'note' && route.id === id) { noteView.revealBlock(mainEditor(), block); return; }    // already the page
  if (state?.kind === 'note' && state.id === id) { noteView.revealBlock(paneEditor(), block); return; }  // already in the pane
  state = { kind: 'note', id, block, prev: fromPane && state ? { ...state, prev: null } : null };
  draw();
  pushSheet();
}

export function openThread(id) {
  if (!store.getThread(id)) return;
  if (state?.kind === 'thread' && state.id === id) return;
  state = { kind: 'thread', id, prev: null };
  draw();
  pushSheet();
}

export function openTag(tag, { fromPane = false } = {}) {
  const id = String(tag || '').toLowerCase();
  if (!id) return;
  if (state?.kind === 'tag' && state.id === id) return;
  state = { kind: 'tag', id, prev: fromPane && state ? { ...state, prev: null } : null };
  draw();
  pushSheet();
}

/** Phones: one history entry per open sheet, so the back gesture closes it instead of leaving the page. */
function pushSheet() {
  if (settings.isMobile() && !pushed) { history.pushState({ sheet: 1 }, ''); pushed = true; }
}

export function close() {
  if (!state) return;
  state = null;
  draw();
  if (pushed) { pushed = false; history.back(); } // the entry we added; its popstate finds nothing left to close
}

/* ---------- Following the app ---------- */

const refreshTag = debounce(() => { if (state?.kind === 'tag') draw({ keepScroll: true }); }, 350);

/** Called by app.js for every store event. */
export function onStore(kind, detail) {
  if (!state || kind === 'dirty' || kind === 'thread') return;

  if (state.kind === 'thread') return;                // the thread repaints itself
  if (state.kind === 'tag') { refreshTag(); return; } // typing a #tag elsewhere updates the list a moment later

  if (kind === 'content') {                           // the note in the pane is being typed in (or the page's copy of it)
    if (detail?.id === state.id) {
      const t = els.pane.querySelector('.pane__title');
      if (t) t.textContent = store.getNote(state.id)?.title || 'Untitled';
    }
    return;
  }
  if (!store.getNote(state.id)) { close(); return; }  // deleted for good
  if (editingInPane()) return;                        // never rebuild the editor under the cursor
  if (kind === 'remote' && !detail?.ids?.includes(state.id)) return;
  draw({ keepScroll: true });
}

/** Called by app.js when the page changes: a note can't be both the page and in the pane. */
export function onRoute(route) {
  if (state?.kind === 'note' && route.view === 'note' && route.id === state.id) close();
}

/* ---------- Links ---------- */

function parse(a) {
  const m = LINK.exec(a.getAttribute('href') || '');
  if (!m) return null;
  let id = m[2];
  if (m[1] === 'tag') { try { id = decodeURIComponent(id); } catch { /* keep as is */ } }
  return { kind: m[1], id, block: m[3] || null };
}

/** Shift+click any note or tag link, or a plain click on a block in a thread / tag list, opens the pane. */
function wantsPane(e, a, link) {
  if (e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey) return false;
  const inRow = link.kind === 'note' && !!a.closest('.block-row');
  return settings.isMobile() ? inRow : (e.shiftKey || inRow); // phones have no Shift: only the list blocks open the sheet
}

function onClick(e) {
  if (e.defaultPrevented) return;
  const a = e.target.closest?.('a[href^="#/note/"], a[href^="#/tag/"]');
  const link = a && parse(a);
  if (!link || !wantsPane(e, a, link)) return;
  e.preventDefault();
  e.stopPropagation();
  const fromPane = els.pane.contains(a);
  if (link.kind === 'note') openNote(link.id, link.block, { fromPane });
  else openTag(link.id, { fromPane });
}

/** Shift+mousedown would start selecting text across the page; the link is what was meant. */
function onMouseDown(e) {
  if (!e.shiftKey || e.button !== 0) return;
  const a = e.target.closest?.('a[href^="#/note/"], a[href^="#/tag/"]');
  if (a && !settings.isMobile()) e.preventDefault();
}

/* ---------- Boot ---------- */

export function initPane({ card, view, pane, divider, route }) {
  els = { card, view, pane, divider };
  getRoute = route;
  frac = readFrac();
  setFrac(frac);
  initDivider();
  window.addEventListener('popstate', () => {          // phones: the back gesture closes the sheet
    if (pushed && state) { pushed = false; state = null; draw(); }
    else if (pushed) pushed = false;
  });
  document.addEventListener('click', onClick, true);   // capture: runs before the page's own click handling
  document.addEventListener('mousedown', onMouseDown, true);

  registerActions({
    'pane-close': () => close(),
    'pane-back': () => { if (state?.prev) { state = state.prev; draw(); } },
    'pane-full': () => {
      if (!state) return;
      const s = state;
      const target = s.kind === 'note' ? `#/note/${s.id}${s.block ? '/' + s.block : ''}` : s.kind === 'thread' ? `#/thread/${s.id}` : `#/tag/${encodeURIComponent(s.id)}`;
      if (pushed) { // phones: let go of the sheet's history entry, then open the page
        pushed = false;
        state = null; draw();
        window.addEventListener('popstate', () => go(target), { once: true });
        history.back();
        return;
      }
      close(); // flushes the pane's save before the page opens the same note
      go(target);
    },
  });
}
