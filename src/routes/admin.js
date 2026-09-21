'use strict';
const express = require('express');
const db = require('../db');
const auth = require('../auth');
const booking = require('../booking');
const paypal = require('../paypal');
const morning = require('../morning');
const mailer = require('../mailer');
const { getSettings, saveSettings } = require('../settings');
const { HttpError, todayIL, addDays, isDate, str, int, money, rateLimit, withTimeout } = require('../util');

const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Image upload takes raw bytes; everything else is JSON
router.post('/images', auth.requireAdmin, express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '8mb' }), async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw new HttpError(400, 'image_invalid');
  const mime = req.headers['content-type'].split(';')[0];
  const r = await db.one('INSERT INTO images (mime, data) VALUES ($1, $2) RETURNING id', [mime, req.body]);
  res.json({ url: '/img/' + r.id });
});

router.use(express.json({ limit: '1mb' }));

// Basic CSRF protection: state-changing admin requests must be JSON (browsers cannot send that cross-site without CORS)
router.use((req, res, next) => {
  if (req.method !== 'GET' && !req.is('application/json')) return res.status(415).json({ error: 'json_required' });
  next();
});

router.post('/login', (req, res) => {
  if (!rateLimit('login:' + req.ip, 10, 15 * 60 * 1000)) throw new HttpError(429, 'rate_limited');
  if (!process.env.ADMIN_PASSWORD) throw new HttpError(503, 'admin_password_missing');
  if (!auth.checkPassword(req.body && req.body.password)) throw new HttpError(401, 'wrong_password');
  auth.setSession(req, res);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  auth.clearSession(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => res.json({ authed: auth.isAuthed(req) }));

router.use(auth.requireAdmin);

// ---------------------------------------------------------------- dashboard

router.get('/overview', async (req, res) => {
  const today = todayIL();
  const in30 = addDays(today, 30);
  const [arrivals, departures, inhouse, pending, unpaid, receiptIssues, recent, occ, unitsRow, days] = await Promise.all([
    db.many(`SELECT id, code, guest_name, guests_count, check_in, check_out, total, paid, phone FROM bookings
              WHERE kind = 'guest' AND status = 'confirmed' AND check_in = $1 ORDER BY id`, [today]),
    db.many(`SELECT id, code, guest_name, guests_count, check_in, check_out, total, paid FROM bookings
              WHERE kind = 'guest' AND status = 'confirmed' AND check_out = $1 ORDER BY id`, [today]),
    db.one(`SELECT COALESCE(sum(guests_count), 0)::int AS guests, count(*)::int AS bookings FROM bookings
             WHERE kind = 'guest' AND status = 'confirmed' AND check_in <= $1 AND check_out > $1`, [today]),
    db.many(`SELECT id, code, guest_name, check_in, check_out, total, expires_at FROM bookings WHERE status = 'pending' ORDER BY id DESC LIMIT 20`),
    db.many(`SELECT id, code, guest_name, check_in, check_out, total, paid FROM bookings
              WHERE kind = 'guest' AND status = 'confirmed' AND paid < total AND check_out >= $1 ORDER BY check_in LIMIT 30`, [today]),
    db.many(`SELECT p.id, p.booking_id, p.amount, p.doc_error, b.code, b.guest_name FROM payments p JOIN bookings b ON b.id = p.booking_id
              WHERE p.amount > 0 AND p.doc_id IS NULL AND p.doc_error IS NOT NULL AND p.method <> 'demo' ORDER BY p.id DESC LIMIT 20`),
    db.many(`SELECT id, code, guest_name, check_in, check_out, total, paid, status, source, created_at FROM bookings
              WHERE kind = 'guest' AND status <> 'expired' ORDER BY id DESC LIMIT 10`),
    db.one(`SELECT COALESCE(sum(upper(r) - lower(r)), 0)::int AS nights FROM (
              SELECT bu.stay * daterange($1::date, $2::date) AS r FROM booking_units bu JOIN bookings b ON b.id = bu.booking_id
               WHERE bu.active AND b.kind = 'guest' AND bu.stay && daterange($1::date, $2::date)) x`, [today, in30]),
    db.one(`SELECT count(*)::int AS n FROM units u JOIN room_types t ON t.id = u.room_type_id WHERE u.active AND t.active`),
    db.many(`SELECT d::date AS day, count(x.id)::int AS units, COALESCE(sum(x.guests), 0)::int AS guests
               FROM generate_series($1::date, $1::date + 13, interval '1 day') d
               LEFT JOIN (SELECT bu.id, bu.guests, bu.stay FROM booking_units bu JOIN bookings b ON b.id = bu.booking_id
                           WHERE bu.active AND b.kind = 'guest') x ON x.stay @> d::date
              GROUP BY d ORDER BY d`, [today]),
  ]);
  res.json({
    today, arrivals, departures, inhouse, pending, unpaid, receiptIssues, recent, days,
    totalUnits: unitsRow.n,
    occupancy30: unitsRow.n ? Math.round((occ.nights / (unitsRow.n * 30)) * 100) : 0,
    integrations: integrationStatus(),
  });
});

function integrationStatus() {
  return {
    paypal: { configured: paypal.configured(), env: paypal.env() },
    morning: { configured: morning.configured(), env: morning.env() },
    mail: { configured: mailer.configured(), from: process.env.MAIL_FROM || '' },
    demo: booking.demoMode(),
    publicUrl: booking.origin(),
  };
}

// ---------------------------------------------------------------- calendar

router.get('/calendar', async (req, res) => {
  const from = isDate(req.query.from) ? req.query.from : todayIL();
  const days = Math.min(62, Math.max(7, int(req.query.days, 21)));
  const to = addDays(from, days);
  const [types, units, items] = await Promise.all([
    booking.listRoomTypes({ activeOnly: false }),
    db.many('SELECT id, room_type_id, name, active, sort FROM units ORDER BY sort, id'),
    db.many(`SELECT bu.id AS bu_id, bu.unit_id, bu.guests, lower(bu.stay) AS start, upper(bu.stay) AS "end",
                    b.id, b.code, b.kind, b.status, b.guest_name, b.total, b.paid, b.guests_count
               FROM booking_units bu JOIN bookings b ON b.id = bu.booking_id
              WHERE bu.active AND bu.stay && daterange($1::date, $2::date)
              ORDER BY lower(bu.stay)`, [from, to]),
  ]);
  res.json({
    from, days,
    types: types.map((t) => ({
      id: t.id, name: t.name, active: t.active, soldAs: t.sold_as,
      units: units.filter((u) => u.room_type_id === t.id).map((u) => ({ id: u.id, name: u.name, active: u.active })),
    })),
    items,
  });
});

// ---------------------------------------------------------------- bookings

router.get('/bookings', async (req, res) => {
  const where = [];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replace('?', '$' + params.length)); };
  const status = String(req.query.status || '');
  if (['pending', 'confirmed', 'cancelled', 'expired'].includes(status)) add('b.status = ?', status);
  else where.push(`b.status <> 'expired'`);
  const kind = String(req.query.kind || 'guest');
  if (kind === 'guest' || kind === 'block') add('b.kind = ?', kind);
  const q = str(req.query.q, 100);
  if (q) {
    params.push('%' + q.replace(/[%_\\]/g, (m) => '\\' + m) + '%');
    const n = '$' + params.length;
    where.push(`(b.code ILIKE ${n} OR b.guest_name ILIKE ${n} OR b.email ILIKE ${n} OR b.phone ILIKE ${n})`);
  }
  const scope = String(req.query.scope || 'upcoming');
  const today = todayIL();
  if (scope === 'upcoming') add('b.check_out >= ?', today);
  if (scope === 'past') add('b.check_out < ?', today);
  if (isDate(req.query.from)) add('b.check_out > ?', req.query.from);
  if (isDate(req.query.to)) add('b.check_in < ?', req.query.to);
  const order = scope === 'upcoming' ? 'b.check_in ASC, b.id ASC' : 'b.id DESC';
  const rows = await db.many(
    `SELECT b.id, b.code, b.kind, b.source, b.status, b.check_in, b.check_out, b.guest_name, b.email, b.phone, b.guests_count,
            b.total, b.paid, b.pay_method, b.created_at,
            (SELECT string_agg(u.name, ', ' ORDER BY u.sort, u.id) FROM booking_units bu JOIN units u ON u.id = bu.unit_id WHERE bu.booking_id = b.id) AS units,
            EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = b.id AND p.doc_error IS NOT NULL AND p.doc_id IS NULL AND p.amount > 0 AND p.method <> 'demo') AS receipt_issue
       FROM bookings b
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY ${order}
      LIMIT 300`,
    params
  );
  res.json({ bookings: rows });
});

