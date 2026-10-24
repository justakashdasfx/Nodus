/* ============================================================================
   /api/prefs   (small synced preferences: recent searches)
     GET  → { recents, updatedAt }
     PUT  → body: { recents, updatedAt }   409 {conflict, recents, updatedAt} if the server copy is newer
   ========================================================================== */

import { redis, authorize, KEYS } from './_lib.js';

export default async function handler(req, res) {
  if (!authorize(req, res)) return;

  try {
    if (req.method === 'GET') {
      const raw = await redis('GET', KEYS.prefs);
      return res.status(200).json(raw ? JSON.parse(raw) : { recents: [], updatedAt: 0 });
    }

    if (req.method === 'PUT') {
      const { recents, updatedAt } = req.body || {};
      if (!Array.isArray(recents) || !Number.isFinite(updatedAt)) return res.status(400).json({ error: 'invalid prefs' });
      const clean = recents.filter(r => typeof r === 'string').map(r => r.slice(0, 100)).slice(0, 20);

      const raw = await redis('GET', KEYS.prefs);
      if (raw) {
        const current = JSON.parse(raw);
        if (current.updatedAt > updatedAt) return res.status(409).json({ conflict: true, ...current });
      }
      await redis('SET', KEYS.prefs, JSON.stringify({ recents: clean, updatedAt }));
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
}
