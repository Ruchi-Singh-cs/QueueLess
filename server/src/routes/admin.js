import { Router } from 'express';
import { User, Queue, Token, Appointment, SHOP_STATUS } from '../models.js';
import { authRequired, requireRole, fail } from '../auth.js';
import { startOfToday } from '../queue.js';

const r = Router();
r.use(authRequired, requireRole('admin'));

const pub = (u) => ({ _id: u._id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt });
const DAY = 86400000;

// Count docs per UTC day for the last `days` days -> [{ day: 'YYYY-MM-DD', count }]
async function perDay(Model, days, match = {}) {
  const since = new Date(startOfToday() - (days - 1) * DAY);
  const rows = await Model.aggregate([
    { $match: { createdAt: { $gte: since }, ...match } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
  ]);
  const map = Object.fromEntries(rows.map((x) => [x._id, x.count]));
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(since.getTime() + i * DAY).toISOString().slice(0, 10);
    return { day, count: map[day] || 0 };
  });
}

r.get('/stats', async (req, res) => {
  const since = startOfToday();
  const [users, businesses, activeQueues, todaysTokens, todaysAppointments, tokensPerDay, usersPerDay, appointmentsPerDay, recent] = await Promise.all([
    User.countDocuments(),
    Queue.countDocuments(),
    Queue.countDocuments({ isOpen: true, status: { $ne: 'suspended' } }),
    Token.countDocuments({ createdAt: { $gte: since } }),
    Appointment.countDocuments({ at: { $gte: since, $lt: new Date(since.getTime() + DAY) }, status: { $ne: 'cancelled' } }),
    perDay(Token, 7),
    perDay(User, 7),
    perDay(Appointment, 7),
    Token.find().sort('-updatedAt').limit(12).populate('queue', 'name category').populate('user', 'name'),
  ]);
  const busiest = await Queue.find().populate('currentToken', 'number');
  const waiting = await Token.aggregate([{ $match: { status: 'waiting' } }, { $group: { _id: '$queue', count: { $sum: 1 } } }]);
  const waitingBy = Object.fromEntries(waiting.map((w) => [String(w._id), w.count]));
  const pendingShops = await Queue.countDocuments({ status: 'pending' });
  res.json({
    users, businesses, activeQueues, todaysTokens, todaysAppointments, pendingShops,
    tokensPerDay, usersPerDay, appointmentsPerDay,
    recent: recent.map((t) => ({ _id: t._id, number: t.number, status: t.status, at: t.updatedAt, queue: t.queue, user: t.user })),
    shops: busiest.map((q) => ({ _id: q._id, name: q.name, category: q.category, status: q.status || 'approved', isOpen: q.isOpen, currentNumber: q.currentToken?.number ?? null, waitingCount: waitingBy[String(q._id)] || 0 }))
      .sort((a, b) => b.waitingCount - a.waitingCount),
  });
});

r.get('/users', async (req, res) => {
  const users = await User.find().sort('-createdAt').limit(500);
  res.json({ users: users.map(pub) });
});

r.patch('/users/:id', async (req, res) => {
  const { role } = req.body ?? {};
  if (!['user', 'staff', 'admin'].includes(role)) throw fail(400, 'invalid role');
  if (req.params.id === req.user.id) throw fail(400, 'cannot change your own role');
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
  if (!user) throw fail(404, 'user not found');
  res.json({ user: pub(user) });
});

// Business verification: pending → approved / suspended
r.patch('/shops/:id', async (req, res) => {
  const { status } = req.body ?? {};
  if (!SHOP_STATUS.includes(status)) throw fail(400, 'invalid status');
  const queue = await Queue.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!queue) throw fail(404, 'shop not found');
  res.json({ shop: { _id: queue._id, name: queue.name, status: queue.status } });
});

export default r;