async function bookingDetail(id) {
  const b = await db.one('SELECT * FROM bookings WHERE id = $1', [id]);
  if (!b) throw new HttpError(404, 'not_found');
  const [lines, payments, audit] = await Promise.all([
    booking.bookingLines(id),
    db.many('SELECT * FROM payments WHERE booking_id = $1 ORDER BY id', [id]),
    db.many('SELECT id, action, detail, created_at FROM audit_log WHERE booking_id = $1 ORDER BY id DESC LIMIT 100', [id]),
  ]);
  for (const p of payments) {
    p.refunded = payments.filter((r) => r.refund_of === p.id).reduce((a, r) => a - Number(r.amount), 0);
  }
  return { booking: { ...b, link: booking.bookingLink(b) }, lines, payments, audit, integrations: integrationStatus() };
}

router.get('/bookings/:id', async (req, res) => {
  res.json(await bookingDetail(int(req.params.id)));
});

// Units that are free for given dates (optionally ignoring one booking's own units)
router.get('/free-units', async (req, res) => {
  const { checkIn, checkOut } = req.query;
  if (!isDate(checkIn) || !isDate(checkOut) || checkOut <= checkIn) throw new HttpError(400, 'dates_invalid');
  const exclude = int(req.query.exclude, 0);
  const rows = await db.many(
    `SELECT u.id, u.name, u.room_type_id FROM units u
      WHERE u.active AND NOT EXISTS (
            SELECT 1 FROM booking_units bu WHERE bu.unit_id = u.id AND bu.active AND bu.booking_id <> $3
               AND bu.stay && daterange($1::date, $2::date))
      ORDER BY u.room_type_id, u.sort, u.id`,
    [checkIn, checkOut, exclude]
  );
  res.json({ units: rows });
});

