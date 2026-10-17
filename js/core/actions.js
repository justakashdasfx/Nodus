/* ============================================================================
   ACTIONS — one delegated click handler for the whole app.
   Any element with data-action="name" calls the handler registered under
   that name. Elements with data-change="name" do the same for <select> changes.
   ========================================================================== */

const clickHandlers = {};
const changeHandlers = {};

export const registerActions = (map) => Object.assign(clickHandlers, map);
export const registerChanges = (map) => Object.assign(changeHandlers, map);

export function initActions() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    const fn = el && clickHandlers[el.dataset.action];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    const fn = el && changeHandlers[el.dataset.change];
    if (fn) fn(el, e);
  });
}
