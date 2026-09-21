'use strict';
const express = require('express');
const db = require('../db');
const { getSettings } = require('../settings');
const booking = require('../booking');
const render = require('../render');
const paypal = require('../paypal');
const morning = require('../morning');
const mailer = require('../mailer');
const { STR } = require('../i18n');
const { HttpError, todayIL, addDays, pickLang, rateLimit, int } = require('../util');

const router = express.Router();
const VERSION = Date.now().toString(36);

async function ctxFor(lang, path) {
  const s = await getSettings();
  return { lang, s, path, origin: booking.origin(), version: VERSION };
}

function publicType(t, lang) {
  return {
    id: t.id,
    name: pickLang(t.name, lang),
    description: pickLang(t.description, lang),
    note: pickLang(t.note, lang),
    soldAs: t.sold_as,
    capacity: t.capacity,
    prices: (t.prices || []).map(Number),
    gender: t.gender,
    photo: (t.photos || [])[0] || null,
  };
}

function bookConfig(s, lang, types, extra = {}) {
  const today = todayIL();
  return {
    lang,
    locale: STR[lang].locale,
    dir: STR[lang].dir,
    currency: s.currency,
    today,
    maxDate: addDays(today, s.booking_window_days),
    windowDays: s.booking_window_days,
    minNights: s.min_nights,
    maxNights: s.max_nights,
    maxGuests: s.max_guests_online,
    paymentMode: s.payment_mode,
    onlineAvailable: booking.onlinePaymentAvailable(),
    paypal: paypal.configured() ? { clientId: paypal.clientId(), locale: { he: 'he_IL', de: 'de_DE', en: 'en_US' }[lang] } : null,
    demo: booking.demoMode() && !paypal.configured(),
    termsUrl: render.url(lang, '/terms'),
    bookingBase: render.url(lang, '/booking/'),
    contact: { phones: s.phones, email: s.email, whatsapp: String(s.whatsapp || '').replace(/\D/g, '') },
    types: types.map((t) => publicType(t, lang)),
    t: STR[lang],
    ...extra,
  };
}

// ---------------------------------------------------------------- old WordPress URLs -> new pages (keeps Google rankings)
const OLD_URLS = {
  '/accommodation': '/rooms',
  '/bethel-hostel-haifa': '/#hostel',
  '/location': '/#location',
  '/reservations': '/book',
  '/gallery': '/#hostel',
  '/de/home-deutsch': '/de',
  '/de/unterkunft': '/de/rooms',
  '/de/die-jugendherberge': '/de#hostel',
  '/de/das-jugendherberge': '/de#hostel',
  '/de/ort': '/de#location',
  '/de/reservierung': '/de/book',
};
router.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const p = req.path.replace(/\/+$/, '');
  if (OLD_URLS[p]) return res.redirect(301, OLD_URLS[p]);
  next();
});

