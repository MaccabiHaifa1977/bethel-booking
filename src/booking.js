'use strict';
const db = require('./db');
const { getSettings } = require('./settings');
const paypal = require('./paypal');
const morning = require('./morning');
const mailer = require('./mailer');
const {
  HttpError, todayIL, isDate, addDays, nightsBetween, dmy, randomCode, randomToken, money, isEmail, str, int, pickLang, withTimeout,
} = require('./util');

// ---------------------------------------------------------------- helpers

let lastOrigin = '';
function rememberOrigin(req) {
  if (!process.env.PUBLIC_URL && req) lastOrigin = `${req.protocol}://${req.get('host')}`;
}
function origin() {
  return (process.env.PUBLIC_URL || lastOrigin || '').replace(/\/$/, '');
}
function langPrefix(lang) {
  return lang === 'en' ? '' : '/' + lang;
}
function bookingLink(b) {
  return `${origin()}${langPrefix(b.lang)}/booking/${b.token}`;
}
function adminLink(b) {
  return `${origin()}/admin#/booking/${b.id}`;
}
function demoMode() {
  return process.env.DEMO_MODE === 'true';
}
function onlinePaymentAvailable() {
  return paypal.configured() || demoMode();
}

async function listRoomTypes({ activeOnly = true } = {}) {
  return db.many(
    `SELECT t.*, (SELECT count(*)::int FROM units u WHERE u.room_type_id = t.id AND u.active) AS unit_count
       FROM room_types t ${activeOnly ? 'WHERE t.active' : ''}
      ORDER BY t.sort, t.id`
  );
}

function priceFor(type, guests) {
  const prices = Array.isArray(type.prices) ? type.prices.map(Number) : [];
  if (!prices.length) return 0;
  if (type.sold_as === 'bed') return money(prices[0]);
  const g = Math.max(1, Math.min(type.capacity, guests));
  const p = prices[g - 1] !== undefined ? prices[g - 1] : prices[prices.length - 1];
  return money(p);
}

function checkDates(checkIn, checkOut, s, { admin = false } = {}) {
  if (!isDate(checkIn) || !isDate(checkOut)) throw new HttpError(400, 'dates_invalid');
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) throw new HttpError(400, 'dates_invalid');
  if (admin) {
    if (nights > 366) throw new HttpError(400, 'dates_invalid');
    return nights;
  }
  const today = todayIL();
  if (checkIn < today) throw new HttpError(400, 'dates_past');
  if (checkIn > addDays(today, s.booking_window_days)) throw new HttpError(400, 'dates_too_far');
  if (nights < s.min_nights) throw new HttpError(400, 'min_nights');
  if (nights > s.max_nights) throw new HttpError(400, 'max_nights');
  return nights;
}

// Release holds that never reached PayPal (no money can be involved)
async function expireStaleHoldsQuick() {
  await db.q(
    `WITH x AS (
       UPDATE bookings SET status = 'expired', updated_at = now()
        WHERE status = 'pending' AND expires_at < now() AND paypal_order_id IS NULL
        RETURNING id)
     UPDATE booking_units SET active = false WHERE booking_id IN (SELECT id FROM x)`
  );
}

async function availability(checkIn, checkOut) {
  await expireStaleHoldsQuick();
  const rows = await db.many(
    `SELECT t.id, count(u.id)::int AS available
       FROM room_types t
       LEFT JOIN units u ON u.room_type_id = t.id AND u.active AND NOT EXISTS (
            SELECT 1 FROM booking_units bu
             WHERE bu.unit_id = u.id AND bu.active AND bu.stay && daterange($1::date, $2::date))
      WHERE t.active
      GROUP BY t.id`,
    [checkIn, checkOut]
  );
  const map = {};
  for (const r of rows) map[r.id] = r.available;
  return map;
}

