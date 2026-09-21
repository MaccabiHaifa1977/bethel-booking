'use strict';
// End-to-end test of the paid booking flow with simulated PayPal and Morning servers.
// Uses the real database (dates in 2027) and removes its own test bookings at the end.
// Run: npm test
const path = require('path');
const assert = require('assert');
try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch (_) { /* CI */ }

process.env.PAYPAL_CLIENT_ID = 'test-client';
process.env.PAYPAL_CLIENT_SECRET = 'test-secret';
process.env.PAYPAL_ENV = 'sandbox';
process.env.MORNING_CLIENT_ID = 'test-morning';
process.env.MORNING_CLIENT_SECRET = 'test-morning-secret';
process.env.MORNING_ENV = 'sandbox';
process.env.DEMO_MODE = 'false';
delete process.env.RESEND_API_KEY;

const calls = [];
const orders = new Map();
let nextOrder = 1;
let docNumber = 40001;

global.fetch = async (url, opts = {}) => {
  const body = opts.body && typeof opts.body === 'string' && opts.body.startsWith('{') ? JSON.parse(opts.body) : opts.body;
  calls.push({ url, method: opts.method || 'GET', body, headers: opts.headers || {} });
  const json = (status, data) => ({ ok: status < 400, status, json: async () => data, text: async () => JSON.stringify(data) });

  if (url.endsWith('/v1/oauth2/token')) return json(200, { access_token: 'pp-token', expires_in: 3600 });
  if (url.endsWith('/v2/checkout/orders') && opts.method === 'POST') {
    const id = 'ORDER' + nextOrder++;
    orders.set(id, { id, status: 'CREATED', pu: body.purchase_units[0] });
    return json(201, { id, status: 'CREATED' });
  }
  let m = url.match(/\/v2\/checkout\/orders\/([^/]+)\/capture$/);
  if (m) {
    const o = orders.get(m[1]);
    o.status = 'COMPLETED';
    return json(201, {
      id: o.id, status: 'COMPLETED', payer: { email_address: 'payer@example.com', name: { given_name: 'John', surname: 'Payer' } },
      purchase_units: [{ payments: { captures: [{ id: 'CAP-' + o.id, status: 'COMPLETED', amount: o.pu.amount }] } }],
    });
  }
  m = url.match(/\/v2\/checkout\/orders\/([^/]+)$/);
  if (m) {
    const o = orders.get(m[1]);
    if (o.status === 'COMPLETED') {
      return json(200, { id: o.id, status: 'COMPLETED', payer: { email_address: 'payer@example.com' }, purchase_units: [{ payments: { captures: [{ id: 'CAP-' + o.id, status: 'COMPLETED', amount: o.pu.amount }] } }] });
    }
    return json(200, { id: o.id, status: o.status });
  }
  m = url.match(/\/v2\/payments\/captures\/([^/]+)\/refund$/);
  if (m) return json(201, { id: 'REF-' + m[1], status: 'COMPLETED' });

  if (url === 'https://api.sandbox.morning.dev/idp/v1/oauth/token') {
    assert.strictEqual(body.grant_type, 'client_credentials');
    return json(200, { accessToken: 'mo-token', tokenType: 'Bearer', expiresAt: Math.floor(Date.now() / 1000) + 3600 });
  }
  if (url === 'https://sandbox.d.greeninvoice.co.il/api/v1/documents') {
    const n = docNumber++;
    return json(201, { id: 'doc-' + n, number: n, type: body.type, signed: true, lang: body.lang, client: {}, url: { he: `https://docs.test/${n}/he`, en: `https://docs.test/${n}/en`, origin: `https://docs.test/${n}` } });
  }
  throw new Error('Unexpected fetch ' + url);
};

const db = require('../src/db');
const booking = require('../src/booking');

