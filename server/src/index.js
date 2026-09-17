import { server } from './app.js';
import { connectDb } from './db.js';

await connectDb();
await (await import('./models.js')).Queue.updateMany({ status: { $exists: false } }, { status: 'approved' }); // shops from before verification existed
if (process.env.SEED === '1') console.log('seed:', await (await import('../seed.js')).seed());
const port = process.env.PORT || 4000;
server.listen(port, () => console.log(`QueueLess server on http://localhost:${port}`));
