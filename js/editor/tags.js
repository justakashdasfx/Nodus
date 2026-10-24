/* ============================================================================
   TAGS — type  #tag  + space  anywhere in a block and the tag moves into the right margin.

   • A tag starts with a letter, then letters / digits / _ / -   ("#1" and "C#" are left alone).
   • A block can have several tags. Tags are lower-case, so #Todo and #todo are the same tag.
   • Click a tag's name to see every block with that tag (the tag page, #/tag/<name>). Click its × to remove it from the block.
   • Tags live on the block as  data-tags="todo work"  and are copied into the note's block index.

   The margin ("rail") is a separate layer next to the editor, never inside the text.
   On narrow windows there is no room beside the text, so each block's tags sit right after its last word
   (if the last line is too full, only that block's text wraps a little earlier to make room).
   Placement: config.js → tags.  Look: --tag-* and --rail-* in css/tokens.css.
   ========================================================================== */

import { escapeHtml, parseTags, tagHue, TAG_RE, MAX_TAGS_PER_BLOCK } from '../core/utils.js';
import { CONFIG } from '../core/config.js';
import { caretBlock } from './normalize.js';


function rangeFor(block, start, end) {
  const range = document.createRange();
  const walker = document.createTreeWalker(block, 4 /* SHOW_TEXT */);
  let pos = 0, started = false, node;
  while ((node = walker.nextNode())) {
    const len = node.nodeValue.length;
    if (!started && start <= pos + len) { range.setStart(node, start - pos); started = true; }
    if (started && end <= pos + len) { range.setEnd(node, end - pos); return range; }
    pos += len;
  }
  return null;
}

/** The box where a block's own text ends (its last line; sub-lists are not counted). null if the block is empty. */
function endRect(block) {
  const r = document.createRange();
  r.setStart(block, 0);
  const sub = block.querySelector(':scope > ul, :scope > ol');
  if (sub) r.setEndBefore(sub); else r.setEnd(block, block.childNodes.length);
  const rects = [...r.getClientRects()].filter((q) => q.height > 0);
  return rects[rects.length - 1] || null;
}

const tagsOf = (block) => parseTags(block.getAttribute('data-tags'));
function setTags(block, tags) {
  if (tags.length) block.setAttribute('data-tags', tags.join(' '));
  else block.removeAttribute('data-tags');
}

/**
 * The space that was in front of the removed tag is now a trailing space, and Chrome deletes such a space
 * when you type the next character ("para #a #b" would become "para#b"). A non-breaking space survives.
 */
function keepTrailingSpace(block, caret) {
  const node = caret.startContainer;
  if (node.nodeType !== 3 || caret.startOffset !== node.nodeValue.length || !/ $/.test(node.nodeValue)) return;
  const tail = document.createRange();
  tail.setStart(node, node.nodeValue.length);
  const sub = block.querySelector('ul, ol');
  if (sub) tail.setEnd(sub, 0); else tail.setEnd(block, block.childNodes.length);
  if (tail.toString().trim() !== '') return; // more text follows → a normal space is fine
  node.nodeValue = node.nodeValue.slice(0, -1) + '\u00a0';
  const r = document.createRange();
  r.setStart(node, node.nodeValue.length);
  r.collapse(true);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
}

