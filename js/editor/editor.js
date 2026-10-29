/* ============================================================================
   EDITOR — mounts the writing surface for one note.

   • A plain contenteditable (no framework). Content is stored as clean HTML.
   • Blocks: every paragraph / heading / quote / list item has a permanent id (normalize.js); #tags go to the margin (tags.js).
   • Autosave: every pause in typing → store.updateNoteContent() → sync.js.
   • Paste keeps structure (headings, lists, bold…) but drops site styling.
     Ctrl/Cmd+Shift+V pastes as plain text.
   • Returns a cleanup function; the router calls it before leaving the note.
   ========================================================================== */

import { CONFIG } from '../core/config.js';
import * as store from '../core/store.js';
import { matches } from '../core/keys.js';
import { debounce, escapeHtml, sanitizeHtml, statsLabel } from '../core/utils.js';
import { getStatsMode } from '../core/settings.js';
import { initFormatting } from './selection-toolbar.js';
import { initShortcuts } from './shortcuts.js';
import { initFocusTracking } from './focus.js';
import { initTodoInteractions } from './lists.js';
import { mountDue } from './due.js';
import { cleanPastedHtml } from './paste.js';
import { reconcile, snapshotCaret } from './normalize.js';
import { mountTagRail } from './tags.js';
import { mountHistory } from './history.js';
import { mountCode } from './code-block.js';
import { mountBlockRules } from './block-rules.js';
import { mountThreadBlocks } from './thread-block.js';
import { mountMapBlocks } from './map-block.js';
import { mountNoteLinks } from './note-link.js';
import { mountNoteMentions } from './note-mention.js';
import { mountExtraBlocks } from './blocks-extra.js';
import { mountBlockSelect } from './block-select.js';
import { idFactory } from './block-ops.js';
import { ownText } from '../core/blockindex.js';
import { placeCaret } from './block-menu.js';
import { mountBlockHandle } from './block-handle.js';
import { mountSlashMenu } from './slash-menu.js';
import { mountTagSuggest } from './tag-suggest.js';

/** The editor that last had the cursor. The top bar's word count and "As text" follow it when two editors are open. */
let lastFocused = null;
export const focusedEditor = () => (lastFocused?.isConnected ? lastFocused : null);

/** Writes "342 words · 2 min read" into every count on screen (top bar, and the note's own bar on phones). */
function writeStats(el) {
  const label = statsLabel(el.innerText, getStatsMode());
  document.querySelectorAll('[data-note-stats]').forEach((t) => { t.textContent = label; });
}
/** Re-draws the count for the editor you last used (after switching words ⇄ characters). */
export function refreshStats() {
  const el = focusedEditor() || document.querySelector('#view .editor');
  if (el) writeStats(el);
}

function placeCaretAtEnd(el) {
  const last = el.lastElementChild;
  if (!last) return;
  const range = document.createRange();
  range.selectNodeContents(last);
  range.collapse(!last.textContent); // empty block → caret at its start
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function insertPlain(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length === 1) document.execCommand('insertText', false, text);
  else document.execCommand('insertHTML', false, lines.map(l => `<p>${escapeHtml(l) || '<br>'}</p>`).join(''));
}

