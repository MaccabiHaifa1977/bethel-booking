'use strict';
// Morning (Green Invoice) API – https://developers.morning.co
// Auth: OAuth2 client credentials -> Bearer token (valid 1 hour)
const { withTimeout, todayIL, dmy, nightsBetween, pickLang } = require('./util');

const URLS = {
  production: { token: 'https://api.morning.co/idp/v1/oauth/token', api: 'https://api.greeninvoice.co.il/api/v1' },
  sandbox: { token: 'https://api.sandbox.morning.dev/idp/v1/oauth/token', api: 'https://sandbox.d.greeninvoice.co.il/api/v1' },
};

// Morning payment type codes
const PAYMENT_TYPES = { cash: 1, card: 3, transfer: 4, paypal: 5, bit: 10 };

function env() {
  return process.env.MORNING_ENV === 'production' ? 'production' : 'sandbox';
}
function configured() {
  return Boolean(process.env.MORNING_CLIENT_ID && process.env.MORNING_CLIENT_SECRET);
}

function morningError(status, data, op) {
  const msg = (data && (data.errorMessage || data.error_description || data.message || data.error)) || 'unknown error';
  const code = data && (data.errorCode || data.error);
  const err = new Error(`Morning ${op} failed (${status})${code ? ' [' + code + ']' : ''}: ${msg}`);
  err.status = status;
  err.data = data;
  return err;
}

let cachedToken = null;
async function token() {
  if (cachedToken && cachedToken.exp > Date.now() + 60000) return cachedToken.value;
  const res = await withTimeout(fetch(URLS[env()].token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: process.env.MORNING_CLIENT_ID,
      client_secret: process.env.MORNING_CLIENT_SECRET,
    }),
  }), 15000, 'Morning token');
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.accessToken) throw morningError(res.status, data, 'token');
  cachedToken = { value: data.accessToken, exp: (Number(data.expiresAt) || 0) * 1000 || Date.now() + 3000000 };
  return cachedToken.value;
}

async function api(method, path, body) {
  const t = await token();
  const res = await withTimeout(fetch(URLS[env()].api + path, {
    method,
    headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), 25000, 'Morning ' + path);
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }
  if (!res.ok) throw morningError(res.status, data, `${method} ${path}`);
  return data;
}

async function createDocument(payload) {
  return api('POST', '/documents', payload);
}

const TXT = {
  he: {
    desc: (code, a, b) => `לינה באכסניה · הזמנה ${code} · ${a}–${b}`,
    nights: (n) => (n === 1 ? 'לילה אחד' : `${n} לילות`),
    guests: (n) => (n === 1 ? 'אורח אחד' : `${n} אורחים`),
    beds: (n) => (n === 1 ? 'מיטה אחת' : `${n} מיטות`),
    rooms: (n) => (n === 1 ? 'חדר אחד' : `${n} חדרים`),
    payment: (code) => `תשלום עבור הזמנה ${code}`,
    remarks: (code) => `מספר הזמנה: ${code}`,
  },
  en: {
    desc: (code, a, b) => `Accommodation · Booking ${code} · ${a}–${b}`,
    nights: (n) => (n === 1 ? '1 night' : `${n} nights`),
    guests: (n) => (n === 1 ? '1 guest' : `${n} guests`),
    beds: (n) => (n === 1 ? '1 bed' : `${n} beds`),
    rooms: (n) => (n === 1 ? '1 room' : `${n} rooms`),
    payment: (code) => `Payment for booking ${code}`,
    remarks: (code) => `Booking number: ${code}`,
  },
};