async function bookingLines(bookingId) {
  const rows = await db.many(
    `SELECT bu.id, bu.room_type_id, bu.unit_id, bu.guests, bu.nightly, bu.amount, bu.active,
            t.name AS type_name, t.sold_as, u.name AS unit_name
       FROM booking_units bu
       JOIN room_types t ON t.id = bu.room_type_id
       JOIN units u ON u.id = bu.unit_id
      WHERE bu.booking_id = $1
      ORDER BY t.sort, u.sort, bu.id`,
    [bookingId]
  );
  return rows.map((r) => ({
    id: r.id, typeId: r.room_type_id, unitId: r.unit_id, unitName: r.unit_name, typeName: r.type_name,
    soldAs: r.sold_as, guests: r.guests, nightly: r.nightly, amount: r.amount, active: r.active,
  }));
}

async function getByToken(token) {
  if (typeof token !== 'string' || token.length < 10 || token.length > 64) return null;
  return db.one('SELECT * FROM bookings WHERE token = $1', [token]);
}

// ---------------------------------------------------------------- create

function cleanTravelers(list, required) {
  if (!Array.isArray(list)) {
    if (required) throw new HttpError(400, 'travelers_mismatch');
    return [];
  }
  return list.slice(0, 60).map((t) => {
    const name = str(t && t.name, 100);
    const gender = t && (t.gender === 'male' || t.gender === 'female') ? t.gender : '';
    if (required && (name.length < 2 || !gender)) throw new HttpError(400, 'travelers_incomplete');
    return { name, gender };
  }).filter((t) => t.name);
}

/**
 * Create a booking and assign free units.
 * input: { lang, checkIn, checkOut, lines:[{typeId, guests, unitId?}], contact:{name,email,phone,country},
 *          travelers:[{name,gender}], notes, payMethod }
 * opts:  { source: 'web'|'admin', kind: 'guest'|'block', totalOverride, adminNotes, blockReason }
 */
