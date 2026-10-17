/* ============================================================================
   SETTINGS — per-device preferences (theme, font, sidebar, last-used colours).
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

export const getFont = () => read(S.font, CONFIG.defaults.font);
export function setFont(font) { write(S.font, font); root.dataset.font = font; }

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