/** Looks for "#tag " just before the caret (the space was just typed). Returns true if a tag was moved. */
export function convertTagAtCaret(root) {
  const sel = getSelection();
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
  const block = caretBlock(root);
  if (!block) return false;
  const caret = sel.getRangeAt(0);
  if ((caret.startContainer.nodeType === 1 ? caret.startContainer : caret.startContainer.parentElement)?.closest('code')) return false;

  const before = document.createRange();
  before.setStart(block, 0);
  before.setEnd(caret.startContainer, caret.startOffset);
  const typed = before.toString().replace(/\u00a0/g, ' ');

  const m = typed.match(/(?:^|\s)#(\p{L}[\p{L}\p{N}_-]*) $/u);
  if (!m || !TAG_RE.test(m[1])) return false;

  const tag = m[1].toLowerCase();
  const tags = tagsOf(block);
  if (!tags.includes(tag) && tags.length >= MAX_TAGS_PER_BLOCK) return false;

  const start = typed.length - (m[1].length + 2); // the "#", the word and the space
  return commitTag(block, start, typed.length, tag);
}

/** Removes the text between start and end (offsets inside the block's text) and adds `tag` to the block. */
export function commitTag(block, start, end, tag) {
  const sel = getSelection();
  const range = rangeFor(block, start, end);
  if (!range) return false;

  range.deleteContents();
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  block.normalize();
  keepTrailingSpace(block, range);
  if (!block.textContent && !block.querySelector('br')) {
    const br = document.createElement('br');
    block.prepend(br);
    const r = document.createRange();
    r.setStart(block, 0);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  const tags = tagsOf(block);
  if (!tags.includes(tag)) setTags(block, [...tags, tag]);
  return true;
}

/** Wires the margin, the live conversion and the layout. Returns a cleanup function. */
export function mountTagRail(root, { editable = true } = {}) {
  const note = root.closest('.note');
  const col = root.closest('.note__col');
  const rail = note?.querySelector('.tag-rail'); // looked up inside this editor's own page, so two editors never share a rail
  if (!rail || !note || !col) return () => {};

  const cssPx = (name, fallback) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || fallback;

  function layout() {
    const railWidth = cssPx('--rail-width', 120);
    const gap = cssPx('--rail-gap', 20);
    const compact = (note.clientWidth - col.offsetWidth) / 2 < gap + railWidth + 8;
    rail.classList.toggle('is-compact', compact);

    const tagged = [...root.querySelectorAll('[data-tags]')].filter((b) => tagsOf(b).length);

    // Room made at the end of a block's last line for its tags (narrow layout). Cleared and redone on every layout.
    root.querySelectorAll('[style*="padding-right"]').forEach((b) => {
      b.style.removeProperty('padding-right');
      if (!b.getAttribute('style')) b.removeAttribute('style');
    });
    if (!tagged.length) { rail.innerHTML = ''; return; }

    const chip = (tag) => `<span class="tag-chip" data-tag="${escapeHtml(tag)}" style="--tag-h:${tagHue(tag)}">`
      + `<a class="tag-chip__label" href="#/tag/${encodeURIComponent(tag)}" title="Show every block tagged #${escapeHtml(tag)}">#${escapeHtml(tag)}</a>`
      + (editable ? `<button type="button" class="tag-chip__x" title="Remove this tag from the block" aria-label="Remove tag ${escapeHtml(tag)}">×</button>` : '')
      + `</span>`;

    rail.innerHTML = tagged.map((b) => `<div class="tag-group" data-bid="${escapeHtml(b.getAttribute('data-bid') || '')}">${tagsOf(b).map(chip).join('')}</div>`).join('');
    const groups = [...rail.children];

    if (compact) {
      // Narrow: the tags follow the last word of their block, in document order (an earlier block may have grown).
      tagged.forEach((b, i) => {
        const group = groups[i];
        const need = group.offsetWidth + CONFIG.tags.inlineGap;
        let last = endRect(b);
        let box = b.getBoundingClientRect();
        if (last && last.right + need > box.right) { b.style.paddingRight = need + 'px'; last = endRect(b); box = b.getBoundingClientRect(); }
        const body = rail.parentElement.getBoundingClientRect();
        const x = Math.min((last ? last.right : box.left) + CONFIG.tags.inlineGap - body.left, box.right - body.left - group.offsetWidth);
        const lineH = last ? last.height : Math.min(box.height, 28);
        group.style.left = Math.max(0, x) + 'px';
        group.style.top = ((last ? last.top : box.top) - body.top + (lineH - group.offsetHeight) / 2) + 'px';
      });
      return;
    }

    // Wide: in the right margin, vertically placed by config.js → tags.align; stacked groups never overlap.
    const body = rail.parentElement.getBoundingClientRect();
    const { align, topOffset } = CONFIG.tags;
    let floor = -Infinity;
    tagged.forEach((b, i) => {
      const r = b.getBoundingClientRect();
      const own = endRect(b);                                   // a list item's own text, not its sub-items
      const height = own ? own.bottom - r.top : r.height;
      const h = groups[i].offsetHeight;
      const top = r.top - body.top;
      const want = align === 'top' ? top + topOffset : align === 'bottom' ? top + height - h : top + (height - h) / 2;
      const y = Math.max(want, floor);
      groups[i].style.left = '';
      groups[i].style.top = y + 'px';
      floor = y + h + 4;
    });
  }

  let frame = 0;
  const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; layout(); }); };

  const inCode = () => { const a = getSelection().anchorNode; return !!(a?.nodeType === 1 ? a : a?.parentElement)?.closest('pre'); };
  const onInput = (e) => {
    if (editable && e.inputType === 'insertText' && e.data === ' ' && !e.isComposing && !inCode() && convertTagAtCaret(root)) {
      root.dispatchEvent(new Event('input', { bubbles: true })); // saves, and gives the block its id if it has none yet
    }
    schedule();
  };

  const removeTag = (e) => {
    const x = e.target.closest('button.tag-chip__x');
    if (!x) return;
    const chip = x.closest('.tag-chip');
    const block = root.querySelector(`[data-bid="${chip.closest('.tag-group').dataset.bid}"]`);
    if (!block) return;
    setTags(block, tagsOf(block).filter((t) => t !== chip.dataset.tag));
    root.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const keepFocus = (e) => { if (e.target.closest('.tag-chip__x')) e.preventDefault(); }; // removing a tag must not move the caret

  root.addEventListener('input', onInput);
  if (editable) { rail.addEventListener('mousedown', keepFocus); rail.addEventListener('click', removeTag); }
  const resizer = new ResizeObserver(schedule);
  resizer.observe(note);
  resizer.observe(root);
  document.fonts?.ready.then(schedule);
  schedule();

  return () => {
    root.removeEventListener('input', onInput);
    rail.removeEventListener('mousedown', keepFocus);
    rail.removeEventListener('click', removeTag);
    resizer.disconnect();
    cancelAnimationFrame(frame);
    rail.innerHTML = '';
  };
}
