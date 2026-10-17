/* ============================================================================
   SYNC — keeps this device and the Vercel server in step.

   Flow:  edit → store marks it dirty → (debounced) push dirty items → pull
          everything newer from the server → merge into the store.

   Auth:  every request carries your sync key in the `x-sync-key` header.
          The key is entered once per device and stored in localStorage.

   Status values: idle · saving · saved · offline · error · nokey · badkey
   ========================================================================== */

import { CONFIG } from './config.js';
import * as store from './store.js';
import { debounce } from './utils.js';

let status = 'idle';
let running = false;
let rerun = false;
const statusListeners = new Set();

/* ---------- Key ---------- */

export const getKey = () => { try { return localStorage.getItem(CONFIG.storage.syncKey) || ''; } catch { return ''; } };
export function setKey(key) {
  try { localStorage.setItem(CONFIG.storage.syncKey, key.trim()); } catch { /* ignore */ }
  syncNow();
}

/* ---------- Status ---------- */

export function onStatus(fn) { statusListeners.add(fn); fn(status); return () => statusListeners.delete(fn); }
function setStatus(next) { status = next; statusListeners.forEach(fn => fn(next)); }

/* ---------- HTTP ---------- */

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-sync-key': getKey() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw Object.assign(new Error('unauthorized'), { status: 401 });
  if (!res.ok && res.status !== 409) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ---------- Push / pull ---------- */

async function push() {
  const { notes, purge, folders, threads } = store.pending();

  for (const note of notes) {
    const sent = note.updatedAt;
    const out = await request('PUT', CONFIG.api.notes, note);
    if (out.conflict) store.adoptRemoteNote(out.note);   // server copy was newer
    else store.clearDirty(note.id, sent);
  }
  for (const id of purge) {
    await request('DELETE', `${CONFIG.api.notes}?id=${encodeURIComponent(id)}`);
    store.clearPurge(id);
  }
  if (folders) {
    const out = await request('PUT', CONFIG.api.folders, folders);
    if (out.conflict) store.adoptRemoteFolders(out);
    else store.clearFoldersDirty(folders.updatedAt);
  }
  if (threads) {
    const out = await request('PUT', CONFIG.api.threads, threads);
    if (out.conflict) store.adoptRemoteThreads(out);
    else store.clearThreadsDirty(threads.updatedAt);
  }
}

async function pull() {
  const [n, f, t] = await Promise.all([
    request('GET', CONFIG.api.notes),
    request('GET', CONFIG.api.folders),
    request('GET', CONFIG.api.threads).catch(() => ({ threads: undefined, updatedAt: 0 })), // older server without /api/threads
  ]);
  store.applyRemote({ notes: n.notes, folders: f.folders, foldersUpdatedAt: f.updatedAt, threads: t.threads, threadsUpdatedAt: t.updatedAt });
}

export async function syncNow() {
  if (!getKey()) { setStatus('nokey'); return; }
  if (!navigator.onLine) { setStatus('offline'); return; }
  if (running) { rerun = true; return; }

  running = true;
  setStatus('saving');
  try {
    await push();
    await pull();
    await push(); // pull may have queued re-uploads (fresh database)
    setStatus('saved');
  } catch (err) {
    if (err.status === 401) setStatus('badkey');
    else setStatus(navigator.onLine ? 'error' : 'offline');
    console.warn('Sync failed:', err);
  } finally {
    running = false;
    if (rerun) { rerun = false; schedulePush(); }
  }
}

const schedulePush = debounce(syncNow, CONFIG.timing.pushDebounce);

/* ---------- Start ---------- */

export function startSync() {
  store.subscribe((kind) => {
    if (kind === 'dirty') { if (getKey() && navigator.onLine) setStatus('saving'); schedulePush(); }
  });
  window.addEventListener('online', syncNow);
  window.addEventListener('offline', () => setStatus('offline'));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, CONFIG.timing.pollInterval);
  syncNow();
}
