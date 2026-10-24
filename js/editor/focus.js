/* ============================================================================
   FOCUS — marks the paragraph you are writing in with .is-active.
   CSS (editor.css) makes that block brighter and the rest muted.
   The class is stripped before saving (see sanitizeHtml), so it never persists.
   ========================================================================== */

const BLOCKS = 'li, p, div, h1, h2, h3, h4, blockquote, pre';

export function initFocusTracking(root) {
  const update = () => {
    const sel = getSelection();
    if (!sel.rangeCount || !root.contains(sel.anchorNode)) return;
    const el = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
    const block = el?.closest(BLOCKS);
    if (!block || block === root || !root.contains(block)) return;
    const prev = root.querySelector('.is-active');
    if (prev === block) return;
    prev?.classList.remove('is-active');
    block.classList.add('is-active');
  };
  document.addEventListener('selectionchange', update);
  return () => document.removeEventListener('selectionchange', update);
}
