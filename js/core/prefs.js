/* ============================================================================
   PREFS — small things that follow you between devices but are not notes: for now, recent searches.
   Same pattern as notebooks: saved locally at once, pushed by sync.js, the newest copy wins.
   Server: api/prefs.js (an older server without it is simply skipped).
   ========================================================================== */

import { CONFIG } from './config.js';

const KEY = CONFIG.storage.prefs;
const listeners = new Set();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { recents: Array.isArray(s.recents) ? s.recents.filter(x => typeof x === 'string') : [], updatedAt: +s.updatedAt || 0, dirty: !!s.dirty };
  } catch { return { recents: [], updatedAt: 0, dirty: false }; }
}
let state = load();
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ } };

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const getRecents = () => state.recents.slice();

function changed() { state.updatedAt = Date.now(); state.dirty = true; persist(); listeners.forEach(fn => fn()); }

export function addRecent(query) {
  const q = String(query || '').replace(/\s+/g, ' ').trim().slice(0, 100);
  if (!q) return;
  state.recents = [q, ...state.recents.filter(r => r.toLowerCase() !== q.toLowerCase())].slice(0, CONFIG.search.recentMax);
  changed();
}
export function clearRecents() { if (state.recents.length) { state.recents = []; changed(); } }

/* ---------- Called by sync.js ---------- */

export async function push(request) {
  if (!state.dirty) return;
  const sent = state.updatedAt;
  try {
    const out = await request('PUT', CONFIG.api.prefs, { recents: state.recents, updatedAt: sent });
    if (out.conflict) { state = { recents: out.recents || [], updatedAt: out.updatedAt || 0, dirty: false }; persist(); }
    else if (state.updatedAt === sent) { state.dirty = false; persist(); }
  } catch (err) { if (err.status === 401) throw err; }
}

export async function pull(request) {
  try {
    const out = await request('GET', CONFIG.api.prefs);
    if (state.dirty || !Array.isArray(out.recents) || (out.updatedAt || 0) <= state.updatedAt) return;
    state = { recents: out.recents.filter(x => typeof x === 'string').slice(0, CONFIG.search.recentMax), updatedAt: out.updatedAt, dirty: false };
    persist();
  } catch (err) { if (err.status === 401) throw err; }
}
