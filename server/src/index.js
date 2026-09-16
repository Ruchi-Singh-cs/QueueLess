import { server } from './app.js';
import { connectDb } from './db.js';

await connectDb();
if (process.env.SEED === '1') console.log('seed:', await (await import('../seed.js')).seed());
const port = process.env.PORT || 4000;
server.listen(port, () => console.log(`QueueLess server on http://localhost:${port}`));