async function createBooking(input, opts = {}) {
  const s = await getSettings();
  const source = opts.source === 'admin' ? 'admin' : 'web';
  const kind = opts.kind === 'block' ? 'block' : 'guest';
  const isWeb = source === 'web';
  const lang = ['en', 'he', 'de', 'ru'].includes(input.lang) ? input.lang : 'en';
  const nights = checkDates(input.checkIn, input.checkOut, s, { admin: !isWeb });

  const rawLines = Array.isArray(input.lines) ? input.lines.slice(0, 40) : [];
  if (!rawLines.length) throw new HttpError(400, 'no_rooms');

  const types = await listRoomTypes({ activeOnly: isWeb });
  const typeById = new Map(types.map((t) => [t.id, t]));
  const lines = rawLines.map((l) => {
    const type = typeById.get(int(l && l.typeId));
    if (!type) throw new HttpError(400, 'room_type_invalid');
    const guests = kind === 'block' ? 0 : type.sold_as === 'bed' ? 1 : int(l.guests, 1);
    if (kind !== 'block' && (guests < 1 || guests > type.capacity)) throw new HttpError(400, 'guests_invalid');
    return { type, guests, unitId: !isWeb && l.unitId ? int(l.unitId) : null };
  });
  const guestsCount = lines.reduce((a, l) => a + l.guests, 0);

  let contact = { name: '', email: '', phone: '', country: '' };
  let travelers = [];
  let payMethod = null;
  let status = 'confirmed';

  if (kind === 'guest') {
    const c = input.contact || {};
    contact = {
      name: str(c.name, 100),
      email: str(c.email, 200).toLowerCase(),
      phone: str(c.phone, 40),
      country: /^[A-Z]{2}$/.test(c.country || '') ? c.country : '',
    };
    if (contact.name.length < 2) throw new HttpError(400, 'name_required');
    if (isWeb || contact.email) {
      if (!isEmail(contact.email)) throw new HttpError(400, 'email_invalid');
    }
    if (isWeb && contact.phone.replace(/\D/g, '').length < 6) throw new HttpError(400, 'phone_required');

    travelers = cleanTravelers(input.travelers, isWeb);
    if (isWeb) {
      if (guestsCount > s.max_guests_online) throw new HttpError(400, 'max_guests');
      if (travelers.length !== guestsCount) throw new HttpError(400, 'travelers_mismatch');
      if (input.acceptTerms !== true) throw new HttpError(400, 'terms_required');
    }
    if (travelers.length) {
      const men = travelers.filter((t) => t.gender === 'male').length;
      const women = travelers.filter((t) => t.gender === 'female').length;
      const menBeds = lines.filter((l) => l.type.gender === 'male').reduce((a, l) => a + l.guests, 0);
      const womenBeds = lines.filter((l) => l.type.gender === 'female').reduce((a, l) => a + l.guests, 0);
      if (menBeds > men || womenBeds > women) throw new HttpError(400, 'gender_mismatch');
    }

    if (isWeb) {
      const mode = s.payment_mode;
      payMethod = input.payMethod === 'arrival' ? 'arrival' : 'paypal';
      if (mode === 'paypal' && payMethod !== 'paypal') throw new HttpError(400, 'payment_unavailable');
      if (mode === 'arrival' && payMethod !== 'arrival') throw new HttpError(400, 'payment_unavailable');
      if (payMethod === 'paypal' && !onlinePaymentAvailable()) throw new HttpError(400, 'payment_unavailable');
      status = payMethod === 'paypal' ? 'pending' : 'confirmed';
    } else {
      payMethod = 'manual';
    }
  }

  await expireStaleHoldsQuick();

  const booking = await db.tx(async (c) => {
    // One booking at a time: the hostel is small, so serialising avoids any allocation races
    await c.query('SELECT pg_advisory_xact_lock(4242)');

    const taken = [];
    // 1) explicitly chosen units (admin)
    for (const l of lines.filter((x) => x.unitId)) {
      const r = await c.query(
        `SELECT u.id FROM units u
          WHERE u.id = $1 AND u.room_type_id = $2 AND NOT (u.id = ANY($5::int[])) AND NOT EXISTS (
                SELECT 1 FROM booking_units bu WHERE bu.unit_id = u.id AND bu.active AND bu.stay && daterange($3::date, $4::date))`,
        [l.unitId, l.type.id, input.checkIn, input.checkOut, taken]
      );
      if (!r.rowCount) throw new HttpError(409, 'unit_busy');
      taken.push(l.unitId);
    }
    // 2) automatic assignment, per room type
    const byType = new Map();
    for (const l of lines.filter((x) => !x.unitId)) {
      if (!byType.has(l.type.id)) byType.set(l.type.id, []);
      byType.get(l.type.id).push(l);
    }
    for (const [typeId, group] of byType) {
      const r = await c.query(
        `SELECT u.id FROM units u
          WHERE u.room_type_id = $1 AND u.active AND NOT (u.id = ANY($4::int[])) AND NOT EXISTS (
                SELECT 1 FROM booking_units bu WHERE bu.unit_id = u.id AND bu.active AND bu.stay && daterange($2::date, $3::date))
          ORDER BY u.sort, u.id
          LIMIT $5`,
        [typeId, input.checkIn, input.checkOut, taken, group.length]
      );
      if (r.rowCount < group.length) throw new HttpError(409, 'no_availability');
      group.forEach((l, i) => { l.unitId = r.rows[i].id; taken.push(l.unitId); });
    }

    // 3) prices
    for (const l of lines) {
      l.nightly = kind === 'block' ? 0 : priceFor(l.type, l.guests);
      l.amount = money(l.nightly * nights);
    }
    let total = money(lines.reduce((a, l) => a + l.amount, 0));
    if (!isWeb && opts.totalOverride !== undefined && opts.totalOverride !== null && opts.totalOverride !== '') {
      const t = Number(opts.totalOverride);
      if (!Number.isFinite(t) || t < 0 || t > 1000000) throw new HttpError(400, 'total_invalid');
      total = money(t);
    }
    if (kind === 'block') total = 0;

    let code;
    for (let i = 0; i < 5; i++) {
      code = randomCode(6);
      const ex = await c.query('SELECT 1 FROM bookings WHERE code = $1', [code]);
      if (!ex.rowCount) break;
    }

    const holdMinutes = s.hold_minutes || 20;
    const ins = await c.query(
      `INSERT INTO bookings (code, token, kind, source, status, check_in, check_out, lang, guest_name, email, phone, country,
                             travelers, guests_count, notes, admin_notes, currency, total, pay_method, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
               CASE WHEN $5 = 'pending' THEN now() + ($20::int * interval '1 minute') ELSE NULL END)
       RETURNING *`,
      [
        code, randomToken(), kind, source, status, input.checkIn, input.checkOut, lang,
        kind === 'block' ? str(opts.blockReason || input.blockReason, 100) || 'חסימה' : contact.name,
        contact.email || null, contact.phone || null, contact.country || null,
        JSON.stringify(travelers), guestsCount, str(input.notes, 2000) || null, str(opts.adminNotes, 2000) || null,
        s.currency || 'ILS', total, payMethod, holdMinutes,
      ]
    );
    const b = ins.rows[0];
    for (const l of lines) {
      await c.query(
        `INSERT INTO booking_units (booking_id, room_type_id, unit_id, guests, nightly, amount, stay)
         VALUES ($1,$2,$3,$4,$5,$6, daterange($7::date, $8::date))`,
        [b.id, l.type.id, l.unitId, l.guests, l.nightly, l.amount, input.checkIn, input.checkOut]
      );
    }
    await db.audit(b.id, 'created', { source, kind, status, total, payMethod }, c);
    return b;
  }).catch((err) => {
    if (err.code === '23P01') throw new HttpError(409, 'no_availability');
    throw err;
  });

  if (booking.status === 'confirmed' && kind === 'guest' && isWeb) {
    afterConfirmed(booking.id, null, { issueReceipt: false }).catch((e) => console.error('[booking] afterConfirmed', e.message));
  }
  return booking;
}

