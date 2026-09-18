import mongoose from 'mongoose';
import dns from 'node:dns';
import { mkdirSync, existsSync, openSync, closeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Connect to MONGO_URI, or an embedded mongod persisting to server/data when unset. Returns a stop() for the embedded case. */
const IN_USE = `The local database in server/data is already in use by another process.
  Only one QueueLess process can use it at a time, so this usually means:
    - a server is already running in another terminal (stop it, or just use that one), or
    - npm run seed is still finishing (wait for it, then start the server).
  To run a second one alongside, point it elsewhere with MONGO_URI.`;

const MISSING = `MONGO_URI is not set. In production the app needs a MongoDB connection string:
  Render  -> your service -> Environment -> add MONGO_URI (render.yaml marks it sync: false, so it must be set in the dashboard)
  Docker  -> docker compose sets it for you
  Atlas   -> Network Access must allow the host's IP (0.0.0.0/0 for cloud hosts)`;

export async function connectDb() {
  // pasted values often arrive with a trailing newline or wrapped in quotes; both make mongoose reject the scheme
  let uri = (process.env.MONGO_URI ?? '').trim().replace(/^['"]|['"]$/g, '');
  if (!uri && process.env.NODE_ENV === 'production') throw new Error(MISSING);
  let mongo;
  if (!uri) {
    // no MONGO_URI -> embedded mongod in ./data. It is a devDependency, absent from production installs.
    let MongoMemoryServer;
    try {
      ({ MongoMemoryServer } = await import('mongodb-memory-server'));
    } catch {
      throw new Error(MISSING);
    }
    const dbPath = fileURLToPath(new URL('../data', import.meta.url));
    mkdirSync(dbPath, { recursive: true });

    // Windows holds mongod.lock exclusively while a server runs; check before spawning, because a busy dir can crash mongodb-memory-server outside any catch
    const lockFile = fileURLToPath(new URL('../data/mongod.lock', import.meta.url));
    if (existsSync(lockFile)) {
      try {
        closeSync(openSync(lockFile, 'r+'));
      } catch (err) {
        if (['EBUSY', 'EPERM', 'EACCES'].includes(err.code)) throw new Error(IN_USE);
      }
    }

    try {
      mongo = await MongoMemoryServer.create({ instance: { dbPath, storageEngine: 'wiredTiger' } });
    } catch (err) {
      // fallback for platforms with advisory locks, where the pre-flight check cannot see the conflict
      if (!/DBPathInUse|lock file/i.test(String(err?.message))) throw err;
      throw new Error(IN_USE);
    }
    uri = mongo.getUri();
  }
  // journal every write: the embedded mongod is killed when a short script exits, before WiredTiger checkpoints
  const opts = mongo ? { writeConcern: { w: 1, j: true } } : {};
  try {
    await mongoose.connect(uri, opts);
  } catch (err) {
    // mongodb+srv needs an SRV lookup; some local DNS stubs (VPNs, ad-blockers, 127.0.0.1 proxies) refuse it.
    // Retry once through public resolvers (override with DNS_SERVERS=8.8.8.8,1.1.1.1). Only Node's resolver is affected.
    if (!/^mongodb\+srv:/.test(uri) || !/querySrv|ECONNREFUSED|ENOTFOUND/.test(err.message)) throw err;
    dns.setServers((process.env.DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean));
    console.warn(`SRV lookup failed via system DNS (${err.message}); retrying with ${dns.getServers().join(', ')}`);
    await mongoose.connect(uri, opts);
  }
  return async () => { await mongoose.disconnect(); await mongo?.stop(); };
}