export function mountEditor(el, note, { readOnly = false } = {}) {
  el.innerHTML = sanitizeHtml(note.html) || '<p><br></p>';
  el.dataset.focus = CONFIG.defaults.focusMode;
  el.dataset.noteId = note.id; // which note this editor holds (two can be open at once)
  reconcile(el); // every block gets its id (the margin tags need it)

  /* "342 words · 2 min read" in the top bar (looked up each time: the top bar can be redrawn under us). */
  const updateStats = () => {
    const other = focusedEditor();
    if (other && other !== el) return; // the cursor is in the other editor: its numbers are the ones showing
    writeStats(el);
  };
  updateStats();

  if (readOnly) {
    el.contentEditable = 'false';
    const stopCodeRO = mountCode(el, null, { readOnly: true }); // colours and a Copy button, no editing
    const stopRail = mountTagRail(el, { editable: false });
    const stopDueRO = mountDue(el, { editable: false });   // the dates next to checklist items
    const stopThreadsRO = mountThreadBlocks(el, { readOnly: true });   // Threads blocks, read-only
    const stopMapsRO = mountMapBlocks(el, { readOnly: true });         // Mind map blocks, read-only
    const stopLinksRO = mountNoteLinks(el, { readOnly: true });         // links to other notes: clickable
    const stopMentionsRO = mountNoteMentions(el, { readOnly: true });   // mentions: clickable
    return () => { stopCodeRO(); stopRail?.(); stopDueRO(); stopThreadsRO(); stopMapsRO(); stopLinksRO(); stopMentionsRO(); };
  }

  el.contentEditable = 'true';
  document.execCommand('defaultParagraphSeparator', false, 'p'); // Enter creates <p>, not <div>
  document.execCommand('styleWithCSS', false, false);            // bold/italic as tags, not inline styles

  /* ---- Blocks: ids stay unique and follow their block (see normalize.js). Registered first so it runs before the other input handlers. ---- */
  const onBeforeInput = () => snapshotCaret(el);
  const onInputBlocks = (e) => { if (!e.isComposing) reconcile(el, e.inputType); };
  const onCompositionEnd = () => reconcile(el);
  el.addEventListener('beforeinput', onBeforeInput);
  el.addEventListener('input', onInputBlocks);
  el.addEventListener('compositionend', onCompositionEnd);

  /* ---- Undo / redo (our own, so moves and menu actions undo too), block handle, #tag suggestions ---- */
  const history = mountHistory(el);
  const stopMentions = mountNoteMentions(el, { history });   // "@" picker: a mention, no backlink
  const stopLinks = mountNoteLinks(el, { history });          // "[[" picker + clickable links (registered first so its keys win)
  const stopThreads = mountThreadBlocks(el, { history });   // Threads blocks ("/" → Threads)
  const stopMapBlocks = mountMapBlocks(el, { history });    // Mind map blocks ("/" → Mind map)
  const stopRules = mountBlockRules(el, { history });   // Enter / Backspace / Ctrl+D rules per block type (registered before the handlers below so it runs first)
  const stopCode = mountCode(el, history);   // code blocks: Enter / Tab / paste, the language bar, colours
  const stopExtra = mountExtraBlocks(el, { history });   // callout, toggle behaviour
  const stopSelect = mountBlockSelect(el, { history });  // drag in the empty space beside the text to select whole blocks
  const stopDue = mountDue(el);              // due dates: "@" in a checklist item (registered early so its menu keys come first)

  /* ---- Autosave ---- */
  const save = debounce(() => store.updateNoteContent(note.id, sanitizeHtml(el.innerHTML)), CONFIG.timing.saveDebounce);
  const flushOnHide = () => { if (document.visibilityState === 'hidden') save.flush(); };
  /* Ctrl/Cmd+S: save this note right now (and keep the browser's own "save page" away) */
  const onSaveKey = (e) => {
    if (!matches(e, CONFIG.shortcuts['save.now'])) return;
    const f = focusedEditor();
    if (f && f !== el) return;
    e.preventDefault();
    save.flush();
    window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Saved' }));
  };
  document.addEventListener('keydown', onSaveKey);

  /* ---- Paste ---- */
  let plainNext = false; // set by Ctrl/Cmd+Shift+V
  const onKeydownPaste = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'v') plainNext = true;
  };
  const onKeyupPaste = () => setTimeout(() => { plainNext = false; }, 0);

  const onPaste = (e) => {
    e.preventDefault();
    const plain = e.clipboardData.getData('text/plain');
    const html = e.clipboardData.getData('text/html');
    const asPlain = plainNext;
    plainNext = false;

    if (!asPlain && html) {
      const cleaned = cleanPastedHtml(html);
      if (cleaned.html) { document.execCommand('insertHTML', false, cleaned.html); return; }
    }
    if (plain) insertPlain(plain);
  };

  const statsSoon = debounce(updateStats, 200);
  const onFocusIn = () => { lastFocused = el; updateStats(); };
  el.addEventListener('focusin', onFocusIn);
  el.addEventListener('input', save);
  el.addEventListener('input', statsSoon);
  el.addEventListener('paste', onPaste);
  el.addEventListener('keydown', onKeydownPaste);
  el.addEventListener('keyup', onKeyupPaste);
  document.addEventListener('visibilitychange', flushOnHide);
  window.addEventListener('pagehide', save.flush);

  const stopFormatting = initFormatting(el, history);
  const stopShortcuts = initShortcuts(el);
  const stopFocus = initFocusTracking(el);
  const stopTodos = initTodoInteractions(el);
  const stopTags = mountTagRail(el);
  const stopHandle = mountBlockHandle(el, history);
  const stopSlash = mountSlashMenu(el, history);
  const stopSuggest = mountTagSuggest(el, { counts: store.tagCounts });

  /* Double-click in the empty space below the last block → a new block there (no need to go back and press Enter) */
  const host = el.closest('.note') || el;
  const onDblClick = (e) => {
    if (e.target.closest('button, a, input, select, .tag-rail, .note__bar, .block-handle')) return;
    if (e.target !== el && el.contains(e.target)) return;      // inside the text: a double-click selects a word as usual
    const last = el.lastElementChild;
    if (last && e.clientY < last.getBoundingClientRect().bottom) return;
    e.preventDefault();
    history.commit();
    let p = last && last.tagName === 'P' && !ownText(last) && !last.hasAttribute('data-callout') ? last : null;
    if (!p) {
      p = document.createElement('p');
      p.setAttribute('data-bid', idFactory(el)());
      p.innerHTML = '<br>';
      el.append(p);
    }
    placeCaret(el, p);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    history.record();
  };
  host.addEventListener('dblclick', onDblClick);

  /* Brand-new note → start typing straight away. */
  if (Date.now() - note.createdAt < 3000) { el.focus(); placeCaretAtEnd(el); }

  return () => {
    save.flush();
    el.removeEventListener('focusin', onFocusIn);
    if (lastFocused === el) lastFocused = null;
    el.removeEventListener('input', save);
    el.removeEventListener('input', statsSoon);
    el.removeEventListener('paste', onPaste);
    el.removeEventListener('keydown', onKeydownPaste);
    el.removeEventListener('keyup', onKeyupPaste);
    document.removeEventListener('visibilitychange', flushOnHide);
    document.removeEventListener('keydown', onSaveKey);
    window.removeEventListener('pagehide', save.flush);
    el.removeEventListener('beforeinput', onBeforeInput);
    el.removeEventListener('input', onInputBlocks);
    el.removeEventListener('compositionend', onCompositionEnd);
    stopFormatting(); stopShortcuts(); stopFocus(); stopTodos(); stopTags(); stopHandle(); stopSlash(); stopSuggest(); stopLinks(); stopMentions(); stopThreads(); stopMapBlocks(); stopRules(); stopCode(); stopDue(); stopExtra(); stopSelect(); host.removeEventListener('dblclick', onDblClick); history.stop();
  };
}