router.post('/bookings', async (req, res) => {
  const body = req.body || {};
  const kind = body.kind === 'block' ? 'block' : 'guest';
  const b = await booking.createBooking(
    {
      lang: body.lang,
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      lines: body.lines,
      contact: body.contact,
      travelers: body.travelers,
      notes: body.notes,
      blockReason: body.blockReason,
    },
    { source: 'admin', kind, totalOverride: body.total, adminNotes: body.adminNotes, blockReason: body.blockReason }
  );
  if (kind === 'guest' && body.sendEmail && b.email) {
    booking.sendConfirmationEmails(b.id, { admin: false }).catch((e) => console.error('[mail]', e.message));
  }
  res.json({ id: b.id });
});

router.patch('/bookings/:id', async (req, res) => {
  const id = int(req.params.id);
  const body = req.body || {};
  const sets = [];
  const params = [id];
  const set = (col, v) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if ('guest_name' in body) set('guest_name', str(body.guest_name, 100));
  if ('email' in body) set('email', str(body.email, 200).toLowerCase() || null);
  if ('phone' in body) set('phone', str(body.phone, 40) || null);
  if ('country' in body) set('country', /^[A-Z]{2}$/.test(body.country || '') ? body.country : null);
  if ('notes' in body) set('notes', str(body.notes, 2000) || null);
  if ('admin_notes' in body) set('admin_notes', str(body.admin_notes, 4000) || null);
  if ('lang' in body && ['en', 'he', 'de'].includes(body.lang)) set('lang', body.lang);
  if ('travelers' in body && Array.isArray(body.travelers)) {
    const tr = body.travelers.slice(0, 60).map((t) => ({ name: str(t && t.name, 100), gender: t && t.gender === 'female' ? 'female' : 'male' })).filter((t) => t.name);
    set('travelers', JSON.stringify(tr));
  }
  if ('total' in body) {
    const t = Number(body.total);
    if (!Number.isFinite(t) || t < 0 || t > 1000000) throw new HttpError(400, 'total_invalid');
    set('total', money(t));
  }
  if (!sets.length) return res.json(await bookingDetail(id));
  const r = await db.q(`UPDATE bookings SET ${sets.join(', ')}, updated_at = now() WHERE id = $1`, params);
  if (!r.rowCount) throw new HttpError(404, 'not_found');
  await db.audit(id, 'edited', { fields: Object.keys(body) });
  res.json(await bookingDetail(id));
});

router.post('/bookings/:id/dates', async (req, res) => {
  const id = int(req.params.id);
  await booking.changeDates(id, req.body.checkIn, req.body.checkOut, { reprice: req.body.reprice !== false });
  res.json(await bookingDetail(id));
});

router.post('/bookings/:id/cancel', async (req, res) => {
  const id = int(req.params.id);
  await booking.cancelBooking(id, { refund: Boolean(req.body.refund), notifyGuest: Boolean(req.body.notifyGuest), reason: req.body.reason });
  res.json(await bookingDetail(id));
});

router.post('/bookings/:id/payments', async (req, res) => {
  const id = int(req.params.id);
  await booking.recordPayment(id, {
    method: req.body.method,
    amount: req.body.amount,
    note: req.body.note,
    issueReceipt: Boolean(req.body.issueReceipt),
  });
  res.json(await bookingDetail(id));
});

