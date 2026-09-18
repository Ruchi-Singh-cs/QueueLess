import { server } from './app.js';
import { connectDb } from './db.js';

if (!process.env.JWT_SECRET || /change-me/.test(process.env.JWT_SECRET)) console.warn('WARNING: JWT_SECRET is a placeholder — set a long random value before exposing this server');
await connectDb();
await (await import('./models.js')).Queue.updateMany({ status: { $exists: false } }, { status: 'approved' }); // shops from before verification existed
if (process.env.SEED === '1') console.log('seed:', await (await import('../scripts/seed.js')).seed());
const port = process.env.PORT || 4000;
server.listen(port, () => console.log(`QueueLess server on http://localhost:${port}`));
