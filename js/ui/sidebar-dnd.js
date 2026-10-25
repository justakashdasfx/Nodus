/* ============================================================================
   SIDEBAR DRAG — drag a note (in the sidebar) onto a notebook, or onto Inbox, to move it there.
   The notes are dragged with the browser's own drag and drop; the drop target is lit while you hover it.
   (Dragging a BLOCK onto a note in the sidebar is in js/editor/block-handle.js.)  Look: .is-drop-target in css/layout.css
   ========================================================================== */

export function initSidebarDnd(onMove) {
  const TYPE = 'text/x-nodus-note';
  let lit = null;

  const idOfLink = (a) => (a?.getAttribute('href') || '').split('/').pop();
  const zoneOf = (el) => el?.closest?.('#sidebar .tree-folder, #sidebar a.nav-item[href="#/inbox"]') || null;
  const folderOf = (zone) => (zone.matches('a.nav-item') ? '' : idOfLink(zone.querySelector('.tree-link')));
  const light = (zone) => { if (lit === zone) return; lit?.classList.remove('is-drop-target'); lit = zone; lit?.classList.add('is-drop-target'); };

  document.addEventListener('dragstart', (e) => {
    const a = e.target.closest?.('#sidebar .tree-note .tree-link');
    if (!a) return;
    e.dataTransfer.setData(TYPE, idOfLink(a));
    e.dataTransfer.effectAllowed = 'move';
    a.closest('.tree-note').classList.add('is-dragging');
  });
  document.addEventListener('dragover', (e) => {
    if (!e.dataTransfer?.types.includes(TYPE)) return;
    const zone = zoneOf(e.target);
    if (!zone) { light(null); return; }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    light(zone);
  });
  document.addEventListener('drop', (e) => {
    if (!e.dataTransfer?.types.includes(TYPE)) return;
    const zone = zoneOf(e.target);
    light(null);
    if (!zone) return;
    e.preventDefault();
    onMove(e.dataTransfer.getData(TYPE), folderOf(zone) || null);
  });
  document.addEventListener('dragend', () => {
    light(null);
    document.querySelectorAll('#sidebar .is-dragging').forEach((n) => n.classList.remove('is-dragging'));
  });
}
