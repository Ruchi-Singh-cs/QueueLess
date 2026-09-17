import { Router } from 'express';
import { PushSubscription } from '../models.js';
import { authRequired, fail } from '../auth.js';
import { publicKey, pushEnabled } from '../push.js';

const r = Router();

// Public: the VAPID key the browser subscribes with (null when push isn't configured on the server)
r.get('/key', (req, res) => res.json({ publicKey, enabled: pushEnabled }));

r.post('/subscribe', authRequired, async (req, res) => {
  const s = req.body?.subscription ?? req.body;
  if (!s || typeof s.endpoint !== 'string' || !/^https:\/\//.test(s.endpoint) || typeof s.keys?.p256dh !== 'string' || typeof s.keys?.auth !== 'string') throw fail(400, 'invalid subscription');
  await PushSubscription.findOneAndUpdate(
    { endpoint: s.endpoint },
    { user: req.user.id, endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, userAgent: String(req.headers['user-agent'] || '').slice(0, 200) },
    { upsert: true },
  );
  res.status(201).json({ ok: true });
});

r.delete('/subscribe', authRequired, async (req, res) => {
  const endpoint = req.body?.endpoint;
  if (typeof endpoint !== 'string') throw fail(400, 'endpoint required');
  await PushSubscription.deleteOne({ endpoint, user: req.user.id });
  res.json({ ok: true });
});

export default r;
