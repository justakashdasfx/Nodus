/* ============================================================================
   API HELPERS (shared by notes.js and folders.js).
   Files starting with "_" are not exposed as routes by Vercel.

   Storage: Upstash Redis over its REST API (no SDK, no dependencies).
     notesapp:ids            → set of note ids
     notesapp:note:<id>      → JSON of one note (or a tombstone {id, purged, updatedAt})
     notesapp:folders        → JSON { folders, updatedAt }
     notesapp:threads        → JSON { threads, updatedAt }
     notesapp:prefs          → JSON { recents, updatedAt }
   ========================================================================== */

import { timingSafeEqual } from 'node:crypto';

export const KEYS = {
  ids: 'notesapp:ids',
  note: (id) => `notesapp:note:${id}`,
  folders: 'notesapp:folders',
  threads: 'notesapp:threads',
  prefs: 'notesapp:prefs',
};

/** Runs one Redis command, e.g. redis('SET', key, value). Returns the result. */
export async function redis(...command) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Redis environment variables are missing');

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(command),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

/** Checks the x-sync-key header. Sends 401 and returns false when it doesn't match. */
export function authorize(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const expected = Buffer.from(process.env.SYNC_KEY || '');
  const given = Buffer.from(String(req.headers['x-sync-key'] || ''));
  const ok = expected.length > 0 && expected.length === given.length && timingSafeEqual(expected, given);
  if (!ok) res.status(401).json({ error: 'unauthorized' });
  return ok;
}
