import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { verifyToken } from './auth.js';
import authRoutes from './routes/auth.js';
import queueRoutes from './routes/queues.js';
import tokenRoutes from './routes/tokens.js';
import appointmentRoutes from './routes/appointments.js';
import adminRoutes from './routes/admin.js';

export const app = express();
export const server = createServer(app);
export const io = new Server(server);
app.set('io', io);

app.use(express.json({ limit: '100kb' }));
app.use('/api/auth', authRoutes);
app.use('/api/queues', queueRoutes);
app.use('/api/shops', queueRoutes); // alias: a shop is a queue
app.use('/api/tokens', tokenRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));

const dist = fileURLToPath(new URL('../../client/dist', import.meta.url));
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*splat}', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  const status = err.status
    || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : err.code === 11000 ? 409 : 500);
  if (status === 500) console.error(err);
  const msg = status === 500 ? 'internal error'
    : err.code === 11000 ? 'already exists'
    : err.name === 'CastError' ? `invalid ${err.path}`
    : err.code === 'ENOENT' ? 'not found'
    : err.message;
  res.status(status).json({ error: msg });
});

// Guests may connect (to watch public queues); a bad token is rejected.
io.use((socket, next) => {
  const { token } = socket.handshake.auth ?? {};
  try {
    socket.user = token ? verifyToken(token) : null;
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});

io.on('connection', (socket) => {
  if (socket.user) socket.join(`user:${socket.user.id}`);
  socket.on('queue:watch', (id) => typeof id === 'string' && socket.join(`queue:${id}`));
  socket.on('queue:unwatch', (id) => typeof id === 'string' && socket.leave(`queue:${id}`));
});
