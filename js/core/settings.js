/* ============================================================================
   SETTINGS — per-device preferences (theme, count style, sidebar, last-used colours). Write/Read mode and the font are per note (note.mode, note.font).
   Stored in localStorage; the early <script> in index.html applies them before
   first paint so there is no flash.
   ========================================================================== */

import { CONFIG } from './config.js';

const S = CONFIG.storage;
const read  = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const write = (key, value)    => { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } };
const root  = document.documentElement;

export const getTheme = () => read(S.theme, CONFIG.defaults.theme);
const THEME_COLOR = { dark: '#111111', light: '#efefed' }; // matches --bg-app, for the installed app's title bar
export function setTheme(theme) {
  write(S.theme, theme);
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme] || THEME_COLOR.dark);
}

/* ---- The sidebar's Pinned section: open or collapsed ---- */
export const getPinnedOpen = () => read(S.pinned, '1') !== '0';
export function togglePinnedOpen() { const next = !getPinnedOpen(); write(S.pinned, next ? '1' : '0'); return next; }

/* ---- The sidebar's Notebook section (Inbox · Journal · notebooks): shown or hidden ---- */
export const getNotebooksOpen = () => read('notes.notebooksOpen', '1') !== '0';
export function toggleNotebooksOpen() { const next = !getNotebooksOpen(); write('notes.notebooksOpen', next ? '1' : '0'); return next; }

/* ---- What the top bar count shows: words or characters ---- */
export const getStatsMode = () => (read(S.stats, CONFIG.defaults.statsMode) === 'chars' ? 'chars' : 'words');
export function toggleStatsMode() {
  const next = getStatsMode() === 'words' ? 'chars' : 'words';
  write(S.stats, next);
  return next;
}

/* ---- Gallery or List, remembered per page on this device (a notebook keeps its own choice on the notebook) ---- */
export function getViewStyle(page) {
  let saved = {};
  try { saved = JSON.parse(read(S.views, '{}')) || {}; } catch { /* ignore */ }
  const v = saved[page] || CONFIG.defaults.views[page];
  return v === 'list' ? 'list' : 'gallery';
}
export function setViewStyle(page, style) {
  let saved = {};
  try { saved = JSON.parse(read(S.views, '{}')) || {}; } catch { /* ignore */ }
  saved[page] = style === 'list' ? 'list' : 'gallery';
  write(S.views, JSON.stringify(saved));
}

/* ---- Sidebar ---- */
export const isSidebarCollapsed = () => root.classList.contains('sidebar-collapsed');
export function setSidebarCollapsed(collapsed) {
  root.classList.toggle('sidebar-collapsed', collapsed);
  write(S.sidebar, collapsed ? 'closed' : 'open');
}
/* ---- Top bar (Ctrl+Shift+/) and focus mode (Ctrl+Alt+/) ---- */
export const isTopbarHidden = () => root.classList.contains('topbar-hidden');
export function setTopbarHidden(hidden) {
  root.classList.toggle('topbar-hidden', hidden);
  write(S.topbar, hidden ? 'hidden' : 'shown');
}
/** Focus mode hides sidebar + top bar for this session only; leaving it restores both exactly as they were. */
export const isFocusMode = () => root.classList.contains('focus-mode');
export const setFocusMode = (on) => root.classList.toggle('focus-mode', on);

export const isMobile = () => window.matchMedia('(max-width: 760px)').matches;

/* ---- Expanded folders in the sidebar tree ---- */
export function getExpanded() {
  try { return new Set(JSON.parse(read(S.expanded, '[]'))); } catch { return new Set(); }
}
export function setExpanded(set) { write(S.expanded, JSON.stringify([...set])); }

/* ---- Last-used editor colours ---- */
export const getLastColor = (kind) =>
  read(kind === 'highlight' ? S.lastHighlight : S.lastTextColor,
       kind === 'highlight' ? CONFIG.defaults.highlight : CONFIG.defaults.textColor);
export const setLastColor = (kind, id) =>
  write(kind === 'highlight' ? S.lastHighlight : S.lastTextColor, id);
