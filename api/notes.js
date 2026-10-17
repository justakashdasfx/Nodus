/* ============================================================================
   /api/notes
     GET     → { notes: [...] }               every note (incl. purged tombstones)
     PUT     → body: one note                 save; 409 {conflict, note} if the server copy is newer
     DELETE  → ?id=<id>                       permanent delete (leaves a tombstone so other devices drop it)
   ========================================================================== */

import { redis, authorize, KEYS } from './_lib.js';

const validId = (id) => typeof id === 'string' && /^[\w-]{1,64}$/.test(id);

export default async function handler(req, res) {
  if (!authorize(req, res)) return;

  try {
    if (req.method === 'GET') {
      const ids = await redis('SMEMBERS', KEYS.ids);
      if (!ids.length) return res.status(200).json({ notes: [] });
      const raw = await redis('MGET', ...ids.map(KEYS.note));
      return res.status(200).json({ notes: raw.filter(Boolean).map((s) => JSON.parse(s)) });
    }

    if (req.method === 'PUT') {
      const note = req.body;
      if (!validId(note?.id) || !Number.isFinite(note.updatedAt)) return res.status(400).json({ error: 'invalid note' });

      const existing = await redis('GET', KEYS.note(note.id));
      if (existing) {
        const current = JSON.parse(existing);
        if (current.updatedAt > note.updatedAt) return res.status(409).json({ conflict: true, note: current });
      }
      await redis('SET', KEYS.note(note.id), JSON.stringify(note));
      await redis('SADD', KEYS.ids, note.id);
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id;
      if (!validId(id)) return res.status(400).json({ error: 'invalid id' });
      await redis('SET', KEYS.note(id), JSON.stringify({ id, purged: true, updatedAt: Date.now() }));
      await redis('SADD', KEYS.ids, id);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PUT, DELETE');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
}
