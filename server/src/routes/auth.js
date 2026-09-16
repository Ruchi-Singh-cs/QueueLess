import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models.js';
import { authRequired, fail, field, signToken } from '../auth.js';

const r = Router();
const pub = (u) => ({ _id: u._id, name: u.name, email: u.email, role: u.role });

r.post('/register', async (req, res) => {
  const name = field(req, 'name', 'string');
  const email = field(req, 'email', 'string').trim().toLowerCase();
  const password = field(req, 'password', 'string');
  if (password.length < 6) throw fail(400, 'password must be at least 6 characters');
  const role = email === process.env.ADMIN_EMAIL?.trim().toLowerCase() ? 'admin' : req.body.role === 'staff' ? 'staff' : 'user';
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10), role });
  res.status(201).json({ token: signToken(user), user: pub(user) });
});

r.post('/login', async (req, res) => {
  const email = field(req, 'email', 'string').trim().toLowerCase();
  const password = field(req, 'password', 'string');
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw fail(401, 'invalid email or password');
  res.json({ token: signToken(user), user: pub(user) });
});

r.get('/me', authRequired, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw fail(401, 'unauthorized');
  res.json({ user: pub(user) });
});

r.patch('/me', authRequired, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw fail(401, 'unauthorized');
  const name = field(req, 'name', 'string', true);
  if (name !== undefined) {
    if (!name.trim()) throw fail(400, 'name is required');
    user.name = name;
  }
  const password = field(req, 'password', 'string', true);
  if (password !== undefined) {
    if (password.length < 6) throw fail(400, 'password must be at least 6 characters');
    user.passwordHash = await bcrypt.hash(password, 10);
  }
  await user.save();
  res.json({ user: pub(user) });
});

export default r;
