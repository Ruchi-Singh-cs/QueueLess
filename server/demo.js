// Stages the app for a live demo: everything `seed` makes, plus one clinic set up so every feature is
// visible the moment you open it — two counters mid-service, a no-show timer counting down, a skipped
// customer waiting to be recalled, a month of history for the charts, and a shop awaiting approval.
// Run: npm run demo          (same MONGO_URI / embedded db as the server; re-run any time to reset the stage)
import bcrypt from 'bcryptjs';
import { User, Queue, Token, Appointment } from './src/models.js';
import { seed } from './seed.js';

const STAGE = 'Dr. Sharma Clinic'; // the shop the walkthrough uses
const PENDING = 'Nova Skin & Hair Studio';
const PASSWORD = 'password';
const DAY = 86400000;

const user = async (name, email, role) =>
  (await User.findOne({ email })) || User.create({ name, email, role, passwordHash: await bcrypt.hash(PASSWORD, 10) });

/**
 * Create a token with a back-dated createdAt. It has to go through the raw driver: Mongoose treats
 * createdAt as its own and quietly drops it from a $set, leaving every token stamped "now".
 */
async function token(fields, createdAt) {
  const t = await Token.create(fields);
  await Token.collection.updateOne({ _id: t._id }, { $set: { createdAt } });
  return t;
}

/**
 * A month of finished tokens shaped like a real clinic: busiest Saturday late morning, a second
 * smaller evening rush, dead on Sunday. Gives the heatmap and the 7/30-day charts something true to say.
 */
async function history(queue, people, days = 29) {
  const WEEKDAY_LOAD = [0.15, 0.8, 0.85, 0.9, 0.85, 1, 1.6]; // Sun … Sat
  const HOUR_LOAD = Object.fromEntries([[9, 0.8], [10, 1.4], [11, 1.6], [12, 1], [13, 0.4], [14, 0.6], [15, 0.7], [16, 1], [17, 1.2], [18, 0.9]]);
  const start = new Date(new Date().toISOString().slice(0, 10)).getTime() - days * DAY;
  const docs = [];
  for (let d = 0; d < days; d++) {
    const base = new Date(start + d * DAY);
    const load = WEEKDAY_LOAD[base.getUTCDay()];
    for (const [hour, weight] of Object.entries(HOUR_LOAD)) {
      for (let k = 0, n = Math.round(load * weight * 2.2); k < n; k++) {
        const i = docs.length;
        const createdAt = new Date(base.getTime() + Number(hour) * 3600e3 + Math.floor(Math.random() * 3600e3));
        const calledAt = new Date(createdAt.getTime() + (4 + Math.random() * 22) * 60000);
        const service = queue.services[i % queue.services.length];
        const doneAt = new Date(calledAt.getTime() + service.minutes * 60000);
        docs.push({
          queue: queue._id, user: people[i % people.length]._id, number: i + 1, service: service.name,
          status: i % 11 === 10 ? 'skipped' : 'served', // roughly one in eleven never turns up
          priority: false, pushed: [], counter: (i % 2) + 1, calledAt, arrivedAt: calledAt, doneAt,
          createdAt, updatedAt: doneAt,
        });
      }
    }
  }
  // straight through the driver, in one round trip: these need their own createdAt, which Mongoose won't allow
  if (docs.length) await Token.collection.insertMany(docs);
  return docs.length;
}

/**
 * Tokens already served earlier today. Without these, "Today" — the range Analytics opens on — holds
 * only the handful of tokens staged for the live line, all in whichever hour you happened to run this,
 * so the hourly chart is a single spike. Analytics days are UTC, so everything here is clamped to
 * after UTC midnight; stage within a couple of hours of it and there is simply less to show.
 */
async function servedToday(queue, people, startNumber) {
  const midnight = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const now = Date.now();
  const from = Math.max(midnight, now - 7 * 3600e3);
  const span = now - from - 35 * 60000; // the last half hour belongs to the live line
  if (span < 45 * 60000) return 0;      // too soon after UTC midnight to invent a day
  const count = Math.min(22, Math.max(5, Math.round(span / (18 * 60000))));
  const docs = [];
  for (let i = 0; i < count; i++) {
    const createdAt = new Date(from + (span * (i + 0.35)) / count);
    const service = queue.services[i % queue.services.length];
    const calledAt = new Date(createdAt.getTime() + (3 + (i % 5) * 4) * 60000);
    docs.push({
      queue: queue._id, user: people[(i * 3) % people.length]._id, number: startNumber + i + 1,
      service: service.name, status: i % 9 === 8 ? 'skipped' : 'served',
      priority: false, pushed: [], counter: (i % 2) + 1,
      calledAt, arrivedAt: calledAt, doneAt: new Date(calledAt.getTime() + service.minutes * 60000),
      createdAt, updatedAt: new Date(calledAt.getTime() + service.minutes * 60000),
    });
  }
  await Token.collection.insertMany(docs);
  return docs.length;
}