// ---------------------------------------------------------------- payment

async function startPaypal(token) {
  const b = await getByToken(token);
  if (!b) throw new HttpError(404, 'not_found');
  if (b.status === 'confirmed') throw new HttpError(409, 'already_paid');
  if (b.status !== 'pending' || new Date(b.expires_at) < new Date()) throw new HttpError(410, 'hold_expired');
  if (!paypal.configured()) throw new HttpError(400, 'payment_unavailable');
  const s = await getSettings();
  const site = pickLang(s.site_name, 'en');
  const invoiceId = `${b.code}-${randomCode(4)}`;
  const order = await paypal.createOrder({
    amount: b.total,
    currency: b.currency,
    referenceId: b.code,
    customId: b.id,
    invoiceId,
    description: `${site} - booking ${b.code} (${dmy(b.check_in)} - ${dmy(b.check_out)})`,
    brandName: site,
    locale: { he: 'he-IL', de: 'de-DE', en: 'en-US', ru: 'ru-RU' }[b.lang] || 'en-US',
  });
  await db.q(
    `UPDATE bookings SET paypal_order_id = $2, updated_at = now(),
            expires_at = GREATEST(expires_at, now() + interval '15 minutes')
      WHERE id = $1 AND status = 'pending'`,
    [b.id, order.id]
  );
  await db.audit(b.id, 'paypal_order_created', { orderId: order.id });
  return { id: order.id };
}

