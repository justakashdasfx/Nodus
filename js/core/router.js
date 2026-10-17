/* ============================================================================
   ROUTER — tiny hash router.
     #/home  #/inbox  #/notebooks  #/notebook/<id>  #/journal  #/trash  #/note/<id>[/<blockId>]  #/tag/<name>
   Links in the UI are plain <a href="#/…"> anchors, so no click handlers needed.
   ========================================================================== */

export function parseRoute() {
  const [, view = 'home', rawId = null, block = null] = location.hash.replace(/^#/, '').split('/');
  let id = rawId;
  if (view === 'tag' && rawId) { try { id = decodeURIComponent(rawId); } catch { id = rawId; } }
  return { view, id, block }; // block: scroll to this block when a note opens
}

export const go = (path) => { location.hash = path; };

export function startRouter(onChange) {
  window.addEventListener('hashchange', () => onChange(parseRoute()));
  onChange(parseRoute());
}