// ---------------------------------------------------------------- pages
for (const lang of render.LANGS) {
  const p = render.prefix(lang);

  router.get(p || '/', async (req, res) => {
    const ctx = await ctxFor(lang, '');
    const types = await booking.listRoomTypes();
    res.send(render.home(ctx, types));
  });

  router.get(p + '/rooms', async (req, res) => {
    const ctx = await ctxFor(lang, '/rooms');
    const types = await booking.listRoomTypes();
    res.send(render.roomsPage(ctx, types));
  });

  router.get(p + '/book', async (req, res) => {
    const ctx = await ctxFor(lang, '/book');
    const types = await booking.listRoomTypes();
    const q = req.query;
    const config = bookConfig(ctx.s, lang, types, {
      initial: {
        checkIn: typeof q.in === 'string' ? q.in : '',
        checkOut: typeof q.out === 'string' ? q.out : '',
        typeId: int(q.type, 0) || null,
      },
    });
    res.send(render.bookPage(ctx, config));
  });

  router.get(p + '/booking/:token', async (req, res) => {
    const b = await booking.getByToken(req.params.token);
    const ctx = await ctxFor(lang, '/booking/' + encodeURIComponent(req.params.token));
    if (!b || b.kind !== 'guest') return res.status(404).send(render.notFound(ctx));
    const lines = await booking.bookingLines(b.id);
    const payments = await db.many('SELECT method, amount, doc_url, doc_number, created_at FROM payments WHERE booking_id = $1 ORDER BY id', [b.id]);
    const config = bookConfig(ctx.s, lang, [], {
      resume: { token: b.token, code: b.code, total: Number(b.total), currency: b.currency, expiresAt: b.expires_at, status: b.status },
    });
    res.set('Cache-Control', 'no-store');
    const notified = mailer.configured() || (morning.configured() && payments.some((x) => x.doc_url));
    res.send(render.bookingPage(ctx, { b, lines, payments, isNew: req.query.new === '1', config, notified }));
  });

  router.get(p + '/terms', async (req, res) => res.send(render.termsPage(await ctxFor(lang, '/terms'))));
  router.get(p + '/privacy', async (req, res) => res.send(render.textPage(await ctxFor(lang, '/privacy'), 'privacy')));
  router.get(p + '/accessibility', async (req, res) => res.send(render.textPage(await ctxFor(lang, '/accessibility'), 'accessibility')));
}

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /booking/\nDisallow: /he/booking/\nDisallow: /de/booking/\nSitemap: ${booking.origin()}/sitemap.xml\n`);
});

router.get('/sitemap.xml', (req, res) => {
  const o = booking.origin();
  const paths = ['', '/rooms', '/book', '/terms', '/privacy', '/accessibility'];
  const urls = paths.map((path) => render.LANGS.map((lang) => `<url><loc>${o}${render.url(lang, path)}</loc>${render.LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${o}${render.url(l, path)}"/>`).join('')}</url>`).join('')).join('');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`);
});

// Uploaded images are stored in the database
router.get('/img/:id', async (req, res, next) => {
  const id = int(req.params.id, 0);
  if (!id || String(id) !== req.params.id) return next();
  const img = await db.one('SELECT mime, data FROM images WHERE id = $1', [id]);
  if (!img) return next();
  res.set('Content-Type', img.mime);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(img.data);
});

// ---------------------------------------------------------------- booking API
const api = express.Router();
api.use(express.json({ limit: '100kb' }));
api.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

api.get('/availability', async (req, res) => {
  if (!rateLimit('avail:' + req.ip, 120, 10 * 60 * 1000)) throw new HttpError(429, 'rate_limited');
  const s = await getSettings();
  const { checkIn, checkOut } = req.query;
  const nights = booking.checkDates(checkIn, checkOut, s);
  const available = await booking.availability(checkIn, checkOut);
  res.json({ nights, available });
});

api.post('/bookings', async (req, res) => {
  if (!rateLimit('book:' + req.ip, 20, 60 * 60 * 1000)) throw new HttpError(429, 'rate_limited');
  const b = await booking.createBooking(req.body || {}, { source: 'web' });
  res.json({
    token: b.token,
    code: b.code,
    status: b.status,
    total: Number(b.total),
    currency: b.currency,
    expiresAt: b.expires_at,
    redirect: `${render.url(b.lang, '/booking/')}${b.token}?new=1`,
  });
});

api.get('/bookings/:token', async (req, res) => {
  const b = await booking.getByToken(req.params.token);
  if (!b) throw new HttpError(404, 'not_found');
  res.json({ code: b.code, status: b.status, total: Number(b.total), currency: b.currency, expiresAt: b.expires_at });
});

api.post('/bookings/:token/paypal-order', async (req, res) => {
  if (!rateLimit('ppo:' + req.ip, 40, 60 * 60 * 1000)) throw new HttpError(429, 'rate_limited');
  res.json(await booking.startPaypal(req.params.token));
});

api.post('/bookings/:token/paypal-capture', async (req, res) => {
  const b = await booking.capturePaypal(req.params.token, req.body && req.body.orderId);
  res.json({ ok: true, status: b.status, redirect: `${render.url(b.lang, '/booking/')}${b.token}?new=1` });
});

api.post('/bookings/:token/demo-pay', async (req, res) => {
  const b = await booking.demoPay(req.params.token);
  res.json({ ok: true, status: b.status, redirect: `${render.url(b.lang, '/booking/')}${b.token}?new=1` });
});

router.use('/api/public', api);

module.exports = router;
