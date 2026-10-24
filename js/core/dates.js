/* ============================================================================
   DATES — due dates for checklist items.  A due date is stored as 'YYYY-MM-DD' (data-due on the item).
   English words, weeks start on Monday. Everything here is plain functions; no app knowledge.

   parseDue('fri') → '2026-10-23'   understands: today · tomorrow · yesterday · fri / friday (the next one) ·
   next week (Monday) · next month · in 3 days · 2w · 3 nov · nov 3 · 3 nov 2027 · 2026-11-03
   ========================================================================== */

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const SHORT_DAY = WEEKDAYS.map(d => cap(d).slice(0, 3));
const SHORT_MONTH = MONTHS.map(m => cap(m).slice(0, 3));

const pad = (n) => String(n).padStart(2, '0');
export const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const nextWeekday = (base, dow) => addDays(base, ((dow - base.getDay() + 7) % 7) || 7);   // always in the future (1–7 days)

export const todayIso = (now = new Date()) => isoOf(now);
export const daysBetween = (aIso, bIso) => Math.round((fromIso(bIso) - fromIso(aIso)) / 864e5);

/** 'overdue' | 'today' | 'soon' (within a week) | 'later' */
export function dueState(iso, now = new Date()) {
  const n = daysBetween(isoOf(now), iso);
  return n < 0 ? 'overdue' : n === 0 ? 'today' : n <= 7 ? 'soon' : 'later';
}

/** The short label shown on a task: Today · Tomorrow · Yesterday · Fri · 3 Nov · 3 Nov 2027 */
export function labelFor(iso, now = new Date()) {
  const d = fromIso(iso);
  const n = daysBetween(isoOf(now), iso);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1 && n < 7) return SHORT_DAY[d.getDay()];
  return `${d.getDate()} ${SHORT_MONTH[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : ''}`;
}

/** The long label used in menus: Fri 6 Nov 2026 */
export function longLabel(iso) {
  const d = fromIso(iso);
  return `${SHORT_DAY[d.getDay()]} ${d.getDate()} ${SHORT_MONTH[d.getMonth()]} ${d.getFullYear()}`;
}

const monthIndex = (w) => (w.length >= 3 ? MONTHS.findIndex(m => m.startsWith(w)) : -1);
const weekdayIndex = (w) => (w.length >= 3 ? WEEKDAYS.findIndex(d => d.startsWith(w)) : -1);

function real(y, m, d) {
  const x = new Date(y, m, d);
  return x.getFullYear() === y && x.getMonth() === m && x.getDate() === d ? x : null;
}

/** Text → 'YYYY-MM-DD', or null when it cannot be read. */
export function parseDue(input, now = new Date()) {
  const s = String(input || '').toLowerCase().replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  const base = day0(now);
  let m;

  if (s === 'today' || s === 'tod') return isoOf(base);
  if (s === 'tomorrow' || s === 'tmr' || s === 'tmrw' || s === 'tom') return isoOf(addDays(base, 1));
  if (s === 'yesterday') return isoOf(addDays(base, -1));
  if (s === 'next week') return isoOf(nextWeekday(base, 1));
  if (s === 'next month') return isoOf(new Date(base.getFullYear(), base.getMonth() + 1, 1));

  if ((m = s.match(/^(?:in )?\+?(\d{1,3}) ?(d|day|days|w|wk|wks|week|weeks)$/))) {
    return isoOf(addDays(base, Number(m[1]) * (m[2][0] === 'w' ? 7 : 1)));
  }
  if ((m = s.match(/^(?:next )?([a-z]{3,9})$/)) && weekdayIndex(m[1]) >= 0) return isoOf(nextWeekday(base, weekdayIndex(m[1])));

  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) { const d = real(+m[1], +m[2] - 1, +m[3]); return d ? isoOf(d) : null; }

  let day, mon, year;
  if ((m = s.match(/^(\d{1,2})(?:st|nd|rd|th)? ([a-z]{3,9})(?:,? (\d{4}))?$/))) { day = +m[1]; mon = monthIndex(m[2]); year = m[3] ? +m[3] : null; }
  else if ((m = s.match(/^([a-z]{3,9}) (\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{4}))?$/))) { day = +m[2]; mon = monthIndex(m[1]); year = m[3] ? +m[3] : null; }
  else return null;
  if (mon < 0) return null;
  if (year) { const d = real(year, mon, day); return d ? isoOf(d) : null; }
  let d = real(base.getFullYear(), mon, day);
  if (d && d < base) d = real(base.getFullYear() + 1, mon, day);   // a date that has passed this year means next year
  return d ? isoOf(d) : null;
}

/** The ready-made choices of the "@" menu: Today, Tomorrow, Next week, then the weekdays. `top` = shown before you type anything. */
export function presets(now = new Date()) {
  const base = day0(now);
  const out = [
    { label: 'Today', iso: isoOf(base), keys: ['today'], top: true },
    { label: 'Tomorrow', iso: isoOf(addDays(base, 1)), keys: ['tomorrow'], top: true },
    { label: 'Next week', iso: isoOf(nextWeekday(base, 1)), keys: ['next week', 'week'], top: true },
  ];
  for (let i = 1; i <= 7; i++) {
    const d = addDays(base, i);
    out.push({ label: cap(WEEKDAYS[d.getDay()]), iso: isoOf(d), keys: [WEEKDAYS[d.getDay()].slice(0, 3)], top: false });
  }
  return out.map(p => ({ ...p, hint: longLabel(p.iso) }));
}
