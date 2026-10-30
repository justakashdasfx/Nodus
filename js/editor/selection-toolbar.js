/* ============================================================================
   SELECTION TOOLBAR — the small floating pill that appears over selected text.
   Italic · Bold · Underline · Quote · Code · Colour (brush) · More (…)

   • Brush opens highlight + text-colour swatches. The last colour you used is
     ringed, and Ctrl/Cmd + Shift + H toggles the last highlight (apply / remove).
   • More is the same "Turn into" list as the six-dot menu (block-menu.js) plus Clear formatting.
   • Ctrl/Cmd + E toggles inline code.
   ========================================================================== */

import { CONFIG } from '../core/config.js';
import { icon } from '../core/icons.js';
import { getLastColor, setLastColor } from '../core/settings.js';
import { applyInline, removeInline, clearAllInline, selectionHasInline } from './inline.js';
import { matches } from '../core/keys.js';
import { setBlock } from './blocks.js';
import { caretBlock } from './normalize.js';
import { menuModel, renderMenu, runAction } from './block-menu.js';

const exec = (cmd, value) => document.execCommand(cmd, false, value);

const cmdButton = (cmd, iconName, label) =>
  `<button type="button" class="sel-btn" data-cmd="${cmd}" aria-label="${label}" title="${label}">${icon(iconName, 16)}</button>`;

function colorPopup() {
  const lastH = getLastColor('highlight');
  const lastT = getLastColor('text');
  const hl = CONFIG.colors.map(c =>
    `<button type="button" class="swatch swatch--hl ${c.id === lastH ? 'is-last' : ''}" data-hl="${c.id}" aria-label="Highlight ${c.label}" style="--c:var(--hl-${c.id}-fg);--bg:var(--hl-${c.id}-bg)">A</button>`).join('');
  const tc = CONFIG.colors.map(c =>
    `<button type="button" class="swatch swatch--tc ${c.id === lastT ? 'is-last' : ''}" data-tc="${c.id}" aria-label="Text ${c.label}" style="--c:var(--hl-${c.id}-fg)"></button>`).join('');
  return `
    <div class="sel-pop__section"><span class="sel-pop__label">Highlight</span>
      <div class="swatches">${hl}<button type="button" class="swatch swatch--none" data-hl="none" aria-label="Remove highlight">${icon('close', 12)}</button></div></div>
    <div class="sel-pop__section"><span class="sel-pop__label">Text color</span>
      <div class="swatches">${tc}<button type="button" class="swatch swatch--none" data-tc="none" aria-label="Default text color">${icon('close', 12)}</button></div></div>`;
}

/** "…" = the six-dot menu's "Turn into" list (same look), plus Clear formatting for the selection. */
function moreMenu(root) {
  const block = caretBlock(root);
  if (!block) return '';
  const model = menuModel(block, { turnOnly: true, extra: [{ items: [{ act: 'clear', label: 'Clear formatting', ic: 'clear', words: 'remove format reset' }] }] });
  return `<div class="block-menu block-menu--inline" role="menu">${renderMenu(model).html}</div>`;
}

