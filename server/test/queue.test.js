import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.JWT_SECRET = 'test-secret';
const { server, io } = await import('../src/app.js');

let mongo, base;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((r) => io.close(r));
  await mongoose.disconnect();
  await mongo.stop();
});

async function api(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body && { 'content-type': 'application/json' }), ...(token && { authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function register(name, role) {
  const { status, body } = await api('POST', '/api/auth/register', { body: { name, email: `${name}@example.com`, password: 'secret1', role } });
  assert.equal(status, 201);
  assert.equal(body.user.passwordHash, undefined);
  return body.token;
}

test('queue flow over HTTP', async () => {
  const [staff, staff2, user1, user2, user3] = await Promise.all(
    [['staff', 'staff'], ['staff2', 'staff'], ['user1'], ['user2'], ['user3']].map((a) => register(...a)));

  let r = await api('POST', '/api/queues', { token: staff, body: { name: 'Dr. Sharma Clinic' } });
  assert.equal(r.status, 201);
  const qid = r.body.queue._id;
  assert.equal(r.body.queue.avgServiceMinutes, 5);

  r = await api('POST', `/api/queues/${qid}/join`, { token: user1 });
  assert.equal(r.status, 201);
  assert.equal(r.body.ticket.number, 1);
  const t1 = r.body.ticket._id;

  r = await api('POST', `/api/queues/${qid}/join`, { token: user2 });
  assert.equal(r.status, 201);
  assert.equal(r.body.ticket.number, 2);
  const t2 = r.body.ticket._id;

  r = await api('GET', `/api/tokens/${t2}`, { token: user2 });
  assert.equal(r.status, 200);
  assert.equal(r.body.ticket.ahead, 1);
  assert.equal(r.body.ticket.etaMinutes, 5);
  assert.equal(r.body.ticket.currentNumber, null);

  r = await api('POST', `/api/queues/${qid}/join`, { token: user2 });
  assert.equal(r.status, 409);

  r = await api('GET', '/api/queues', { token: user1 });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.queues[0].waitingCount, r.body.queues[0].currentNumber], [2, null]);

  r = await api('POST', `/api/queues/${qid}/next`, { token: staff });
  assert.equal(r.status, 200);
  assert.equal(r.body.current.number, 1);
  assert.equal(r.body.queue.currentNumber, 1);
  assert.equal(r.body.current.user.name, 'user1');
  r = await api('GET', `/api/tokens/${t2}`, { token: user2 });
  assert.equal(r.body.ticket.ahead, 1);
  assert.equal(r.body.ticket.currentNumber, 1);

  r = await api('POST', `/api/queues/${qid}/next`, { token: staff });
  assert.equal(r.body.current.number, 2);
  r = await api('GET', `/api/tokens/${t2}`, { token: user2 });
  assert.equal(r.body.ticket.status, 'serving');
  assert.equal(r.body.ticket.ahead, 0);
  assert.equal(r.body.ticket.etaMinutes, 0);
  r = await api('GET', `/api/tokens/${t1}`, { token: user1 });
  assert.equal(r.body.ticket.status, 'served');

  r = await api('DELETE', `/api/tokens/${t2}`, { token: user2 });
  assert.equal(r.status, 400);

  r = await api('POST', `/api/queues/${qid}/next`, { token: staff });
  assert.equal(r.status, 200);
  assert.equal(r.body.current, null);
  assert.equal(r.body.queue.currentNumber, null);

  const at = new Date(Date.now() + 3600e3).toISOString();
  r = await api('POST', '/api/appointments', { token: user1, body: { queue: qid, at, note: 'follow-up' } });
  assert.equal(r.status, 201);
  const aid = r.body.appointment._id;
  assert.equal(r.body.appointment.queue.name, 'Dr. Sharma Clinic');
  assert.equal(r.body.appointment.user.name, 'user1');
  assert.equal(r.body.appointment.token, null);
  r = await api('POST', '/api/appointments', { token: user1, body: { queue: qid, at } });
  assert.equal(r.status, 409);

  r = await api('PATCH', `/api/appointments/${aid}`, { token: staff, body: { status: 'checked_in' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.appointment.status, 'checked_in');
  assert.equal(r.body.appointment.token.number, 3);
  const t3 = r.body.appointment.token._id;
  r = await api('GET', `/api/queues/${qid}`, { token: staff });
  assert.equal(r.body.waiting[0].number, 3);
  assert.equal(r.body.waiting[0].priority, true);
  assert.equal(r.body.waiting[0].user.name, 'user1');
  r = await api('GET', `/api/queues/${qid}`, { token: user2 });
  assert.equal(r.body.waiting[0].user, undefined);

  r = await api('POST', `/api/queues/${qid}/join`, { token: user3 });
  assert.equal(r.status, 201);
  assert.equal(r.body.ticket.number, 4);
  assert.equal(r.body.ticket.ahead, 1);
  assert.equal(r.body.ticket.priority, false);

  r = await api('POST', `/api/queues/${qid}/next`, { token: staff2 });
  assert.equal(r.status, 403);

  r = await api('GET', '/api/queues');
  assert.equal(r.status, 200);
  r = await api('GET', '/api/tokens/mine');
  assert.equal(r.status, 401);

  r = await api('POST', '/api/auth/login', { body: { email: { $ne: '' }, password: 'secret1' } });
  assert.equal(r.status, 400);
  r = await api('GET', '/api/nope', { token: user1 });
  assert.equal(r.status, 404);

  r = await Promise.all([1, 2, 3].map(() => api('POST', `/api/queues/${qid}/join`, { token: user2 })));
  assert.deepEqual(r.map((x) => x.status).sort(), [201, 409, 409]);
  const at2 = new Date(Date.now() + 7200e3).toISOString();
  r = await Promise.all([user2, user3].map((token) => api('POST', '/api/appointments', { token, body: { queue: qid, at: at2 } })));
  assert.deepEqual(r.map((x) => x.status).sort(), [201, 409]);
  r = await Promise.all([1, 2].map(() => api('POST', `/api/queues/${qid}/next`, { token: staff })));
  assert.deepEqual(r.map((x) => x.status), [200, 200]);
  r = await api('GET', `/api/tokens/${t3}`, { token: user1 });
  assert.equal(r.body.ticket.status, 'served');

  r = await api('POST', '/api/appointments', { token: staff2, body: { queue: qid, at: new Date(Date.now() + 10800e3).toISOString() } });
  assert.equal(r.status, 201);
  r = await api('GET', '/api/appointments', { token: staff2 });
  assert.equal(r.body.appointments.length, 1);

  process.env.ADMIN_EMAIL = 'Admin@Example.com';
  r = await api('POST', '/api/auth/register', { body: { name: 'admin', email: 'Admin@Example.com', password: 'secret1' } });
  assert.equal(r.body.user.role, 'admin');
  r = await api('POST', '/api/auth/register', { body: { name: 'admin', email: 'admin@example.com', password: 'secret1' } });
  assert.deepEqual([r.status, r.body.error], [409, 'already exists']);
  r = await api('GET', '/api/tokens/zzz', { token: user1 });
  assert.deepEqual([r.status, r.body.error], [400, 'invalid _id']);

  // ---- shop profile, services, nearby, admin ----
  const admin = (await api('POST', '/api/auth/login', { body: { email: 'admin@example.com', password: 'secret1' } })).body.token;
  r = await api('PATCH', `/api/queues/${qid}`, { token: staff, body: {
    category: 'medical', phone: '123', address: { street: '12 Mall Road', city: 'Kanpur' }, hours: { open: '08:00' },
    services: [{ name: 'General Consultation', minutes: 10 }, { name: 'Follow-up', minutes: 5 }],
    location: { lat: 26.45, lng: 80.33 } } });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.queue.category, r.body.queue.address.city, r.body.queue.hours.open, r.body.queue.hours.close], ['medical', 'Kanpur', '08:00', '18:00']);
  assert.deepEqual(r.body.queue.location, { lat: 26.45, lng: 80.33 });
  assert.equal(r.body.queue.services.length, 2);
  r = await api('PATCH', `/api/queues/${qid}`, { token: staff, body: { location: { lat: 999, lng: 0 } } });
  assert.equal(r.status, 400);
  r = await api('PATCH', `/api/queues/${qid}`, { token: staff, body: { category: 'nope' } });
  assert.equal(r.status, 400);

  r = await api('POST', '/api/queues', { token: staff2, body: { name: 'Far Salon', category: 'salon' } });
  const far = r.body.queue._id;
  await api('PATCH', `/api/queues/${far}`, { token: staff2, body: { location: { lat: 26.6, lng: 80.5 } } }); // ~25 km away
  await api('POST', '/api/queues', { token: staff2, body: { name: 'No Location Shop' } });

  r = await api('GET', '/api/queues/nearby?lat=26.451&lng=80.331&radius=5');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.queues.map((q) => q.name), ['Dr. Sharma Clinic']);
  assert.ok(r.body.queues[0].distanceKm < 1);
  assert.equal(typeof r.body.queues[0].waitingCount, 'number');
  r = await api('GET', '/api/shops/nearby?lat=26.451&lng=80.331&radius=50');
  assert.deepEqual(r.body.queues.map((q) => q.name), ['Dr. Sharma Clinic', 'Far Salon']);
  r = await api('GET', '/api/queues/nearby?lat=26.451&lng=80.331&radius=50&category=salon');
  assert.deepEqual(r.body.queues.map((q) => q.name), ['Far Salon']);
  r = await api('GET', '/api/queues/nearby?lat=x');
  assert.equal(r.status, 400);
  r = await api('GET', '/api/queues?q=consult');
  assert.deepEqual(r.body.queues.map((q) => q.name), ['Dr. Sharma Clinic']);

  r = await api('POST', `/api/queues/${qid}/join`, { token: user1, body: { service: 'Follow-up' } });
  assert.equal(r.status, 201);
  assert.equal(r.body.ticket.service, 'Follow-up');
  assert.ok(Array.isArray(r.body.ticket.waitingNumbers));
  r = await api('POST', `/api/queues/${qid}/join`, { token: user2, body: { service: 'Nope' } });
  assert.equal(r.status, 400);
  r = await api('POST', `/api/queues/${qid}/complete`, { token: staff });
  assert.equal(r.status, 200);
  assert.equal(r.body.current, null);
  r = await api('GET', `/api/queues/${qid}/stats`, { token: staff });
  assert.equal(r.status, 200);
  assert.ok(r.body.served >= 1 && r.body.perHour.length === 24);
  r = await api('GET', `/api/queues/${qid}/stats`, { token: user1 });
  assert.equal(r.status, 403);
  r = await api('GET', '/api/tokens/history', { token: user1 });
  assert.ok(r.body.tickets.length >= 1);

  r = await api('GET', '/api/admin/stats', { token: admin });
  assert.equal(r.status, 200);
  assert.ok(r.body.users >= 6 && r.body.businesses === 3 && r.body.tokensPerDay.length === 7);
  r = await api('GET', '/api/admin/stats', { token: staff });
  assert.equal(r.status, 403);
  r = await api('GET', '/api/admin/users', { token: admin });
  assert.ok(r.body.users.length >= 6 && r.body.users[0].passwordHash === undefined);
  r = await api('PATCH', '/api/auth/me', { token: user1, body: { name: 'User One' } });
  assert.equal(r.body.user.name, 'User One');
});
