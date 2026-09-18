import webpush from 'web-push';
import { PushSubscription } from './models.js';

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
export const pushEnabled = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (pushEnabled) webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
export const publicKey = pushEnabled ? VAPID_PUBLIC_KEY : null;

/** Send a push payload to every device of a user. Fire-and-forget; dead subscriptions (404/410) are removed. */
export async function sendPush(userId, payload) {
  if (!pushEnabled) return;
  const subs = await PushSubscription.find({ user: userId });
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 600 });
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) await PushSubscription.deleteOne({ _id: s._id });
      else console.warn('push failed', err.statusCode || err.message);
    }
  }));
}
