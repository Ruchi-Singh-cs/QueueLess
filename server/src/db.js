import mongoose from 'mongoose';
import dns from 'node:dns';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Connect to MONGO_URI, or an embedded mongod persisting to server/data when unset. Returns a stop() for the embedded case. */
export async function connectDb() {
  let uri = process.env.MONGO_URI;
  let mongo;
  if (!uri) {
    // ponytail: no MONGO_URI -> embedded mongod persisting to ./data; set MONGO_URI to use a real server
    // It is a devDependency, so a production install (Docker) does not have it. Say so plainly rather
    // than dying with ERR_MODULE_NOT_FOUND.
    let MongoMemoryServer;
    try {
      ({ MongoMemoryServer } = await import('mongodb-memory-server'));
    } catch {
      throw new Error('MONGO_URI is not set and the embedded database is unavailable in a production install. Set MONGO_URI to a MongoDB connection string (docker compose does this for you).');
    }
    const dbPath = fileURLToPath(new URL('../data', import.meta.url));
    mkdirSync(dbPath, { recursive: true });
    mongo = await MongoMemoryServer.create({ instance: { dbPath, storageEngine: 'wiredTiger' } });
    uri = mongo.getUri();
  }
  // The embedded mongod is killed when a short script exits, and WiredTiger only checkpoints
  // periodically — so the last writes of `npm run seed`/`npm run demo` were being lost. Journaling
  // every write makes them survive the kill (and replay from ./data on the next start).
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