const EMAIL_TXT = {
  en: (o) => `Thank you for booking with ${o.site}!\nBooking: ${o.code}\nCheck-in: ${o.in} from ${o.inTime}\nCheck-out: ${o.out} until ${o.outTime}\nAddress: ${o.address}\nYour booking: ${o.link}`,
  he: (o) => `תודה שהזמנתם ב${o.site}!\nמספר הזמנה: ${o.code}\nצ׳ק-אין: ${o.in} מהשעה ${o.inTime}\nצ׳ק-אאוט: ${o.out} עד השעה ${o.outTime}\nכתובת: ${o.address}\nההזמנה שלכם: ${o.link}`,
  de: (o) => `Vielen Dank für Ihre Buchung im ${o.site}!\nBuchung: ${o.code}\nCheck-in: ${o.in} ab ${o.inTime} Uhr\nCheck-out: ${o.out} bis ${o.outTime} Uhr\nAdresse: ${o.address}\nIhre Buchung: ${o.link}`,
};

/**
 * Build the Morning document payload for one payment of a booking.
 * lines: [{ typeName: {en,he,de}, soldAs, guests, nightly }]
 */
function buildDocument({ booking, lines, payment, settings, link }) {
  const docType = Number(settings.doc_type) || 400;
  const docLang = booking.lang === 'he' ? 'he' : 'en';
  const T = TXT[docLang];
  const nights = nightsBetween(booking.check_in, booking.check_out);
  const currency = payment.currency || booking.currency || 'ILS';
  const itemVat = docType === 320 ? 1 : 0; // 320: our prices already include VAT; 400: non-profit default (no VAT)
  const amount = Math.round(Number(payment.amount) * 100) / 100;

  let income;
  if (Math.abs(amount - Number(booking.total)) < 0.005 && lines.length) {
    // Itemised: group identical lines (e.g. 3 beds in the same dormitory)
    const groups = new Map();
    for (const l of lines) {
      const key = `${pickLang(l.typeName, docLang)}|${l.soldAs}|${l.guests}|${l.nightly}`;
      const g = groups.get(key) || { ...l, count: 0 };
      g.count += 1;
      groups.set(key, g);
    }
    income = [...groups.values()].map((g) => {
      const what = g.soldAs === 'bed' ? T.beds(g.count) : `${T.rooms(g.count)}, ${T.guests(g.guests)}`;
      return {
        description: `${pickLang(g.typeName, docLang)} (${what}) · ${T.nights(nights)}`,
        quantity: nights * g.count,
        price: Number(g.nightly),
        currency,
        vatType: itemVat,
      };
    });
  } else {
    income = [{ description: T.payment(booking.code), quantity: 1, price: amount, currency, vatType: itemVat }];
  }

  const payRow = {
    date: todayIL(),
    type: PAYMENT_TYPES[payment.method] || PAYMENT_TYPES.cash,
    price: amount,
    currency,
  };
  if (payment.method === 'paypal') {
    if (payment.payer_email) payRow.accountId = payment.payer_email;
    if (payment.paypal_capture_id) payRow.transactionId = payment.paypal_capture_id;
  }
  if (payment.method === 'bit') payRow.appType = 1;

  const emailLang = EMAIL_TXT[booking.lang] ? booking.lang : 'en';
  const emailContent = EMAIL_TXT[emailLang]({
    site: pickLang(settings.site_name, emailLang),
    code: booking.code,
    in: dmy(booking.check_in),
    out: dmy(booking.check_out),
    inTime: settings.checkin_time,
    outTime: settings.checkout_time,
    address: pickLang(settings.address, emailLang),
    link,
  });

  const client = { name: booking.guest_name || 'Guest', add: false };
  if (booking.email) client.emails = [booking.email];
  if (booking.phone) client.phone = booking.phone;
  if (booking.country && /^[A-Z]{2}$/.test(booking.country)) client.country = booking.country;

  return {
    type: docType,
    lang: docLang,
    currency,
    vatType: 0,
    date: todayIL(),
    description: T.desc(booking.code, dmy(booking.check_in), dmy(booking.check_out)),
    remarks: T.remarks(booking.code),
    emailContent,
    attachment: true,
    signed: true,
    rounding: false,
    client,
    income,
    payment: [payRow],
  };
}

async function test() {
  cachedToken = null;
  await token();
  return { ok: true, env: env() };
}

module.exports = { env, configured, createDocument, buildDocument, test, PAYMENT_TYPES };
