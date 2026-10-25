/* ============================================================================
   POP MENU — a small menu that opens under a button (the notebook header's sort and ⋯ menus).
   Same look as the slash / six-dot menus (.block-menu in css/editor.css).
   openPopMenu(buttonElement, items)   item = { label, ic, action, data: { id: '…' }, check, danger }  or  { sep: true }
   An item runs the normal data-action (js/app.js → actions), so a menu entry is just "the action it triggers".
   ========================================================================== */
import { icon } from '../core/icons.js';
import { escapeHtml } from '../core/utils.js';
import { placeMenu } from '../editor/block-menu.js';

let current = null;   // { el, anchor }

export function closePopMenu() {
  if (!current) return;
  current.el.remove();
  current = null;
  document.removeEventListener('mousedown', onOutside, true);
  document.removeEventListener('keydown', onKey, true);
}
function onOutside(e) { if (current && !current.el.contains(e.target) && !current.anchor.contains(e.target)) closePopMenu(); }
function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePopMenu(); } }

export function openPopMenu(anchor, items) {
  const toggleOff = current && current.anchor === anchor;
  closePopMenu();
  if (toggleOff) return;
  const el = document.createElement('div');
  el.className = 'block-menu pop-menu';
  el.setAttribute('role', 'menu');
  el.innerHTML = items.map((it) => it.sep
    ? '<div class="block-menu__sep"></div>'
    : `<button type="button" role="menuitem" class="block-menu__item${it.danger ? ' is-danger' : ''}" data-action="${it.action}"${Object.entries(it.data || {}).map(([k, v]) => ` data-${k}="${escapeHtml(String(v))}"`).join('')}>
        <span class="block-menu__icon">${it.ic ? icon(it.ic, 16) : ''}</span><span class="block-menu__label">${escapeHtml(it.label)}</span>${it.check ? `<span class="block-menu__hint">${icon('check', 14)}</span>` : ''}
      </button>`).join('');
  document.body.append(el);
  placeMenu(el, anchor.getBoundingClientRect());
  current = { el, anchor };
  el.addEventListener('click', () => setTimeout(closePopMenu, 0));      // the action runs first, then the menu closes
  document.addEventListener('mousedown', onOutside, true);
  document.addEventListener('keydown', onKey, true);
}
