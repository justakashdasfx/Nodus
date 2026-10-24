/* ============================================================================
   TAG SUGGEST — type  #  and the first letters of a tag: the tags you already use pop up.

   • "#p" lists #productivity, #product, #parenting … (starts-with first, then contains; most used first).
   • ↑ / ↓ choose · Tab accepts the top (or chosen) one · Enter accepts only after you used ↑ / ↓
     (so a new tag you are typing is never swapped for an old one by accident) · Esc closes.
   • Space still makes the tag exactly as typed ("#pro " creates #pro even if #product exists).
   The list comes from the tags in your notes' block indexes, so it is instant and works offline.
   ========================================================================== */

import { escapeHtml, parseTags, tagHue } from '../core/utils.js';
import { caretBlock } from './normalize.js';
import { commitTag } from './tags.js';

const MAX_ITEMS = 6;

export function mountTagSuggest(root, { counts }) {
  const pop = document.createElement('div');
  pop.className = 'tag-suggest';
  pop.setAttribute('role', 'listbox');
  pop.hidden = true;
  document.body.append(pop);

  let token = null;       // { block, query, start, end }
  let items = [];
  let active = 0;
  let navigated = false;  // has the person used ↑ / ↓ ? (Enter only accepts then)

  /** The "#word" the caret is right after, if any. */
  function findToken() {
    const sel = getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return null;
    const block = caretBlock(root);
    if (!block) return null;
    const caret = sel.getRangeAt(0);
    const host = caret.startContainer.nodeType === 1 ? caret.startContainer : caret.startContainer.parentElement;
    if (host?.closest('code')) return null;
    const before = document.createRange();
    before.setStart(block, 0);
    before.setEnd(caret.startContainer, caret.startOffset);
    const typed = before.toString().replace(/\u00a0/g, ' ');
    const m = typed.match(/(?:^|\s)#(\p{L}[\p{L}\p{N}_-]*)?$/u);
    if (!m) return null;
    const word = m[1] || '';
    return { block, query: word.toLowerCase(), start: typed.length - 1 - word.length, end: typed.length };
  }

  function candidates(t) {
    const all = new Map(counts());
    root.querySelectorAll('[data-tags]').forEach((b) => parseTags(b.getAttribute('data-tags')).forEach((x) => { if (!all.has(x)) all.set(x, 1); }));
    const own = new Set(parseTags(t.block.getAttribute('data-tags')));
    const q = t.query;
    return [...all]
      .filter(([tag]) => !own.has(tag) && tag.includes(q))
      .map(([tag, count]) => ({ tag, count, starts: tag.startsWith(q) }))
      .sort((a, b) => (b.starts - a.starts) || (b.count - a.count) || a.tag.localeCompare(b.tag))
      .slice(0, MAX_ITEMS);
  }

  function place() {
    const sel = getSelection();
    const r = sel.getRangeAt(0).cloneRange();
    r.collapse(true);
    let rect = r.getClientRects()[0] || r.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height && !rect.top)) rect = token.block.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    const below = rect.bottom + 6;
    const top = below + pr.height > innerHeight - 8 ? Math.max(8, rect.top - pr.height - 6) : below;
    pop.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - pr.width - 8))}px`;
    pop.style.top = `${top}px`;
  }

  function render() {
    pop.innerHTML = items.map((it, i) => {
      const q = token.query;
      const at = it.tag.indexOf(q);
      const name = q && at >= 0
        ? `${escapeHtml(it.tag.slice(0, at))}<b>${escapeHtml(q)}</b>${escapeHtml(it.tag.slice(at + q.length))}`
        : escapeHtml(it.tag);
      return `<button type="button" role="option" class="tag-suggest__item${i === active ? ' is-active' : ''}" data-tag="${escapeHtml(it.tag)}" style="--tag-h:${tagHue(it.tag)}">
        <span class="tag-suggest__dot"></span><span class="tag-suggest__name">#${name}</span><span class="tag-suggest__count">${it.count}</span></button>`;
    }).join('');
  }

  function hide() { pop.hidden = true; items = []; token = null; }

  function update() {
    token = findToken();
    if (!token) { hide(); return; }
    items = candidates(token);
    if (!items.length) { hide(); return; }
    active = Math.min(active, items.length - 1);
    pop.hidden = false;
    render();
    place();
  }

  function accept(tag) {
    if (!token) return;
    const t = token;
    hide();
    if (commitTag(t.block, t.start, t.end, tag)) root.dispatchEvent(new Event('input', { bubbles: true }));
  }

  const onInput = (e) => {
    if (e.isComposing) return;
    { const a = getSelection().anchorNode; if ((a?.nodeType === 1 ? a : a?.parentElement)?.closest('pre')) { hide(); return; } } // no tags inside code
    if (e.inputType && !/^(insertText|deleteContent|insertFromPaste)/.test(e.inputType)) { hide(); return; }
    active = 0;
    navigated = false;
    update();
  };

  const onKeyDown = (e) => {
    if (pop.hidden) return;
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    if (e.key === 'ArrowDown') { stop(); navigated = true; active = (active + 1) % items.length; render(); }
    else if (e.key === 'ArrowUp') { stop(); navigated = true; active = (active - 1 + items.length) % items.length; render(); }
    else if (e.key === 'Tab' && !e.shiftKey) { stop(); accept(items[active].tag); }
    else if (e.key === 'Enter' && navigated) { stop(); accept(items[active].tag); }
    else if (e.key === 'Escape') { stop(); hide(); }
  };

  const onPopDown = (e) => { if (e.target.closest('.tag-suggest__item')) e.preventDefault(); }; // keep the caret
  const onPopClick = (e) => { const b = e.target.closest('.tag-suggest__item'); if (b) accept(b.dataset.tag); };
  const onSelection = () => { if (!pop.hidden && !findToken()) hide(); };
  const onScroll = () => { if (!pop.hidden) hide(); };

  root.addEventListener('input', onInput);
  root.addEventListener('keydown', onKeyDown, true);   // before the editor's own Enter / Tab handling
  root.addEventListener('blur', hide);
  pop.addEventListener('mousedown', onPopDown);
  pop.addEventListener('click', onPopClick);
  document.addEventListener('selectionchange', onSelection);
  document.addEventListener('scroll', onScroll, true);

  return () => {
    root.removeEventListener('input', onInput);
    root.removeEventListener('keydown', onKeyDown, true);
    root.removeEventListener('blur', hide);
    document.removeEventListener('selectionchange', onSelection);
    document.removeEventListener('scroll', onScroll, true);
    pop.remove();
  };
}
