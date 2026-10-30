/* ============================================================================
   FOLDER DRAG — drag a notebook or a folder (in the sidebar, or on the Notebooks / folder pages) to arrange them.
   Anything with data-fid="<folder id>" and a draggable child (or itself draggable) can be dragged AND dropped on:
     · the middle of a notebook   → the two become a new folder          ("group")
     · the middle of a folder     → the notebook moves into it           ("into")
     · the top / bottom edge      → it goes before / after that item     ("before" / "after"; left / right edge on gallery cards, data-axis="x")
     · empty space on a folder's page (data-into) → it goes into that folder
     · "Notebooks" in the sidebar → it leaves its folder for the top level ("root")
   This file only works out WHERE the drop lands and lights the target; js/app.js does the move (and the Undo toast).
   What is allowed (how deep folders may go): js/core/store.js → canPlace / canGroup, config.js → folders.maxLevels.
   Look of the target: .is-drop-into / -before / -after / -root in css/layout.css.
   ========================================================================== */

import * as store from '../core/store.js';

const TYPE = 'text/x-nodus-folder';
const ROOT = '#sidebar a.nav-item[href="#/notebooks"], #sidebar .sidebar__label-row';
const CLASSES = ['is-drop-into', 'is-drop-before', 'is-drop-after', 'is-drop-root'];

export function initFolderDnd(onDrop) {
  let dragId = null;
  let lit = null;
  let litCls = '';

  const clear = () => { lit?.classList.remove(...CLASSES); lit = null; litCls = ''; };
  const light = (el, cls) => { if (lit === el && litCls === cls) return; clear(); lit = el; litCls = cls; el.classList.add(cls); };
  const reset = () => {
    clear();
    document.querySelectorAll('.is-dragging[data-fid], [data-fid].is-dragging').forEach((n) => n.classList.remove('is-dragging'));
    dragId = null;
  };

  /** Where would a drop here land? → { zone, targetId, el, cls } or null. */
  function decide(e) {
    const root = e.target.closest?.(ROOT);
    if (root) {
      const dragged = store.getFolder(dragId);
      return dragged && store.parentFolder(dragId) ? { zone: 'root', targetId: null, el: root, cls: 'is-drop-root' } : null;   // already at the top: nothing to do
    }
    const el = e.target.closest?.('[data-fid]');
    if (!el) {                                     // empty space on a folder's page: drop = put it in that folder
      const page = e.target.closest?.('[data-into]');
      const into = page?.dataset.into;
      return into && into !== dragId && store.canPlace(dragId, into) && store.parentFolder(dragId)?.id !== into
        ? { zone: 'into', targetId: into, el: page, cls: 'is-drop-into' } : null;
    }
    if (el.dataset.fid === dragId) return null;
    const targetId = el.dataset.fid;
    const dragged = store.getFolder(dragId);
    const target = store.getFolder(targetId);
    if (!dragged || !target) return null;

    const box = el.getBoundingClientRect();
    const f = el.dataset.axis === 'x' ? (e.clientX - box.left) / (box.width || 1) : (e.clientY - box.top) / (box.height || 1);
    const edge = f < 0.5 ? 'before' : 'after';
    const parentId = store.parentFolder(targetId)?.id || null;

    let zone;
    if (store.isCollection(target)) zone = f < 0.25 ? 'before' : f > 0.75 ? 'after' : 'into';
    else if (store.isCollection(dragged)) zone = edge;
    else zone = f < 0.25 ? 'before' : f > 0.75 ? 'after' : 'group';

    if (zone === 'group' && !store.canGroup(dragId, targetId)) zone = edge;                  // no room for another folder level: just put it beside
    if (zone === 'into' ? !store.canPlace(dragId, targetId) : zone !== 'group' && !store.canPlace(dragId, parentId)) return null;
    return { zone, targetId, el, cls: zone === 'before' ? 'is-drop-before' : zone === 'after' ? 'is-drop-after' : 'is-drop-into' };
  }

  document.addEventListener('dragstart', (e) => {
    reset();
    const host = e.target.closest?.('[data-fid]');
    if (!host || !e.dataTransfer) return;
    dragId = host.dataset.fid;
    e.dataTransfer.setData(TYPE, dragId);
    e.dataTransfer.setData('text/plain', '');
    e.dataTransfer.effectAllowed = 'move';
    host.classList.add('is-dragging');
  });

  document.addEventListener('dragover', (e) => {
    if (!dragId || !e.dataTransfer?.types.includes(TYPE)) return;
    const d = decide(e);
    if (!d) { clear(); return; }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    light(d.el, d.cls);
  });

  document.addEventListener('drop', (e) => {
    if (!dragId || !e.dataTransfer?.types.includes(TYPE)) return;
    const d = decide(e);
    const id = dragId;
    reset();                                      // before the move: the page redraws and the source element may be gone
    if (!d) return;
    e.preventDefault();
    onDrop({ dragId: id, zone: d.zone, targetId: d.targetId });
  });

  document.addEventListener('dragend', reset);
}
