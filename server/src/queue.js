import { Queue, Token } from './models.js';
import { fail } from './auth.js';

export const ACTIVE = ['waiting', 'serving'];
const ORDER = { priority: -1, number: 1 };
// ponytail: UTC day boundary; add a per-queue timezone if clinics want local midnight
export const today = () => new Date().toISOString().slice(0, 10);
export const startOfToday = () => new Date(today());

export const summary = (queue, waitingCount) => ({
  _id: queue._id,
  name: queue.name,
  description: queue.description,
  category: queue.category,
  image: queue.image,
  phone: queue.phone,
  email: queue.email,
  address: queue.address,
  hours: queue.hours,
  services: queue.services,
  location: queue.location?.coordinates ? { lng: queue.location.coordinates[0], lat: queue.location.coordinates[1] } : null,
  isOpen: queue.isOpen,
  avgServiceMinutes: queue.avgServiceMinutes,
  owner: queue.owner,
  currentNumber: queue.currentToken?.number ?? null,
  waitingCount,
  etaMinutes: Math.round(waitingCount * queue.avgServiceMinutes),
  ...(queue.distance !== undefined && { distanceKm: Math.round(queue.distance / 100) / 10 }),
});

export async function joinQueue(queue, userId, { priority = false, service = '' } = {}) {
  if (!queue.isOpen) throw fail(400, 'queue is closed');
  if (await Token.exists({ queue: queue._id, user: userId, status: { $in: ACTIVE } })) throw fail(409, 'already in this queue');
  const day = today();
  const bumped = await Queue.findOneAndUpdate(
    { _id: queue._id },
    [{ $set: { counterDate: day, counter: { $cond: [{ $eq: ['$counterDate', day] }, { $add: ['$counter', 1] }, 1] } } }],
    { new: true });
  return Token.create({ queue: queue._id, user: userId, number: bumped.counter, priority, service });
}

const locks = new Map(); // ponytail: in-process per-queue mutex; use a CAS on queue.currentToken if >1 server process
const withLock = (key, fn) => { const run = (locks.get(key) ?? Promise.resolve()).then(fn, fn); locks.set(key, run.catch(() => {})); return run; };
export const callNext = (queueId, mode) => withLock(String(queueId), () => advance(queueId, mode));

async function advance(queueId, mode) {
  const queue = await Queue.findById(queueId);
  const now = new Date();
  const done = await Token.findOne({ queue: queue._id, status: 'serving' });
  if (done) {
    done.status = mode === 'skip' ? 'skipped' : 'served';
    done.doneAt = now;
    await done.save();
    const minutes = (now - done.calledAt) / 60000;
    if (minutes > 0 && minutes < 120) queue.avgServiceMinutes = 0.7 * queue.avgServiceMinutes + 0.3 * minutes;
  }
  // mode 'complete' marks the current token served without calling the next one
  const next = mode === 'complete' ? null : await Token.findOneAndUpdate(
    { queue: queue._id, status: 'waiting' }, { status: 'serving', calledAt: now }, { sort: ORDER, new: true });
  queue.currentToken = next?._id ?? null;
  await queue.save();
  return { queue, done };
}

export async function leaveToken(token) {
  if (token.status !== 'waiting') throw fail(400, `cannot leave: token is ${token.status}`);
  token.status = 'left';
  return token.save();
}

export async function ticketFor(token) {
  const queue = await Queue.findById(token.queue).populate('currentToken', 'number');
  let ahead = 0;
  if (token.status === 'waiting') {
    const before = token.priority
      ? { priority: true, number: { $lt: token.number } }
      : { $or: [{ priority: true }, { number: { $lt: token.number } }] };
    ahead = (await Token.countDocuments({ queue: queue._id, status: 'waiting', ...before })) + (queue.currentToken ? 1 : 0);
  }
  const waitingNumbers = token.status === 'waiting'
    ? (await Token.find({ queue: queue._id, status: 'waiting' }).sort(ORDER).select('number')).map((t) => t.number)
    : [];
  return {
    _id: token._id,
    number: token.number,
    status: token.status,
    priority: token.priority,
    service: token.service,
    queue: {
      _id: queue._id, name: queue.name, category: queue.category, avgServiceMinutes: queue.avgServiceMinutes, isOpen: queue.isOpen,
      address: queue.address, location: summary(queue, 0).location,
    },
    currentNumber: queue.currentToken?.number ?? null,
    waitingNumbers,
    ahead,
    etaMinutes: Math.round(ahead * queue.avgServiceMinutes),
    createdAt: token.createdAt,
  };
}

export async function queueState(queue, withNames) {
  await queue.populate({ path: 'currentToken', populate: { path: 'user', select: 'name' } });
  const waiting = await Token.find({ queue: queue._id, status: 'waiting' }).sort(ORDER).populate('user', 'name');
  const current = queue.currentToken;
  const pub = (t) => ({
    _id: t._id, number: t.number, priority: t.priority, service: t.service,
    ...(withNames && { user: { _id: t.user._id, name: t.user.name } }),
  });
  return {
    queue: summary(queue, waiting.length),
    current: current ? { ...pub(current), calledAt: current.calledAt } : null,
    waiting: waiting.map((t) => ({ ...pub(t), createdAt: t.createdAt })),
  };
}

export async function broadcastQueue(io, queueId, extraTokenIds = []) {
  const queue = await Queue.findById(queueId).populate('currentToken', 'number');
  const tokens = await Token.find({ queue: queueId, $or: [{ status: { $in: ACTIVE } }, { _id: { $in: extraTokenIds } }] }).sort(ORDER);
  io.to(`queue:${queueId}`).emit('queue:update', {
    queueId: String(queueId),
    name: queue.name,
    isOpen: queue.isOpen,
    avgServiceMinutes: queue.avgServiceMinutes,
    currentNumber: queue.currentToken?.number ?? null,
    waitingNumbers: tokens.filter((t) => t.status === 'waiting').map((t) => t.number),
  });
  for (const t of tokens) io.to(`user:${t.user}`).emit('ticket:update', await ticketFor(t));
}

// Vendor analytics for one queue (today, UTC)
export async function queueStats(queueId) {
  const since = startOfToday();
  const tokens = await Token.find({ queue: queueId, createdAt: { $gte: since } }).select('status createdAt calledAt doneAt');
  const served = tokens.filter((t) => t.status === 'served');
  const waits = served.filter((t) => t.calledAt).map((t) => (t.calledAt - t.createdAt) / 60000);
  const perHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  for (const t of tokens) perHour[t.createdAt.getUTCHours()].count++;
  return {
    total: tokens.length,
    served: served.length,
    skipped: tokens.filter((t) => t.status === 'skipped').length,
    left: tokens.filter((t) => t.status === 'left').length,
    waiting: tokens.filter((t) => t.status === 'waiting').length,
    avgWaitMinutes: waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0,
    perHour,
  };
}