export function initFormatting(root, history = { commit() {}, record() {} }) {
  const bar = document.createElement('div');
  bar.className = 'sel-toolbar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Text formatting');
  bar.innerHTML = `
    ${cmdButton('italic', 'italic', 'Italic')}
    ${cmdButton('bold', 'bold', 'Bold')}
    ${cmdButton('underline', 'underline', 'Underline')}
    ${cmdButton('quote', 'quote', 'Quote')}
    ${cmdButton('code', 'code', 'Code')}
    <button type="button" class="sel-btn" data-cmd="color" aria-label="Color" title="Color">${icon('brush', 16)}<span class="sel-btn__dot"></span></button>
    ${cmdButton('more', 'more', 'More')}
    <div class="sel-pop" hidden></div>`;
  document.body.append(bar);

  const pop = bar.querySelector('.sel-pop');
  const dot = bar.querySelector('.sel-btn__dot');
  let openPopup = null; // 'color' | 'more' | null

  /* ---------- helpers ---------- */

  const currentRange = () => {
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed || !root.contains(sel.anchorNode)) return null;
    if ((sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement)?.closest('pre')) return null; // no formatting toolbar inside code
    return sel.getRangeAt(0);
  };
  const notify = () => root.dispatchEvent(new Event('input', { bubbles: true })); // triggers autosave
  const updateDot = () => { dot.style.background = `var(--hl-${getLastColor('highlight')}-fg)`; };

  function closePopup() { openPopup = null; pop.hidden = true; pop.innerHTML = ''; }
  function togglePopup(kind) {
    if (openPopup === kind) { closePopup(); return; }
    openPopup = kind;
    pop.className = `sel-pop sel-pop--${kind}`;
    pop.innerHTML = kind === 'color' ? colorPopup() : moreMenu(root);
    pop.hidden = false;
  }

  /* ---------- actions ---------- */

  function toggleCode() {
    const range = currentRange();
    if (!range) return;
    if (selectionHasInline(root, range, 'code')) removeInline(root, range, 'code');
    else applyInline(root, range, { tag: 'code' });
    notify();
  }

  function setHighlight(id) {
    const range = currentRange();
    if (!range) return;
    if (id === 'none') removeInline(root, range, 'mark[data-hl]');
    else { applyInline(root, range, { tag: 'mark', attr: 'data-hl', value: id }); setLastColor('highlight', id); updateDot(); }
    notify();
  }

  /** Mod+Shift+H: apply last highlight, or remove it if the selection is already that colour. */
  function toggleLastHighlight() {
    const range = currentRange();
    if (!range) return;
    const last = getLastColor('highlight');
    if (selectionHasInline(root, range, `mark[data-hl="${last}"]`)) {
      removeInline(root, range, 'mark[data-hl]');
    } else {
      applyInline(root, range, { tag: 'mark', attr: 'data-hl', value: last });
      setLastColor('highlight', last);
      updateDot();
    }
    notify();
  }

  function setTextColor(id) {
    const range = currentRange();
    if (!range) return;
    if (id === 'none') removeInline(root, range, 'span[data-tc]');
    else { applyInline(root, range, { tag: 'span', attr: 'data-tc', value: id }); setLastColor('text', id); }
    notify();
  }

  function runMenuAct(act) {
    if (act === 'clear') { const r = currentRange(); if (r) { clearAllInline(root, r); notify(); } return; }
    const block = caretBlock(root);
    if (block) runAction(root, history, act, block, { place: false }); // keeps your text selected
  }

  function runCommand(cmd) {
    if (cmd === 'italic' || cmd === 'bold' || cmd === 'underline') exec(cmd);
    else if (cmd === 'quote') setBlock(root, 'blockquote', true);
    else if (cmd === 'code') toggleCode();
    else if (cmd === 'color' || cmd === 'more') { togglePopup(cmd); return; }
    refreshState();
  }

  /* ---------- position + state ---------- */

  function refreshState() {
    const set = (cmd, on) => bar.querySelector(`[data-cmd="${cmd}"]`)?.classList.toggle('is-on', on);
    try {
      set('bold', document.queryCommandState('bold'));
      set('italic', document.queryCommandState('italic'));
      set('underline', document.queryCommandState('underline'));
      set('quote', String(document.queryCommandValue('formatBlock')).toLowerCase() === 'blockquote');
      const range = currentRange();
      set('code', !!range && selectionHasInline(root, range, 'code'));
    } catch { /* queryCommandState can throw in odd selection states */ }
  }

  function place(range) {
    const rect = range.getClientRects()[0] || range.getBoundingClientRect();
    bar.classList.add('is-open');
    const w = bar.offsetWidth, h = bar.offsetHeight;
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - w / 2, innerWidth - w - 8));
    let top = rect.top - h - 10;
    if (top < 8) top = rect.bottom + 10;
    bar.style.left = `${left}px`;
    bar.style.top = `${top}px`;
    bar.classList.toggle('is-right', left > innerWidth / 2);
  }

  const hide = () => { bar.classList.remove('is-open'); closePopup(); };

  let frame = 0;
  function update() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const range = root.isContentEditable ? currentRange() : null;
      if (!range) { hide(); return; }
      place(range);
      refreshState();
    });
  }

  /* ---------- events ---------- */

  const onBarMouseDown = (e) => { if (!e.target.closest('input')) e.preventDefault(); }; // keep the selection
  const onBarClick = (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.cmd)   runCommand(t.dataset.cmd);
    else if (t.dataset.hl)    { setHighlight(t.dataset.hl); closePopup(); }
    else if (t.dataset.tc)    { setTextColor(t.dataset.tc); closePopup(); }
    else if (t.dataset.act)   { runMenuAct(t.dataset.act); closePopup(); refreshState(); }
  };
  const onKeydown = (e) => {
    if (matches(e, CONFIG.shortcuts['format.lastHighlight'])) { e.preventDefault(); toggleLastHighlight(); }
    else if (matches(e, CONFIG.shortcuts['format.code'])) { e.preventDefault(); toggleCode(); }
  };

  bar.addEventListener('mousedown', onBarMouseDown);
  bar.addEventListener('click', onBarClick);
  root.addEventListener('keydown', onKeydown);
  document.addEventListener('selectionchange', update);
  window.addEventListener('resize', update);
  document.addEventListener('scroll', update, true);
  updateDot();

  return () => {
    cancelAnimationFrame(frame);
    document.removeEventListener('selectionchange', update);
    window.removeEventListener('resize', update);
    document.removeEventListener('scroll', update, true);
    root.removeEventListener('keydown', onKeydown);
    bar.remove();
  };
}
