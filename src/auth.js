'use strict';
// Admin session: a signed, HttpOnly cookie. The password comes from the ADMIN_PASSWORD variable.
const crypto = require('crypto');

const COOKIE = 'bh_admin';
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

function secret() {
  return crypto.createHash('sha256')
    .update(`bethel:${process.env.SESSION_SECRET || ''}:${process.env.ADMIN_PASSWORD || ''}`)
    .digest();
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

function makeToken() {
  const exp = String(Date.now() + MAX_AGE_MS);
  return `${exp}.${sign(exp)}`;
}

function verify(token) {
  if (!token || typeof token !== 'string') return false;
  const [value, sig] = token.split('.');
  if (!value || !sig) return false;
  const good = sign(value);
  if (good.length !== sig.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig))) return false;
  return Number(value) > Date.now();
}

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) {
      try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch (_) { /* ignore */ }
    }
  }
  return out;
}

function isAuthed(req) {
  return verify(parseCookies(req)[COOKIE]);
}

function setSession(req, res) {
  const secure = req.secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${makeToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_MS / 1000}${secure}`);
}

function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function checkPassword(pw) {
  const real = process.env.ADMIN_PASSWORD || '';
  if (!real || typeof pw !== 'string') return false;
  const a = crypto.createHash('sha256').update(pw).digest();
  const b = crypto.createHash('sha256').update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res, next) {
  if (isAuthed(req)) return next();
  res.status(401).json({ error: 'unauthorized' });
}

module.exports = { isAuthed, setSession, clearSession, checkPassword, requireAdmin };
