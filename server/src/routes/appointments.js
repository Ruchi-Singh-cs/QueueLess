import { Router } from 'express';
import { Appointment, Queue } from '../models.js';
import { authRequired, fail, field, owns } from '../auth.js';
import { approved, joinQueue, broadcastQueue } from '../queue.js';

const r = Router();
r.use(authRequired);

const POP = [{ path: 'queue', select: 'name category address' }, { path: 'user', select: 'name' }, { path: 'token', select: 'number status' }];

r.get('/', async (req, res) => {
  const { id, role } = req.user;
  const clauses = [];
  if (role === 'user') clauses.push({ user: id });
  if (role === 'staff') clauses.push({ $or: [{ user: id }, { queue: { $in: await Queue.distinct('_id', { owner: id }) } }] });
  if (typeof req.query.queue === 'string') clauses.push({ queue: req.query.queue });
  const appointments = await Appointment.find(clauses.length ? { $and: clauses } : {}).sort('at').populate(POP);
  res.json({ appointments });
});

r.post('/', async (req, res) => {
  const queue = await Queue.findById(field(req, 'queue', 'string'));
  if (!queue) throw fail(404, 'queue not found');
  if (!approved(queue)) throw fail(403, queue.status === 'suspended' ? 'this business is suspended' : 'this business is awaiting verification');
  const at = new Date(field(req, 'at', 'string'));
  if (!(at > new Date())) throw fail(400, 'at must be a future date');
  const service = field(req, 'service', 'string', true) ?? '';
  if (service && !queue.services.some((s) => s.name === service)) throw fail(400, 'unknown service');
  if (await Appointment.exists({ queue: queue._id, at, status: 'booked' })) throw fail(409, 'slot already booked');
  const appointment = await Appointment.create({ queue: queue._id, user: req.user.id, at, service, note: field(req, 'note', 'string', true) });
  res.status(201).json({ appointment: await appointment.populate(POP) });
});

r.patch('/:id', async (req, res) => {
  const status = field(req, 'status', 'string');
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw fail(404, 'appointment not found');
  const queue = await Queue.findById(appointment.queue);
  const staff = owns(queue, req.user);
  if (!staff && !(String(appointment.user) === req.user.id && status === 'cancelled')) throw fail(403, 'forbidden');
  if (!['checked_in', 'completed', 'cancelled'].includes(status)) throw fail(400, 'invalid status');
  const allowed = appointment.status === 'booked' || (appointment.status === 'checked_in' && staff && status !== 'checked_in');
  if (!allowed) throw fail(400, `appointment is already ${appointment.status}`);
  if (status === 'checked_in') appointment.token = (await joinQueue(queue, appointment.user, { priority: true, service: appointment.service }))._id;
  appointment.status = status;
  await appointment.save();
  if (status === 'checked_in') await broadcastQueue(req.app.get('io'), queue._id);
  res.json({ appointment: await appointment.populate(POP) });
});

export default r;
