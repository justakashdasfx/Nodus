/* ============================================================================
   CALENDAR — a small month picker for dates (used by the due date of a checklist item: "Pick a date…").
   pickDate({ value: 'YYYY-MM-DD', rect }) → 'YYYY-MM-DD' · '' (Clear) · null (closed without choosing).
   rect: where to open it (a DOMRect-like { left, top, bottom }); without it the calendar opens in the middle of the window.
   Weeks start on Monday — change WEEK_STARTS_ON. Look: .calendar in css/gallery.css, colours --calendar-* in css/tokens.css.
   ========================================================================== */

import { icon } from '../core/icons.js';
import { DUE_RE } from '../core/utils.js';

const WEEK_STARTS_ON = 1;   // 1 = Monday, 0 = Sunday
const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

export function pickDate({ value = '', rect = null } = {}) {
  return new Promise((resolve) => {
    const now = new Date();
    const todayIso = iso(now.getFullYear(), now.getMonth(), now.getDate());
    const start = DUE_RE.test(value) ? value : todayIso;
    let y = +start.slice(0, 4);
    let m = +start.slice(5, 7) - 1;

    const el = document.createElement('div');
    el.className = 'calendar';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Pick a date');
    document.body.append(el);

    const days = [...Array(7)].map((_, i) => new Date(2023, 0, 1 + ((i + WEEK_STARTS_ON) % 7)).toLocaleDateString(undefined, { weekday: 'narrow' }));

    function paint() {
      const first = new Date(y, m, 1);
      const lead = (first.getDay() - WEEK_STARTS_ON + 7) % 7;
      const count = new Date(y, m + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < lead; i++) cells.push('<span class="calendar__blank"></span>');
      for (let d = 1; d <= count; d++) {
        const v = iso(y, m, d);
        cells.push(`<button type="button" class="calendar__day${v === todayIso ? ' is-today' : ''}${v === value ? ' is-selected' : ''}" data-d="${v}" aria-label="${new Date(y, m, d).toDateString()}">${d}</button>`);
      }
      el.innerHTML = `
        <div class="calendar__head">
          <button type="button" class="calendar__nav" data-nav="-1" aria-label="Previous month">${icon('arrowLeft', 14)}</button>
          <span class="calendar__title">${new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
          <button type="button" class="calendar__nav" data-nav="1" aria-label="Next month"><span class="calendar__flip">${icon('arrowLeft', 14)}</span></button>
        </div>
        <div class="calendar__grid calendar__week">${days.map(d => `<span>${d}</span>`).join('')}</div>
        <div class="calendar__grid">${cells.join('')}</div>
        <div class="calendar__foot">
          <button type="button" data-d="${todayIso}">Today</button>
          ${value ? '<button type="button" data-d="">Clear</button>' : ''}
        </div>`;
    }

    function place() {
      const w = el.offsetWidth; const h = el.offsetHeight;
      if (!rect) { el.style.left = `${Math.max(8, (innerWidth - w) / 2)}px`; el.style.top = `${Math.max(8, (innerHeight - h) / 2)}px`; return; }
      let top = rect.bottom + 6;
      if (top + h > innerHeight - 8) top = Math.max(8, rect.top - h - 6);
      el.style.top = `${top}px`;
      el.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - w - 8))}px`;
    }

    function close(result) {
      document.removeEventListener('mousedown', onOutside, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onResize);
      el.remove();
      resolve(result);
    }
    const onOutside = (e) => { if (!el.contains(e.target)) close(null); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(null); } };
    const onResize = () => close(null);

    el.addEventListener('mousedown', (e) => e.preventDefault());      // the cursor stays in the note
    el.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav) { m += +nav.dataset.nav; if (m < 0) { m = 11; y -= 1; } else if (m > 11) { m = 0; y += 1; } paint(); return; }
      const d = e.target.closest('[data-d]');
      if (d) close(d.dataset.d);
    });
    paint();
    place();
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
  });
}
