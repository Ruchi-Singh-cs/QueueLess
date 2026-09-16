import { Router } from 'express';
import { Queue, Token, CATEGORIES } from '../models.js';
import { authRequired, authOptional, requireRole, fail, field, shape, owns } from '../auth.js';
import { joinQueue, callNext, ticketFor, queueState, queueStats, summary, broadcastQueue } from '../queue.js';

const r = Router();

async function getQueue(req, mustOwn) {
  const queue = await Queue.findById(req.params.id);
  if (!queue) throw fail(404, 'queue not found');
  if (mustOwn && !owns(queue, req.user)) throw fail(403, 'not your queue');
  return queue;
}

const withCounts = (queues) => Promise.all(queues.map(async (q) => summary(q, await Token.countDocuments({ queue: q._id, status: 'waiting' }))));

// Shared list filters: ?q= (name/description/service) and ?category=
function filters(query) {
  const f = {};
  if (typeof query.q === 'string' && query.q.trim()) {
    const rx = new RegExp(query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    f.$or = [{ name: rx }, { description: rx }, { 'services.name': rx }, { 'address.city': rx }];
  }
  if (CATEGORIES.includes(query.category)) f.category = query.category;
  if (query.open === '1') f.isOpen = true;
  return f;
}

r.get('/', authOptional, async (req, res) => {
  const queues = await Queue.find(filters(req.query)).populate('currentToken', 'number');
  res.json({ queues: await withCounts(queues) });
});

// GET /nearby?lat&lng&radius(km, default 5) — server-side geospatial search, sorted by distance
r.get('/nearby', authOptional, async (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw fail(400, 'lat and lng are required');
  const radiusKm = Math.min(Math.max(Number(req.query.radius) || 5, 0.1), 100);
  const docs = await Queue.aggregate([{
    $geoNear: {
      near: { type: 'Point', coordinates: [lng, lat] },
      distanceField: 'distance',
      maxDistance: radiusKm * 1000,
      spherical: true,
      query: filters(req.query),
    },
  }, { $limit: 100 }]);
  await Queue.populate(docs, { path: 'currentToken', select: 'number' });
  res.json({ queues: await withCounts(docs), center: { lat, lng }, radiusKm });
});

r.post('/', authRequired, requireRole('staff', 'admin'), async (req, res) => {
  const queue = await Queue.create({
    name: field(req, 'name', 'string'),
    description: field(req, 'description', 'string', true),
    avgServiceMinutes: field(req, 'avgServiceMinutes', 'number', true),
    category: CATEGORIES.includes(req.body.category) ? req.body.category : 'other',
    owner: req.user.id,
  });
  res.status(201).json({ queue: summary(queue, 0) });
});

r.get('/:id', authOptional, async (req, res) => {
  const queue = await getQueue(req);
  res.json(await queueState(queue, owns(queue, req.user)));
});

r.get('/:id/stats', authRequired, async (req, res) => {
  const queue = await getQueue(req, true);
  res.json(await queueStats(queue._id));
});

r.patch('/:id', authRequired, async (req, res) => {
  const queue = await getQueue(req, true);
  for (const [name, type] of Object.entries({ name: 'string', description: 'string', avgServiceMinutes: 'number', isOpen: 'boolean', phone: 'string', email: 'string', image: 'string' })) {
    const v = field(req, name, type, true);
    if (v !== undefined) queue[name] = v;
  }
  if (req.body.category !== undefined) {
    if (!CATEGORIES.includes(req.body.category)) throw fail(400, 'invalid category');
    queue.category = req.body.category;
  }
  const address = shape(req, 'address', { street: 'string', city: 'string', state: 'string', pincode: 'string' });
  if (address) queue.address = address;
  const hours = shape(req, 'hours', { open: 'string', close: 'string' });
  if (hours) for (const k of ['open', 'close']) if (hours[k]) queue.hours[k] = hours[k];
  if (req.body.services !== undefined) {
    if (!Array.isArray(req.body.services)) throw fail(400, 'services must be an array');
    queue.services = req.body.services.map((s) => {
      if (!s || typeof s.name !== 'string' || !s.name.trim()) throw fail(400, 'each service needs a name');
      return { name: s.name.trim(), minutes: Number.isFinite(s.minutes) && s.minutes >= 0 ? s.minutes : 5 };
    });
  }
  const location = shape(req, 'location', { lat: 'number', lng: 'number' });
  if (location) {
    if (location.lat === undefined || location.lng === undefined || Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180) throw fail(400, 'location needs lat and lng');
    queue.location = { type: 'Point', coordinates: [location.lng, location.lat] };
  }
  await queue.save();
  await broadcastQueue(req.app.get('io'), queue._id);
  res.json(await queueState(queue, true));
});

r.post('/:id/join', authRequired, async (req, res) => {
  const queue = await getQueue(req);
  const service = field(req, 'service', 'string', true) ?? '';
  if (service && !queue.services.some((s) => s.name === service)) throw fail(400, 'unknown service');
  const token = await joinQueue(queue, req.user.id, { service });
  await broadcastQueue(req.app.get('io'), queue._id);
  res.status(201).json({ ticket: await ticketFor(token) });
});

const advance = (mode) => async (req, res) => {
  const { queue, done } = await callNext((await getQueue(req, true))._id, mode);
  await broadcastQueue(req.app.get('io'), queue._id, done ? [done._id] : []);
  res.json(await queueState(queue, true));
};
r.post('/:id/next', authRequired, advance('next'));
r.post('/:id/skip', authRequired, advance('skip'));
r.post('/:id/complete', authRequired, advance('complete'));

export default r;