// Mark a booking as paid. Safe to call twice (second call is a no-op).
async function finalizePaid(bookingId, pay) {
  return db.tx(async (c) => {
    const b = (await c.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [bookingId])).rows[0];
    if (!b) throw new HttpError(404, 'not_found');
    if (pay.paypal_order_id) {
      const ex = await c.query('SELECT id FROM payments WHERE paypal_order_id = $1', [pay.paypal_order_id]);
      if (ex.rowCount) return { bookingId, paymentId: ex.rows[0].id, already: true };
    }
    let warning = null;
    if (b.status === 'expired' || b.status === 'cancelled') {
      // Paid after the hold was released - try to take the same units back
      try {
        await c.query('SAVEPOINT reactivate');
        await c.query('UPDATE booking_units SET active = true WHERE booking_id = $1', [bookingId]);
        await c.query('RELEASE SAVEPOINT reactivate');
      } catch (e) {
        await c.query('ROLLBACK TO SAVEPOINT reactivate');
        warning = '⚠ התשלום התקבל אחרי שפג השריון, והחדרים כבר נתפסו. יש לשבץ את האורחים מחדש.';
      }
    }
    await c.query(
      `UPDATE bookings SET status = 'confirmed', paid = paid + $2, pay_method = $3, expires_at = NULL, updated_at = now(),
              admin_notes = CASE WHEN $4::text IS NULL THEN admin_notes ELSE concat_ws(E'\\n', admin_notes, $4::text) END
        WHERE id = $1`,
      [bookingId, pay.amount, pay.method === 'demo' ? 'paypal' : pay.method, warning]
    );
    const p = await c.query(
      `INSERT INTO payments (booking_id, method, amount, currency, status, paypal_order_id, paypal_capture_id, payer_email, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [bookingId, pay.method, pay.amount, pay.currency || b.currency, pay.status || 'completed',
        pay.paypal_order_id || null, pay.paypal_capture_id || null, pay.payer_email || null, pay.note || null]
    );
    if (pay.amount && Math.abs(Number(pay.amount) - Number(b.total)) > 0.005) {
      await c.query(
        `UPDATE bookings SET admin_notes = concat_ws(E'\\n', admin_notes, $2::text) WHERE id = $1`,
        [bookingId, `⚠ הסכום ששולם (${pay.amount}) שונה מסכום ההזמנה (${b.total}).`]
      );
    }
    await db.audit(bookingId, 'paid', { method: pay.method, amount: pay.amount, capture: pay.paypal_capture_id || null, status: pay.status }, c);
    return { bookingId, paymentId: p.rows[0].id, already: false };
  });
}

async function afterConfirmed(bookingId, paymentId, { issueReceipt: withReceipt = true, sendEmails = true } = {}) {
  if (withReceipt && paymentId) {
    try {
      await withTimeout(issueReceipt(paymentId), 15000, 'receipt');
    } catch (e) {
      console.error('[receipt]', e.message);
    }
  }
  if (sendEmails) sendConfirmationEmails(bookingId).catch((e) => console.error('[mail]', e.message));
}

async function sendConfirmationEmails(bookingId, { guest = true, admin = true } = {}) {
  const b = await db.one('SELECT * FROM bookings WHERE id = $1', [bookingId]);
  if (!b || b.kind !== 'guest') return;
  const s = await getSettings();
  const lines = await bookingLines(b.id);
  if (guest && b.email) {
    const m = mailer.guestEmail('confirmed', { booking: b, lines, settings: s, link: bookingLink(b) });
    await mailer.send({ to: b.email, ...m, replyTo: s.email });
  }
  if (admin && s.notify_email) {
    const m = mailer.adminEmail({ booking: b, lines, adminLink: adminLink(b) });
    await mailer.send({ to: s.notify_email, ...m, replyTo: b.email || undefined });
  }
}

async function capturePaypal(token, orderId) {
  const b = await getByToken(token);
  if (!b) throw new HttpError(404, 'not_found');
  if (!orderId || orderId !== b.paypal_order_id) throw new HttpError(400, 'order_mismatch');
  if (b.status === 'confirmed') return b;
  if (b.status !== 'pending') throw new HttpError(410, 'hold_expired');

  let order;
  try {
    order = await paypal.captureOrder(orderId);
  } catch (e) {
    if (e.issue === 'ORDER_ALREADY_CAPTURED') order = await paypal.getOrder(orderId);
    else if (e.issue === 'INSTRUMENT_DECLINED' || e.issue === 'PAYER_ACTION_REQUIRED') throw new HttpError(422, 'INSTRUMENT_DECLINED');
    else {
      console.error('[paypal] capture failed', b.code, e.message);
      throw new HttpError(502, 'payment_failed');
    }
  }
  const cap = paypal.captureInfo(order);
  if (!cap || !['COMPLETED', 'PENDING'].includes(cap.status)) throw new HttpError(402, 'payment_failed');

  const r = await finalizePaid(b.id, {
    method: 'paypal',
    amount: cap.amount,
    currency: cap.currency,
    status: cap.status === 'COMPLETED' ? 'completed' : 'pending',
    paypal_order_id: orderId,
    paypal_capture_id: cap.id,
    payer_email: cap.payerEmail,
  });
  if (!r.already) await afterConfirmed(b.id, r.paymentId, { issueReceipt: cap.status === 'COMPLETED' });
  return getByToken(token);
}

async function demoPay(token) {
  if (!demoMode() || paypal.configured()) throw new HttpError(403, 'demo_disabled');
  const b = await getByToken(token);
  if (!b) throw new HttpError(404, 'not_found');
  if (b.status === 'confirmed') return b;
  if (b.status !== 'pending' || new Date(b.expires_at) < new Date()) throw new HttpError(410, 'hold_expired');
  const r = await finalizePaid(b.id, { method: 'demo', amount: b.total, currency: b.currency, status: 'completed', note: 'Demo payment - no money charged' });
  await afterConfirmed(b.id, r.paymentId, { issueReceipt: true });
  return getByToken(token);
}

// Runs every minute: release unpaid holds, but first make sure PayPal did not take money
async function sweepHolds() {
  await expireStaleHoldsQuick();
  const rows = await db.many(
    `SELECT * FROM bookings WHERE status = 'pending' AND expires_at < now() AND paypal_order_id IS NOT NULL ORDER BY id LIMIT 20`
  );
  for (const b of rows) {
    let paid = false;
    if (paypal.configured()) {
      try {
        let order = await paypal.getOrder(b.paypal_order_id);
        if (order.status === 'APPROVED') {
          try { order = await paypal.captureOrder(b.paypal_order_id); } catch (e) { order = null; }
        }
        const cap = order && order.status === 'COMPLETED' ? paypal.captureInfo(order) : null;
        if (cap && ['COMPLETED', 'PENDING'].includes(cap.status)) {
          const r = await finalizePaid(b.id, {
            method: 'paypal', amount: cap.amount, currency: cap.currency,
            status: cap.status === 'COMPLETED' ? 'completed' : 'pending',
            paypal_order_id: b.paypal_order_id, paypal_capture_id: cap.id, payer_email: cap.payerEmail,
          });
          if (!r.already) await afterConfirmed(b.id, r.paymentId, { issueReceipt: cap.status === 'COMPLETED' });
          paid = true;
        }
      } catch (e) {
        if (!e.status || e.status >= 500) {
          console.error('[sweep] PayPal check failed, will retry', b.code, e.message);
          continue;
        }
      }
    }
    if (!paid) await expireBooking(b.id);
  }
}

async function expireBooking(id) {
  await db.tx(async (c) => {
    const r = await c.query(`UPDATE bookings SET status = 'expired', updated_at = now() WHERE id = $1 AND status = 'pending'`, [id]);
    if (r.rowCount) {
      await c.query('UPDATE booking_units SET active = false WHERE booking_id = $1', [id]);
      await db.audit(id, 'expired', null, c);
    }
  });
}

// ---------------------------------------------------------------- receipts (Morning)

async function issueReceipt(paymentId, { throwOnError = false } = {}) {
  const p = await db.one('SELECT * FROM payments WHERE id = $1', [paymentId]);
  if (!p) throw new HttpError(404, 'not_found');
  if (p.doc_id) return p;
  if (Number(p.amount) <= 0) throw new HttpError(400, 'receipt_negative');
  const s = await getSettings();
  const fail = async (msg) => {
    await db.q('UPDATE payments SET doc_error = $2 WHERE id = $1', [p.id, msg.slice(0, 500)]);
    if (throwOnError) throw new HttpError(400, 'receipt_failed', msg);
    return db.one('SELECT * FROM payments WHERE id = $1', [p.id]);
  };
  if (!Number(s.doc_type)) return fail('הפקת קבלות כבויה בהגדרות');
  if (!morning.configured()) return fail('מורנינג לא מחובר עדיין (חסרים MORNING_CLIENT_ID / MORNING_CLIENT_SECRET)');
  if (p.method === 'demo' && morning.env() === 'production') return fail('תשלום הדגמה – לא מפיקים עליו קבלה אמיתית');

  const b = await db.one('SELECT * FROM bookings WHERE id = $1', [p.booking_id]);
  const lines = await bookingLines(b.id);
  const payload = morning.buildDocument({
    booking: b,
    lines,
    payment: { ...p, method: p.method === 'demo' ? 'paypal' : p.method },
    settings: s,
    link: bookingLink(b),
  });
  try {
    const doc = await morning.createDocument(payload);
    const url = (doc.url && (doc.url[payload.lang] || doc.url.origin || doc.url.he || doc.url.en)) || null;
    await db.q('UPDATE payments SET doc_id = $2, doc_number = $3, doc_url = $4, doc_error = NULL WHERE id = $1', [p.id, doc.id, String(doc.number), url]);
    await db.audit(b.id, 'receipt_issued', { paymentId: p.id, number: doc.number });
    return db.one('SELECT * FROM payments WHERE id = $1', [p.id]);
  } catch (e) {
    await db.audit(b.id, 'receipt_failed', { paymentId: p.id, error: e.message.slice(0, 300) });
    return fail(e.message);
  }
}

// ---------------------------------------------------------------- admin operations

const MANUAL_METHODS = ['cash', 'card', 'transfer', 'bit', 'paypal'];

async function recordPayment(bookingId, { method, amount, note, issueReceipt: wantReceipt }) {
  if (!MANUAL_METHODS.includes(method)) throw new HttpError(400, 'method_invalid');
  const amt = money(amount);
  if (!Number.isFinite(amt) || amt === 0 || Math.abs(amt) > 1000000) throw new HttpError(400, 'amount_invalid');
  const paymentId = await db.tx(async (c) => {
    const b = (await c.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [bookingId])).rows[0];
    if (!b) throw new HttpError(404, 'not_found');
    const r = await c.query(
      `INSERT INTO payments (booking_id, method, amount, currency, status, note) VALUES ($1,$2,$3,$4,'completed',$5) RETURNING id`,
      [bookingId, method, amt, b.currency, str(note, 300) || null]
    );
    await c.query('UPDATE bookings SET paid = paid + $2, updated_at = now() WHERE id = $1', [bookingId, amt]);
    await db.audit(bookingId, 'payment_recorded', { method, amount: amt }, c);
    return r.rows[0].id;
  });
  if (wantReceipt && amt > 0) await issueReceipt(paymentId);
  return db.one('SELECT * FROM payments WHERE id = $1', [paymentId]);
}

async function refundPayment(paymentId, amount) {
  const p = await db.one('SELECT * FROM payments WHERE id = $1', [paymentId]);
  if (!p) throw new HttpError(404, 'not_found');
  if (!['paypal', 'demo'].includes(p.method) || Number(p.amount) <= 0) throw new HttpError(400, 'not_refundable');
  const done = await db.one('SELECT COALESCE(sum(-amount), 0) AS r FROM payments WHERE refund_of = $1', [p.id]);
  const max = money(Number(p.amount) - Number(done.r));
  const amt = amount === undefined || amount === null || amount === '' ? max : money(amount);
  if (!(amt > 0) || amt > max + 0.001) throw new HttpError(400, 'refund_amount');

  let refundId = null;
  let status = 'completed';
  if (p.method === 'paypal') {
    if (!paypal.configured()) throw new HttpError(400, 'payment_unavailable');
    if (!p.paypal_capture_id) throw new HttpError(400, 'not_refundable');
    const r = await paypal.refundCapture(p.paypal_capture_id, amt, p.currency, `refund-${p.id}-${Date.now()}`);
    refundId = r.id;
    status = String(r.status || 'COMPLETED').toLowerCase();
  }
  await db.tx(async (c) => {
    await c.query(
      `INSERT INTO payments (booking_id, method, amount, currency, status, paypal_refund_id, refund_of, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [p.booking_id, p.method, -amt, p.currency, status, refundId, p.id, 'Refund']
    );
    await c.query('UPDATE bookings SET paid = paid - $2, updated_at = now() WHERE id = $1', [p.booking_id, amt]);
    await db.audit(p.booking_id, 'refunded', { paymentId: p.id, amount: amt, refundId }, c);
  });
  return { amount: amt, refundId, status };
}

