import { Router } from 'express';
import { Queue, Token } from '../models.js';
import { authRequired, fail } from '../auth.js';
import { ACTIVE, leaveToken, ticketFor, broadcastQueue } from '../queue.js';

const r = Router();
r.use(authRequired);

async function getToken(req) {
  const token = await Token.findById(req.params.id);
  if (!token) throw fail(404, 'token not found');
  return token;
}

r.get('/mine', async (req, res) => {
  const tokens = await Token.find({ user: req.user.id, status: { $in: ACTIVE } }).sort('-createdAt');
  res.json({ tickets: await Promise.all(tokens.map(ticketFor)) });
});

// My recent history (served/skipped/left), newest first
r.get('/history', async (req, res) => {
  const tokens = await Token.find({ user: req.user.id, status: { $nin: ACTIVE } }).sort('-updatedAt').limit(20).populate('queue', 'name category');
  res.json({ tickets: tokens.map((t) => ({ _id: t._id, number: t.number, status: t.status, service: t.service, queue: t.queue, at: t.updatedAt })) });
});

r.get('/:id', async (req, res) => {
  const token = await getToken(req);
  const allowed = String(token.user) === req.user.id || req.user.role === 'admin'
    || (await Queue.exists({ _id: token.queue, owner: req.user.id }));
  if (!allowed) throw fail(403, 'forbidden');
  res.json({ ticket: await ticketFor(token) });
});

r.delete('/:id', async (req, res) => {
  const token = await getToken(req);
  if (String(token.user) !== req.user.id) throw fail(403, 'not your token');
  await leaveToken(token);
  await broadcastQueue(req.app.get('io'), token.queue, [token._id]);
  res.json({ ticket: await ticketFor(token) });
});

export default r;
