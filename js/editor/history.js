/* ============================================================================
   HISTORY — the editor's own undo / redo.

   The browser's built-in undo cannot follow edits made by code (moving or deleting a block, removing a
   tag, the block menu …), so the editor keeps its own: a list of snapshots of the note.
   • Typing is grouped: a pause of 0.6 s, an Enter or a format change starts a new step.
   • Moves, duplicates, deletes, "turn into" and tag removal are each exactly one step.
   • Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl+Y redoes (shortcuts in config.js), and the browser's
     own Edit → Undo menu is routed here too.
   ========================================================================== */

import { CONFIG } from '../core/config.js';
import { matches } from '../core/keys.js';

const MAX_STEPS = 150;
const IDLE_MS = 600;
const PLAIN_TYPING = new Set(['insertText', 'deleteContentBackward', 'deleteContentForward', 'insertCompositionText']);

export function mountHistory(root) {
  let steps = [];
  let at = -1;
  let pending = false;
  let timer = 0;
  let restoring = false;

  /* The snapshot ignores classes and inline styles (is-active, margin for tags …) so they never create steps. */
  const htmlNow = () => root.innerHTML.replace(/\s(?:class|style)="[^"]*"/g, '');

  const pathOf = (node) => {
    const path = [];
    while (node && node !== root) { path.unshift([...node.parentNode.childNodes].indexOf(node)); node = node.parentNode; }
    return node === root ? path : null;
  };
  const nodeAt = (path) => path.reduce((n, i) => n?.childNodes[i], root);

  function saveSel() {
    const s = getSelection();
    if (!s || !s.rangeCount || !root.contains(s.anchorNode) || !root.contains(s.focusNode)) return null;
    return { a: pathOf(s.anchorNode), ao: s.anchorOffset, f: pathOf(s.focusNode), fo: s.focusOffset };
  }
  function restoreSel(k) {
    if (!k || !k.a || !k.f) return;
    const a = nodeAt(k.a), f = nodeAt(k.f);
    if (!a || !f) return;
    const len = (n) => (n.nodeType === 3 ? n.nodeValue.length : n.childNodes.length);
    try { getSelection().setBaseAndExtent(a, Math.min(k.ao, len(a)), f, Math.min(k.fo, len(f))); } catch { /* ignore */ }
  }

  const capture = () => ({ html: htmlNow(), sel: saveSel() });

  /** Turns the changes since the last step into a step of their own. */
  function commit() {
    clearTimeout(timer);
    if (!pending) return;
    pending = false;
    const now = capture();
    const top = steps[at];
    if (top && top.html === now.html) { top.sel = now.sel; return; }
    steps = steps.slice(0, at + 1);
    steps.push(now);
    if (steps.length > MAX_STEPS) steps.shift();
    at = steps.length - 1;
  }

  /** Call after code changed the note (move, delete …): that change becomes one step, right now. */
  function record() { pending = true; commit(); }

  function go(target) {
    commit();
    if (target < 0 || target >= steps.length) return;
    at = target;
    restoring = true;
    root.innerHTML = steps[at].html;
    restoreSel(steps[at].sel);
    restoring = false;
    root.dispatchEvent(new Event('input', { bubbles: true })); // autosave, tag margin, word count …
  }
  const undo = () => go(at - 1);
  const redo = () => go(at + 1);

  const dirty = () => { if (restoring) return; pending = true; clearTimeout(timer); timer = setTimeout(commit, IDLE_MS); };

  const onBeforeInput = (e) => {
    if (e.inputType === 'historyUndo') { e.preventDefault(); undo(); return; }
    if (e.inputType === 'historyRedo') { e.preventDefault(); redo(); return; }
    if (!restoring && !e.isComposing && !PLAIN_TYPING.has(e.inputType)) commit(); // Enter, format … start a new step
  };
  const onInput = (e) => { if (!e.isComposing) dirty(); };
  const onCompositionEnd = () => dirty();
  const onKeyDown = (e) => {
    const SK = CONFIG.shortcuts;
    if (matches(e, SK['edit.undo'])) { e.preventDefault(); undo(); }
    else if (matches(e, SK['edit.redo']) || matches(e, SK['edit.redo.alt'])) { e.preventDefault(); redo(); }
  };

  steps = [capture()];
  at = 0;
  root.addEventListener('beforeinput', onBeforeInput);
  root.addEventListener('input', onInput);
  root.addEventListener('compositionend', onCompositionEnd);
  root.addEventListener('keydown', onKeyDown);

  return {
    commit, record, undo, redo,
    stop() {
      clearTimeout(timer);
      root.removeEventListener('beforeinput', onBeforeInput);
      root.removeEventListener('input', onInput);
      root.removeEventListener('compositionend', onCompositionEnd);
      root.removeEventListener('keydown', onKeyDown);
    },
  };
}
