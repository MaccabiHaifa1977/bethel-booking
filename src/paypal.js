'use strict';
// PayPal REST API (Orders v2) – https://developer.paypal.com/docs/api/orders/v2/
const { withTimeout } = require('./util');

function env() {
  return process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox';
}
function base() {
  return env() === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}
function configured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}
function clientId() {
  return process.env.PAYPAL_CLIENT_ID || '';
}

function paypalError(status, data, op) {
  const d = data && Array.isArray(data.details) ? data.details[0] : null;
  const issue = (d && d.issue) || (data && (data.name || data.error)) || 'PAYPAL_ERROR';
  const detail = (d && d.description) || (data && (data.message || data.error_description)) || '';
  const err = new Error(`PayPal ${op} failed (${status}): ${issue} ${detail}`.trim());
  err.status = status;
  err.issue = issue;
  err.data = data;
  return err;
}

let cachedToken = null;
async function token() {
  if (cachedToken && cachedToken.exp > Date.now() + 60000) return cachedToken.value;
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await withTimeout(fetch(base() + '/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  }), 15000, 'PayPal token');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw paypalError(res.status, data, 'token');
  cachedToken = { value: data.access_token, exp: Date.now() + (data.expires_in || 3000) * 1000 };
  return cachedToken.value;
}

async function api(method, path, body, headers = {}) {
  const t = await token();
  const res = await withTimeout(fetch(base() + path, {
    method,
    headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), 25000, 'PayPal ' + path);
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }
  if (!res.ok) throw paypalError(res.status, data, `${method} ${path}`);
  return data;
}

async function createOrder({ amount, currency, referenceId, customId, invoiceId, description, brandName, locale }) {
  return api('POST', '/v2/checkout/orders', {
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: referenceId,
      custom_id: String(customId),
      invoice_id: invoiceId,
      description: String(description).slice(0, 127),
      amount: { currency_code: currency, value: Number(amount).toFixed(2) },
    }],
    application_context: {
      brand_name: String(brandName).slice(0, 127),
      locale,
      shipping_preference: 'NO_SHIPPING',
      user_action: 'PAY_NOW',
    },
  }, { 'PayPal-Request-Id': 'order-' + invoiceId });
}

async function captureOrder(orderId) {
  return api('POST', `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {}, { 'PayPal-Request-Id': 'capture-' + orderId });
}

async function getOrder(orderId) {
  return api('GET', `/v2/checkout/orders/${encodeURIComponent(orderId)}`);
}

async function refundCapture(captureId, amount, currency, requestId, note) {
  const body = { amount: { value: Number(amount).toFixed(2), currency_code: currency } };
  if (note) body.note_to_payer = String(note).slice(0, 255);
  return api('POST', `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, body, { 'PayPal-Request-Id': requestId });
}

// Pull the capture out of a captured order
function captureInfo(order) {
  const pu = order && order.purchase_units && order.purchase_units[0];
  const cap = pu && pu.payments && pu.payments.captures && pu.payments.captures[0];
  if (!cap) return null;
  const payer = order.payer || {};
  return {
    id: cap.id,
    status: cap.status,
    amount: Number(cap.amount && cap.amount.value),
    currency: cap.amount && cap.amount.currency_code,
    payerEmail: payer.email_address || null,
    payerName: [payer.name && payer.name.given_name, payer.name && payer.name.surname].filter(Boolean).join(' '),
  };
}

async function test() {
  cachedToken = null;
  await token();
  return { ok: true, env: env() };
}

module.exports = { env, configured, clientId, createOrder, captureOrder, getOrder, refundCapture, captureInfo, test };