async function cancelBooking(id, { refund = false, notifyGuest = false, reason = '' } = {}) {
  const b = await db.one('SELECT * FROM bookings WHERE id = $1', [id]);
  if (!b) throw new HttpError(404, 'not_found');
  if (b.status === 'cancelled') return b;
  const refunds = [];
  if (refund) {
    const pays = await db.many(
      `SELECT p.* FROM payments p WHERE p.booking_id = $1 AND p.method IN ('paypal','demo') AND p.amount > 0 ORDER BY p.id`,
      [id]
    );
    for (const p of pays) {
      const done = await db.one('SELECT COALESCE(sum(-amount), 0) AS r FROM payments WHERE refund_of = $1', [p.id]);
      if (Number(p.amount) - Number(done.r) > 0.004) refunds.push(await refundPayment(p.id));
    }
  }
  await db.tx(async (c) => {
    await c.query(`UPDATE bookings SET status = 'cancelled', cancelled_at = now(), updated_at = now() WHERE id = $1`, [id]);
    await c.query('UPDATE booking_units SET active = false WHERE booking_id = $1', [id]);
    await db.audit(id, 'cancelled', { reason: str(reason, 300), refunds }, c);
  });
  const updated = await db.one('SELECT * FROM bookings WHERE id = $1', [id]);
  if (notifyGuest && updated.email && updated.kind === 'guest') {
    const s = await getSettings();
    const lines = await bookingLines(id);
    const m = mailer.guestEmail('cancelled', { booking: updated, lines, settings: s, link: bookingLink(updated) });
    mailer.send({ to: updated.email, ...m, replyTo: s.email }).catch((e) => console.error('[mail]', e.message));
  }
  return { booking: updated, refunds };
}

