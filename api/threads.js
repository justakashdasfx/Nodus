/* ============================================================================
   /api/threads   (threads are stored as one small list, like notebooks)
     GET  → { threads, updatedAt }
     PUT  → body: { threads, updatedAt }   409 {conflict, threads, updatedAt} if the server copy is newer
   ========================================================================== */

import { redis, authorize, KEYS } from './_lib.js';

export default async function handler(req, res) {
  if (!authorize(req, res)) return;

  try {
    if (req.method === 'GET') {
      const raw = await redis('GET', KEYS.threads);
      return res.status(200).json(raw ? JSON.parse(raw) : { threads: null, updatedAt: 0 });
    }

    if (req.method === 'PUT') {
      const { threads, updatedAt } = req.body || {};
      if (!Array.isArray(threads) || !Number.isFinite(updatedAt)) return res.status(400).json({ error: 'invalid threads' });

      const raw = await redis('GET', KEYS.threads);
      if (raw) {
        const current = JSON.parse(raw);
        if (current.updatedAt > updatedAt) return res.status(409).json({ conflict: true, ...current });
      }
      await redis('SET', KEYS.threads, JSON.stringify({ threads, updatedAt }));
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
}