router.post('/bookings/:id/resend', async (req, res) => {
  const id = int(req.params.id);
  await booking.sendConfirmationEmails(id, { admin: false });
  await db.audit(id, 'email_resent');
  res.json({ ok: true, mailConfigured: mailer.configured() });
});

router.post('/booking-units/:id/move', async (req, res) => {
  const bu = await db.one('SELECT booking_id FROM booking_units WHERE id = $1', [int(req.params.id)]);
  if (!bu) throw new HttpError(404, 'not_found');
  await booking.moveUnit(int(req.params.id), int(req.body.unitId));
  res.json(await bookingDetail(bu.booking_id));
});

router.post('/payments/:id/receipt', async (req, res) => {
  const p = await booking.issueReceipt(int(req.params.id), { throwOnError: true });
  res.json(await bookingDetail(p.booking_id));
});

router.post('/payments/:id/refund', async (req, res) => {
  const p = await db.one('SELECT booking_id FROM payments WHERE id = $1', [int(req.params.id)]);
  if (!p) throw new HttpError(404, 'not_found');
  await booking.refundPayment(int(req.params.id), req.body.amount);
  res.json(await bookingDetail(p.booking_id));
});

// ---------------------------------------------------------------- rooms

function langObj(v, max) {
  return { en: str(v && v.en, max), he: str(v && v.he, max), de: str(v && v.de, max) };
}