async function main() {
  await db.migrate();
  const types = await booking.listRoomTypes();
  const room = types.find((t) => t.slug === 'private-room');
  const dorm = types.find((t) => t.slug === 'dorm-women');
  const created = [];
  global.__created = created;

  // 1. Guest books 1 private room (2 guests) + 1 women's dorm bed for 3 nights and pays with PayPal
  const b = await booking.createBooking({
    lang: 'de', checkIn: '2027-03-01', checkOut: '2027-03-04',
    lines: [{ typeId: room.id, guests: 2 }, { typeId: dorm.id }],
    contact: { name: 'Anna Müller', email: 'anna@example.de', phone: '+49 170 555555', country: 'DE' },
    travelers: [{ name: 'Anna Müller', gender: 'female' }, { name: 'Jonas Müller', gender: 'male' }, { name: 'Lea Müller', gender: 'female' }],
    acceptTerms: true, payMethod: 'paypal',
  }, { source: 'web' });
  created.push(b.id);
  assert.strictEqual(b.status, 'pending');
  assert.strictEqual(Number(b.total), 300 * 3 + 100 * 3);

  const order = await booking.startPaypal(b.token);
  const createCall = calls.find((c) => c.url.endsWith('/v2/checkout/orders'));
  assert.strictEqual(createCall.body.purchase_units[0].amount.value, '1200.00');
  assert.strictEqual(createCall.body.purchase_units[0].amount.currency_code, 'ILS');
  assert.strictEqual(createCall.body.application_context.shipping_preference, 'NO_SHIPPING');

  const done = await booking.capturePaypal(b.token, order.id);
  assert.strictEqual(done.status, 'confirmed');
  assert.strictEqual(Number(done.paid), 1200);

  const pay = await db.one('SELECT * FROM payments WHERE booking_id = $1', [b.id]);
  assert.strictEqual(pay.method, 'paypal');
  assert.strictEqual(pay.paypal_capture_id, 'CAP-' + order.id);
  assert.ok(pay.doc_id, 'receipt was created: ' + pay.doc_error);
  assert.strictEqual(pay.doc_url, `https://docs.test/${pay.doc_number}/en`);

  const doc = calls.find((c) => c.url.endsWith('/documents')).body;
  assert.strictEqual(doc.type, 400, 'receipt (קבלה) for a non-profit');
  assert.strictEqual(doc.lang, 'en', 'German guests get an English document');
  assert.strictEqual(doc.payment[0].type, 5, 'PayPal payment type');
  assert.strictEqual(doc.payment[0].price, 1200);
  assert.strictEqual(doc.payment[0].transactionId, pay.paypal_capture_id);
  assert.strictEqual(doc.income.reduce((a, r) => a + r.quantity * r.price, 0), 1200, 'income rows add up to the payment');
  assert.ok(doc.emailContent.startsWith('Vielen Dank'), 'email text in German');
  assert.deepStrictEqual(doc.client.emails, ['anna@example.de']);
  const ctype = calls.find((c) => c.url.endsWith('/documents')).headers.Authorization;
  assert.strictEqual(ctype, 'Bearer mo-token');

  // capturing twice must not double-charge or double-record
  await booking.capturePaypal(b.token, order.id);
  assert.strictEqual((await db.one('SELECT count(*)::int AS n FROM payments WHERE booking_id = $1', [b.id])).n, 1);
  console.log('✔ PayPal payment + Morning receipt');

  // 2. Guest approved in PayPal but closed the browser: the minute job must finish it, not release the room
  const b2 = await booking.createBooking({
    lang: 'he', checkIn: '2027-03-10', checkOut: '2027-03-12', lines: [{ typeId: room.id, guests: 1 }],
    contact: { name: 'דנה לוי', email: 'dana@example.co.il', phone: '0501234567', country: 'IL' },
    travelers: [{ name: 'דנה לוי', gender: 'female' }], acceptTerms: true, payMethod: 'paypal',
  }, { source: 'web' });
  created.push(b2.id);
  const o2 = await booking.startPaypal(b2.token);
  orders.get(o2.id).status = 'APPROVED';
  await db.q(`UPDATE bookings SET expires_at = now() - interval '1 minute' WHERE id = $1`, [b2.id]);
  await booking.sweepHolds();
  const after = await db.one('SELECT status, paid FROM bookings WHERE id = $1', [b2.id]);
  assert.strictEqual(after.status, 'confirmed');
  assert.strictEqual(Number(after.paid), 500);
  const doc2 = calls.filter((c) => c.url.endsWith('/documents')).pop().body;
  assert.strictEqual(doc2.lang, 'he');
  console.log('✔ Abandoned-but-approved payment is captured by the minute job');

  // 3. Unpaid hold expires and releases the room
  const b3 = await booking.createBooking({
    lang: 'en', checkIn: '2027-03-20', checkOut: '2027-03-21', lines: [{ typeId: room.id, guests: 1 }],
    contact: { name: 'Tom Test', email: 'tom@example.com', phone: '+1 555 1234567' },
    travelers: [{ name: 'Tom Test', gender: 'male' }], acceptTerms: true, payMethod: 'paypal',
  }, { source: 'web' });
  created.push(b3.id);
  const o3 = await booking.startPaypal(b3.token);
  await db.q(`UPDATE bookings SET expires_at = now() - interval '1 minute' WHERE id = $1`, [b3.id]);
  await booking.sweepHolds();
  assert.strictEqual((await db.one('SELECT status FROM bookings WHERE id = $1', [b3.id])).status, 'expired');
  assert.strictEqual((await db.one('SELECT count(*)::int AS n FROM booking_units WHERE booking_id = $1 AND active', [b3.id])).n, 0);
  await assert.rejects(booking.capturePaypal(b3.token, o3.id), (e) => e.code === 'hold_expired');
  console.log('✔ Unpaid hold expires, room released, late capture refused');

  // 4. Cancel with PayPal refund
  const res = await booking.cancelBooking(b.id, { refund: true });
  assert.strictEqual(res.booking.status, 'cancelled');
  assert.strictEqual(Number(res.booking.paid), 0);
  assert.ok(calls.some((c) => c.url.includes('/refund')));
  console.log('✔ Cancel + PayPal refund');

  await db.q('DELETE FROM bookings WHERE id = ANY($1::int[])', [created]);
  await db.pool.end();
  console.log('\nAll flow tests passed.');
}

main().catch(async (e) => {
  console.error('TEST FAILED:', e);
  try { if (global.__created) await db.q('DELETE FROM bookings WHERE id = ANY($1::int[])', [global.__created]); await db.pool.end(); } catch (_) { /* ignore */ }
  process.exit(1);
});
