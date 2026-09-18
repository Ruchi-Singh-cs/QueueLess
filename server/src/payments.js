import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

const { RAZORPAY_KEY_ID: KEY_ID, RAZORPAY_KEY_SECRET: KEY_SECRET } = process.env;
export const paymentsEnabled = !!(KEY_ID && KEY_SECRET);
export const publicKeyId = paymentsEnabled ? KEY_ID : null;
// ponytail: key ids starting with rzp_stub skip the network so tests can run the whole flow with a known secret
const STUB = paymentsEnabled && KEY_ID.startsWith('rzp_stub');

/** Create a Razorpay order. amount is in paise. Returns { id, amount, currency }. */
export async function createOrder(amount, receipt, notes = {}) {
  if (!paymentsEnabled) throw Object.assign(new Error('payments are not configured'), { status: 503 });
  if (STUB) return { id: `order_stub_${randomBytes(8).toString('hex')}`, amount, currency: 'INR' };
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64')}` },
    body: JSON.stringify({ amount, currency: 'INR', receipt, notes }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error?.description || 'could not create payment order'), { status: 502 });
  return body;
}

/** Razorpay signs order_id|payment_id with the key secret after a successful checkout. */
export function verifyPayment(orderId, paymentId, signature) {
  if (!paymentsEnabled || !orderId || !paymentId || !signature) return false;
  const expected = createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(String(signature));
  return a.length === b.length && timingSafeEqual(a, b);
}