function cleanType(b) {
  const soldAs = b.sold_as === 'bed' ? 'bed' : 'room';
  const capacity = soldAs === 'bed' ? 1 : Math.min(30, Math.max(1, int(b.capacity, 2)));
  const prices = (Array.isArray(b.prices) ? b.prices : [])
    .slice(0, capacity)
    .map((n) => money(n))
    .filter((n) => Number.isFinite(n) && n >= 0);
  if (!prices.length || prices.some((p) => p <= 0)) throw new HttpError(400, 'prices_required');
  const name = langObj(b.name, 120);
  if (!name.he && !name.en && !name.de) throw new HttpError(400, 'name_required');
  const photos = (Array.isArray(b.photos) ? b.photos : [])
    .filter((p) => typeof p === 'string' && p.length < 500 && (/^https:\/\//.test(p) || /^\/img\/\d+$/.test(p)))
    .slice(0, 30);
  return {
    name,
    description: langObj(b.description, 2000),
    note: langObj(b.note, 500),
    sold_as: soldAs,
    capacity,
    prices,
    gender: ['male', 'female'].includes(b.gender) ? b.gender : 'any',
    photos,
    sort: int(b.sort, 0),
    active: b.active !== false,
  };
}

async function roomTypesWithUnits() {
  const types = await booking.listRoomTypes({ activeOnly: false });
  const units = await db.many(
    `SELECT u.*, EXISTS (SELECT 1 FROM booking_units bu WHERE bu.unit_id = u.id) AS used FROM units u ORDER BY u.sort, u.id`
  );
  return types.map((t) => ({ ...t, units: units.filter((u) => u.room_type_id === t.id) }));
}

router.get('/room-types', async (req, res) => res.json({ types: await roomTypesWithUnits() }));

router.post('/room-types', async (req, res) => {
  const t = cleanType(req.body || {});
  const r = await db.one(
    `INSERT INTO room_types (name, description, note, sold_as, capacity, prices, gender, photos, sort, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [t.name, t.description, t.note, t.sold_as, t.capacity, JSON.stringify(t.prices), t.gender, JSON.stringify(t.photos), t.sort, t.active]
  );
  res.json({ id: r.id, types: await roomTypesWithUnits() });
});

router.put('/room-types/:id', async (req, res) => {
  const t = cleanType(req.body || {});
  const r = await db.q(
    `UPDATE room_types SET name = $2, description = $3, note = $4, sold_as = $5, capacity = $6, prices = $7, gender = $8,
            photos = $9, sort = $10, active = $11 WHERE id = $1`,
    [int(req.params.id), t.name, t.description, t.note, t.sold_as, t.capacity, JSON.stringify(t.prices), t.gender, JSON.stringify(t.photos), t.sort, t.active]
  );
  if (!r.rowCount) throw new HttpError(404, 'not_found');
  res.json({ types: await roomTypesWithUnits() });
});

router.delete('/room-types/:id', async (req, res) => {
  const id = int(req.params.id);
  const used = await db.one('SELECT 1 AS x FROM booking_units WHERE room_type_id = $1 LIMIT 1', [id]);
  if (used) throw new HttpError(409, 'type_in_use');
  await db.q('DELETE FROM room_types WHERE id = $1', [id]);
  res.json({ types: await roomTypesWithUnits() });
});

router.post('/units', async (req, res) => {
  const typeId = int(req.body.typeId);
  const name = str(req.body.name, 80);
  if (!name) throw new HttpError(400, 'name_required');
  const type = await db.one('SELECT id FROM room_types WHERE id = $1', [typeId]);
  if (!type) throw new HttpError(404, 'not_found');
  const max = await db.one('SELECT COALESCE(max(sort), 0) AS m FROM units WHERE room_type_id = $1', [typeId]);
  await db.q('INSERT INTO units (room_type_id, name, sort) VALUES ($1, $2, $3)', [typeId, name, max.m + 1]);
  res.json({ types: await roomTypesWithUnits() });
});

router.put('/units/:id', async (req, res) => {
  const name = str(req.body.name, 80);
  if (!name) throw new HttpError(400, 'name_required');
  await db.q('UPDATE units SET name = $2, active = $3, sort = $4 WHERE id = $1', [int(req.params.id), name, req.body.active !== false, int(req.body.sort, 0)]);
  res.json({ types: await roomTypesWithUnits() });
});

router.delete('/units/:id', async (req, res) => {
  const id = int(req.params.id);
  const used = await db.one('SELECT 1 AS x FROM booking_units WHERE unit_id = $1 LIMIT 1', [id]);
  if (used) throw new HttpError(409, 'unit_in_use');
  await db.q('DELETE FROM units WHERE id = $1', [id]);
  res.json({ types: await roomTypesWithUnits() });
});

// ---------------------------------------------------------------- settings & integrations

router.get('/settings', async (req, res) => res.json({ settings: await getSettings() }));

router.put('/settings', async (req, res) => {
  res.json({ settings: await saveSettings(req.body || {}) });
});

router.get('/integrations', (req, res) => res.json(integrationStatus()));

router.post('/integrations/test', async (req, res) => {
  const which = req.body.which;
  try {
    if (which === 'paypal') {
      if (!paypal.configured()) throw new Error('PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET חסרים');
      await paypal.test();
    } else if (which === 'morning') {
      if (!morning.configured()) throw new Error('MORNING_CLIENT_ID / MORNING_CLIENT_SECRET חסרים');
      await morning.test();
    } else if (which === 'mail') {
      if (!mailer.configured()) throw new Error('RESEND_API_KEY / MAIL_FROM חסרים');
      const s = await getSettings();
      await mailer.send({ to: s.notify_email, subject: 'בדיקת מייל – מערכת ההזמנות', html: '<p dir="rtl">המייל עובד ✔</p>', text: 'Mail works' });
    } else throw new Error('unknown');
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// Copy photos that still live on the old WordPress site into our own database
router.post('/import-photos', async (req, res) => {
  const cache = new Map();
  const errors = [];
  async function localize(src) {
    if (typeof src !== 'string' || !/^https?:\/\//.test(src)) return src;
    if (cache.has(src)) return cache.get(src);
    const existing = await db.one('SELECT id FROM images WHERE source_url = $1', [src]);
    if (existing) { cache.set(src, '/img/' + existing.id); return '/img/' + existing.id; }
    try {
      const r = await withTimeout(fetch(src), 20000, 'download');
      const type = (r.headers.get('content-type') || '').split(';')[0];
      if (!r.ok || !/^image\/(jpeg|png|webp)$/.test(type)) throw new Error(`HTTP ${r.status} ${type}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 12 * 1024 * 1024) throw new Error('too large');
      const row = await db.one('INSERT INTO images (mime, data, source_url) VALUES ($1, $2, $3) RETURNING id', [type, buf, src]);
      cache.set(src, '/img/' + row.id);
      return '/img/' + row.id;
    } catch (e) {
      errors.push(`${src}: ${e.message}`);
      cache.set(src, src);
      return src;
    }
  }
  const types = await db.many('SELECT id, photos FROM room_types');
  for (const t of types) {
    const photos = [];
    for (const p of t.photos || []) photos.push(await localize(p));
    await db.q('UPDATE room_types SET photos = $2 WHERE id = $1', [t.id, JSON.stringify(photos)]);
  }
  const s = await getSettings();
  const gallery = [];
  for (const g of s.gallery || []) gallery.push({ ...g, src: await localize(g.src) });
  const nearby = [];
  for (const g of s.nearby || []) nearby.push({ ...g, src: await localize(g.src) });
  await saveSettings({ gallery, nearby, hero_image: await localize(s.hero_image) });
  res.json({ imported: [...cache.values()].filter((v) => v.startsWith('/img/')).length, errors });
});

module.exports = router;