export async function demo() {
  const base = await seed();
  const people = await User.find({ role: 'user' }).limit(16);
  const customer = await user('Aarav Customer', 'user@example.com', 'user');
  const now = Date.now();

  // ---- the stage: two counters, and a grace period long enough to survive being talked over ----
  // (the sweeper auto-skips an un-arrived token once its grace runs out, which quietly advances the
  // whole queue — 10 minutes leaves a visibly ticking clock without the stage falling apart mid-sentence)
  const shop = await Queue.findOne({ name: STAGE });
  if (!shop) throw new Error(`${STAGE} is missing — run \`npm run seed\` first`);
  Object.assign(shop, { counters: 2, graceMinutes: 10, isOpen: true, status: 'approved' });
  await Token.deleteMany({ queue: shop._id });

  const made = await history(shop, people);
  const earlier = await servedToday(shop, people, made);
  let n = made + earlier;
  const others = people.filter((p) => String(p._id) !== String(customer._id));

  // counter 1: called a minute ago and not here yet — ~9 minutes still on the clock
  const c1 = await token({ queue: shop._id, user: others[0]._id, number: ++n, service: 'General Consultation', status: 'serving', counter: 1, calledAt: new Date(now - 60000) }, new Date(now - 26 * 60000));
  // counter 2: checked in, timer stopped
  await token({ queue: shop._id, user: others[1]._id, number: ++n, service: 'Follow-up', status: 'serving', counter: 2, calledAt: new Date(now - 6 * 60000), arrivedAt: new Date(now - 5 * 60000) }, new Date(now - 24 * 60000));
  // a no-show from a few minutes ago, sitting in "Skipped today" waiting for one tap of Recall
  await token({ queue: shop._id, user: others[2]._id, number: ++n, service: 'General Consultation', status: 'skipped', counter: 1, calledAt: new Date(now - 12 * 60000), doneAt: new Date(now - 9 * 60000) }, new Date(now - 30 * 60000));
  // the demo customer is first in line: press Next on stage and their phone flips to "it's your turn"
  const mine = await token({ queue: shop._id, user: customer._id, number: ++n, service: 'Follow-up', status: 'waiting' }, new Date(now - 8 * 60000));
  for (const [i, p] of others.slice(3, 6).entries()) {
    await token({ queue: shop._id, user: p._id, number: ++n, service: shop.services[i % shop.services.length].name, status: 'waiting' }, new Date(now - (6 - i * 2) * 60000));
  }

  shop.currentToken = c1._id;
  shop.counter = n;
  shop.counterDate = new Date().toISOString().slice(0, 10);
  await shop.save();

  // ---- appointments, always in the future ----
  // seed() creates these once and skips them forever after, so by the next run they have gone stale
  // and two customer screens sit empty. Re-cut them from now on every staging.
  await Appointment.deleteMany({ user: customer._id, status: 'booked' });
  // one soon enough to sit under Today, the rest at hours a real shop is actually open
  const soon = new Date(now + 2 * 3600e3); soon.setMinutes(30, 0, 0);
  const dayAt = (days, hour, min = 0) => { const d = new Date(now + days * 864e5); d.setHours(hour, min, 0, 0); return d; };
  for (const [name, when, service, note] of [
    [STAGE, soon, 'Follow-up', 'Review blood test results'],
    ['Glow Salon', dayAt(1, 10, 30), 'Haircut', ''],
    ['Smile Dental Care', dayAt(2, 16), 'Check-up', 'Sensitivity on the left side'],
  ]) {
    const q = await Queue.findOne({ name });
    if (q) await Appointment.create({ queue: q._id, user: customer._id, at: when, service, note });
  }

  // ---- a business waiting on the administrator ----
  const owner = await user('Nova Studio Owner', 'newshop@example.com', 'staff');
  const center = (await Queue.findOne({ name: STAGE }))?.location?.coordinates || [80.3319, 26.4499];
  await Queue.findOneAndUpdate(
    { name: PENDING },
    {
      name: PENDING, owner: owner._id, status: 'pending', category: 'salon', avgServiceMinutes: 25,
      description: 'New unisex studio — cuts, colour and skin treatments. Just signed up to QueueLess.',
      phone: '+91 98765 70707', email: owner.email, isOpen: true, counters: 2,
      address: { street: '3 Parvati Bagla Road', city: 'Kanpur', state: 'Uttar Pradesh', pincode: '208001' },
      hours: { open: '10:00', close: '20:00' },
      services: [{ name: 'Haircut', minutes: 25 }, { name: 'Hair Colour', minutes: 60 }, { name: 'Facial', minutes: 40 }],
      location: { type: 'Point', coordinates: [center[0] + 0.002, center[1] - 0.003] },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return {
    appointments: await Appointment.countDocuments({ user: customer._id, status: 'booked' }),
    shops: base.total,
    stage: STAGE,
    history: made,
    earlier,
    waiting: n - made - earlier - 3,
    ticket: String(mine._id),
    pending: PENDING,
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const { connectDb } = await import('./src/db.js');
  const stop = await connectDb();
  const d = await demo();
  console.log(`
  QueueLess demo is staged.

    ${d.shops} shops · ${d.history} tokens of history at ${d.stage} · ${d.waiting} people waiting right now
    ${d.appointments} upcoming appointments for the demo customer
    "${d.pending}" is sitting in the admin queue awaiting approval

  Log in with the password "${PASSWORD}":

    customer   user@example.com              → /queue shows a live ticket
    shop owner dr-sharma-clinic@example.com  → /vendor two counters mid-service
    new owner  newshop@example.com           → /vendor a shop awaiting verification
    admin      admin@example.com             → /admin approve the new shop

  The walkthrough is in DEMO.md. Re-run \`npm run demo\` any time to reset the stage.
`);
  await stop();
}
