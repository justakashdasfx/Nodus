/* ============================================================================
   NOTE MENTIONS in the editor.
   • Type  @  and then a few letters: your notes whose name matches pop up (nothing shows until you type).
       ↑ ↓ choose · Enter or Tab inserts it · Esc closes. The @ must come at the start of a word (so e-mail addresses are left alone).
   • A mention is blue text. Click → opens the note · Shift+click → opens it in the side pane · Alt+click → a short name (alias).
   • A mention is ONLY a mention: it does not create a backlink and does not appear in "Related notes" (that is what [[ is for).
   Look: css/tasks-tags.css → "NOTE MENTIONS" (--mention-note). Stored as <span data-note-mention="NOTE-ID">.
   ========================================================================== */
import * as store from '../core/store.js';
import { escapeHtml } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { go } from '../core/router.js';
import * as pane from '../ui/pane.js';
import { caretBlock } from './normalize.js';

const MAX_ITEMS = 6;
const SEL = 'span[data-note-mention]';

/** A Range over characters [start, end) of a block's text. */
function rangeAt(block, start, end) {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const r = document.createRange();
  let pos = 0; let setStart = false;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const len = n.nodeValue.length;
    if (!setStart && start <= pos + len) { r.setStart(n, start - pos); setStart = true; }
    if (setStart && end <= pos + len) { r.setEnd(n, end - pos); return r; }
    pos += len;
  }
  return setStart ? r : null;
}