async function moveUnit(bookingUnitId, unitId) {
  const bu = await db.one('SELECT * FROM booking_units WHERE id = $1', [bookingUnitId]);
  if (!bu) throw new HttpError(404, 'not_found');
  const u = await db.one('SELECT * FROM units WHERE id = $1', [unitId]);
  if (!u) throw new HttpError(404, 'not_found');
  try {
    await db.q('UPDATE booking_units SET unit_id = $2, room_type_id = $3 WHERE id = $1', [bookingUnitId, u.id, u.room_type_id]);
  } catch (e) {
    if (e.code === '23P01') throw new HttpError(409, 'unit_busy');
    throw e;
  }
  await db.audit(bu.booking_id, 'unit_moved', { from: bu.unit_id, to: u.id });
}

async function changeDates(id, checkIn, checkOut, { reprice = true } = {}) {
  const s = await getSettings();
  const nights = checkDates(checkIn, checkOut, s, { admin: true });
  await db.tx(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(4242)');
    const b = (await c.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [id])).rows[0];
    if (!b) throw new HttpError(404, 'not_found');
    if (!['confirmed', 'pending'].includes(b.status)) throw new HttpError(400, 'not_active');
    try {
      await c.query('SAVEPOINT dates');
      await c.query(
        `UPDATE booking_units SET stay = daterange($2::date, $3::date), amount = CASE WHEN $4 THEN nightly * $5 ELSE amount END
          WHERE booking_id = $1`,
        [id, checkIn, checkOut, reprice, nights]
      );
    } catch (e) {
      await c.query('ROLLBACK TO SAVEPOINT dates');
      if (e.code === '23P01') throw new HttpError(409, 'unit_busy');
      throw e;
    }
    await c.query(
      `UPDATE bookings SET check_in = $2, check_out = $3, updated_at = now(),
              total = CASE WHEN $4 AND kind = 'guest' THEN (SELECT COALESCE(sum(amount), 0) FROM booking_units WHERE booking_id = $1) ELSE total END
        WHERE id = $1`,
      [id, checkIn, checkOut, reprice]
    );
    await db.audit(id, 'dates_changed', { from: [b.check_in, b.check_out], to: [checkIn, checkOut], reprice }, c);
  });
}

module.exports = {
  rememberOrigin, origin, langPrefix, bookingLink, adminLink, demoMode, onlinePaymentAvailable,
  listRoomTypes, priceFor, checkDates, availability, bookingLines, getByToken,
  createBooking, startPaypal, capturePaypal, demoPay, finalizePaid, afterConfirmed, sweepHolds, expireBooking,
  issueReceipt, recordPayment, refundPayment, cancelBooking, moveUnit, changeDates, sendConfirmationEmails,
};
