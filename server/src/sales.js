import { Token } from './models.js';

const DAY = 86400000;
const dayKey = (d) => d.toISOString().slice(0, 10);

/**
 * Express-slot sales. A "transaction" is a token that carries a payment; there is no separate ledger.
 * `match` narrows to one shop ({ queue }) or the whole platform ({}).
 */
export async function sales(match, days = 30) {
  const since = new Date(new Date(dayKey(new Date())).getTime() - (days - 1) * DAY);
  const rows = await Token.find({ ...match, 'express.paymentId': { $exists: true }, createdAt: { $gte: since } })
    .sort('-createdAt').populate('user', 'name').populate('queue', 'name category');

  const byDay = new Map(Array.from({ length: days }, (_, i) => [dayKey(new Date(since.getTime() + i * DAY)), { day: dayKey(new Date(since.getTime() + i * DAY)), count: 0, amount: 0 }]));
  const byShop = new Map();
  const customers = new Set();
  let amount = 0;
  for (const t of rows) {
    amount += t.express.amount;
    customers.add(String(t.user?._id));
    const d = byDay.get(dayKey(t.createdAt)); if (d) { d.count++; d.amount += t.express.amount; }
    const sid = String(t.queue?._id);
    const s = byShop.get(sid) || { _id: sid, name: t.queue?.name, category: t.queue?.category, count: 0, amount: 0 };
    s.count++; s.amount += t.express.amount; byShop.set(sid, s);
  }
  return {
    days, since,
    count: rows.length, amount, customers: customers.size,
    byDay: [...byDay.values()],
    byShop: [...byShop.values()].sort((a, b) => b.amount - a.amount),
    // amounts are paise; the client formats rupees
    transactions: rows.slice(0, 200).map((t) => ({
      _id: t._id, number: t.number, status: t.status, amount: t.express.amount, paymentId: t.express.paymentId,
      at: t.createdAt, service: t.service, user: t.user && { _id: t.user._id, name: t.user.name }, queue: t.queue && { _id: t.queue._id, name: t.queue.name },
    })),
  };
}