export function mountNoteMentions(root, { readOnly = false, history = null } = {}) {
  const hostId = () => root.dataset.noteId || '';
  const notify = () => root.dispatchEvent(new Event('input', { bubbles: true }));
  const changed = (fn) => { history?.commit(); fn(); notify(); history?.record(); };
  const titleOf = (n) => n.title || 'Untitled';

  /* ---- keep the links up to date ---- */
  function sync() {
    root.querySelectorAll(SEL).forEach((s) => {
      const n = store.getNote(s.getAttribute('data-note-mention'));
      const missing = !n || !!n.deletedAt;
      s.classList.toggle('is-missing', missing);
      const isMap = n?.type === 'map';
      if (isMap) s.setAttribute('data-kind', 'map'); else s.removeAttribute('data-kind');   // (css/maps.css gives a mind map link its little icon)
      s.title = missing ? 'This note no longer exists' : isMap ? 'Open the mind map · Shift+click: side pane' + (readOnly ? '' : ' · Alt+click: short name') : (readOnly ? 'Open · Shift+click: side pane' : 'Open · Shift+click: side pane · Alt+click: short name');
      if (n && !s.hasAttribute('data-alias') && s.textContent !== titleOf(n)) s.textContent = titleOf(n);
    });
  }
  sync();

  /* ---- clicking a link ---- */
  /* Shift+click would extend the text selection from the caret to the link, and the click below would then think you were
     selecting text. So a Shift / Alt press on a link never starts a selection. */
  const onMouseDown = (e) => {
    if ((e.shiftKey || e.altKey) && e.target.closest?.(SEL) && root.contains(e.target)) e.preventDefault();
  };
  root.addEventListener('mousedown', onMouseDown);
  const onClick = (e) => {
    const s = e.target.closest?.(SEL);
    if (!s || !root.contains(s)) return;
    if (!e.shiftKey && !e.altKey && !getSelection().isCollapsed) return;   // you were selecting text, not clicking
    e.preventDefault();
    const id = s.getAttribute('data-note-mention');
    if (e.altKey && !readOnly) { editAlias(s); return; }
    if (!store.getNote(id)) return;
    if (store.getNote(id).type === 'map') { if (e.shiftKey) pane.openMap(id); else go(`#/map/${id}`); }   // a mind map: Shift+click = the side pane (fully editable)
    else if (e.shiftKey) pane.openNote(id); else go(`#/note/${id}`);
  };
  root.addEventListener('click', onClick);
  if (readOnly) return () => { root.removeEventListener('click', onClick); root.removeEventListener('mousedown', onMouseDown); };

  /* ---- the short name (alias) box ---- */
  let box = null;
  const closeBox = () => { box?.remove(); box = null; document.removeEventListener('pointerdown', onBoxOutside, true); };
  const onBoxOutside = (e) => { if (box && !box.contains(e.target)) closeBox(); };
  function editAlias(span) {
    closeBox();
    const n = store.getNote(span.getAttribute('data-note-mention'));
    if (!n) return;
    box = document.createElement('div');
    box.className = 'link-alias';
    box.innerHTML = `<input type="text" class="link-alias__input" value="${escapeHtml(span.textContent)}" placeholder="${escapeHtml(titleOf(n))}" maxlength="60" spellcheck="false" aria-label="Short name for this mention"><span class="link-alias__hint">Enter to save · empty = the note’s own name · Esc</span>`;
    document.body.append(box);
    const r = span.getBoundingClientRect();
    box.style.left = `${Math.max(8, Math.min(r.left, innerWidth - box.offsetWidth - 8))}px`;
    box.style.top = `${r.bottom + 6 + box.offsetHeight > innerHeight ? Math.max(8, r.top - box.offsetHeight - 6) : r.bottom + 6}px`;
    const input = box.querySelector('input');
    input.focus(); input.select();
    input.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Escape') { ev.preventDefault(); closeBox(); root.focus({ preventScroll: true }); }
      else if (ev.key === 'Enter') {
        ev.preventDefault();
        const v = input.value.trim().replace(/\s+/g, ' ');
        closeBox();
        changed(() => {
          if (!v || v === titleOf(n)) { span.removeAttribute('data-alias'); span.textContent = titleOf(n); }
          else { span.setAttribute('data-alias', ''); span.textContent = v; }
        });
        root.focus({ preventScroll: true });
      }
    });
    document.addEventListener('pointerdown', onBoxOutside, true);
  }

  /* ---- the @ picker ---- */
  const pop = document.createElement('div');
  pop.className = 'link-suggest';
  pop.setAttribute('role', 'listbox');
  pop.hidden = true;
  document.body.append(pop);
  let token = null; let items = []; let active = 0;

  function findToken() {
    const sel = getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed || !root.contains(sel.anchorNode)) return null;
    const block = caretBlock(root);
    if (!block || block.tagName === 'PRE' || block.tagName === 'DIV') return null;
    const caret = sel.getRangeAt(0);
    const host = caret.startContainer.nodeType === 1 ? caret.startContainer : caret.startContainer.parentElement;
    if (host?.closest('code, span[data-note-mention], span[data-note-link]')) return null;
    const before = document.createRange();
    before.setStart(block, 0);
    before.setEnd(caret.startContainer, caret.startOffset);
    const typed = before.toString().replace(/\u00a0/g, ' ');
    const m = typed.match(/(?:^|[\s(])@([^\s@][^@]{0,40})?$/);          // @ at the start of a word, then the name
    if (!m) return null;
    const query = m[1] || '';
    return { block, query, start: typed.length - query.length - 1, end: typed.length };
  }

  function candidates(q) {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];                                       // nothing until you type
    const here = hostId();
    const list = [...store.searchableNotes(), ...store.maps()].filter((n) => n.id !== here && titleOf(n).toLowerCase().includes(needle))
      .map((n) => ({ note: n, starts: titleOf(n).toLowerCase().startsWith(needle) }))
      .sort((a, b) => (b.starts - a.starts) || ((b.note.updatedAt || 0) - (a.note.updatedAt || 0)))
      .slice(0, MAX_ITEMS);
    return list;
  }

  function place() {
    const r = getSelection().getRangeAt(0).cloneRange();
    r.collapse(true);
    let rect = r.getClientRects()[0] || r.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height && !rect.top)) rect = token.block.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    const below = rect.bottom + 6;
    pop.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - pr.width - 8))}px`;
    pop.style.top = `${below + pr.height > innerHeight - 8 ? Math.max(8, rect.top - pr.height - 6) : below}px`;
  }

  function render() {
    const q = token.query.trim().toLowerCase();
    pop.innerHTML = items.map((it, i) => {
      const t = titleOf(it.note); const at = t.toLowerCase().indexOf(q);
      const name = at >= 0 ? `${escapeHtml(t.slice(0, at))}<b>${escapeHtml(t.slice(at, at + q.length))}</b>${escapeHtml(t.slice(at + q.length))}` : escapeHtml(t);
      const folder = it.note.folderId ? store.getFolder(it.note.folderId)?.name : '';
      return `<button type="button" role="option" class="link-suggest__item${i === active ? ' is-active' : ''}" data-i="${i}">${icon(it.note.type === 'map' ? 'mindmap' : 'note', 14)}<span class="link-suggest__name">${name}</span>${it.note.type === 'map' || folder ? `<span class="link-suggest__where">${escapeHtml(it.note.type === 'map' ? (folder ? `Mind map · ${folder}` : 'Mind map') : folder)}</span>` : ''}</button>`;
    }).join('');
  }

  const hide = () => { pop.hidden = true; items = []; token = null; };
  function update() {
    token = findToken();
    if (!token) { hide(); return; }
    items = candidates(token.query);
    if (!items.length) { hide(); return; }
    active = Math.min(active, items.length - 1);
    pop.hidden = false;
    render();
    place();
  }

  function insertLink(t, note, text) {
    const r = rangeAt(t.block, t.start, t.end);
    if (!r) return;
    r.deleteContents();
    const span = document.createElement('span');
    span.setAttribute('data-note-mention', note.id);
    span.textContent = text || titleOf(note);
    const gap = document.createTextNode('\u00a0');                  // typing goes after the link, not into it
    r.insertNode(gap);
    r.insertNode(span);
    const c = document.createRange();
    c.setStart(gap, 1); c.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(c);
    sync();
  }

  function accept(i) {
    const it = items[i];
    if (!it || !token) return;
    const t = token;
    hide();
    changed(() => {
      insertLink(t, it.note, '');
    });
  }

  const onInput = (e) => {
    if (e.isComposing) return;
    if (e.inputType && !/^(insertText|deleteContent|insertFromPaste)/.test(e.inputType)) { hide(); return; }
    active = 0;
    update();
  };
  const onKeyDown = (e) => {
    if (pop.hidden) return;
    const eat = () => { e.preventDefault(); e.stopPropagation(); };
    if (e.key === 'ArrowDown') { eat(); active = (active + 1) % items.length; render(); }
    else if (e.key === 'ArrowUp') { eat(); active = (active - 1 + items.length) % items.length; render(); }
    else if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) { eat(); accept(active); }
    else if (e.key === 'Escape') { eat(); hide(); }
  };
  const onPopDown = (e) => { if (e.target.closest('.link-suggest__item')) e.preventDefault(); };   // keep the caret
  const onPopClick = (e) => { const b = e.target.closest('.link-suggest__item'); if (b) accept(+b.dataset.i); };
  const onSelection = () => { if (!pop.hidden && !findToken()) hide(); };
  const onScroll = () => { if (!pop.hidden) hide(); };

  root.addEventListener('input', onInput);
  root.addEventListener('keydown', onKeyDown, true);
  root.addEventListener('blur', hide);
  pop.addEventListener('mousedown', onPopDown);
  pop.addEventListener('click', onPopClick);
  document.addEventListener('selectionchange', onSelection);
  document.addEventListener('scroll', onScroll, true);

  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('mousedown', onMouseDown);
    root.removeEventListener('input', onInput);
    root.removeEventListener('keydown', onKeyDown, true);
    root.removeEventListener('blur', hide);
    document.removeEventListener('selectionchange', onSelection);
    document.removeEventListener('scroll', onScroll, true);
    closeBox();
    pop.remove();
  };
}
