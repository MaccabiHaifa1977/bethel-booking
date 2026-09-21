'use strict';
const crypto = require('crypto');

const TZ = 'Asia/Jerusalem';
const LANGS = ['en', 'he', 'de'];

class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// JSON safe to embed inside <script type="application/json">
function jsonForScript(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function todayIL() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function isDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

function addDays(s, n) {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function nightsBetween(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

// "2026-10-12" -> "12/10/2026"
function dmy(s) {
  if (!s) return '';
  const [y, m, d] = String(s).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars, no 0/O/1/I
function randomCode(len = 6) {
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (const b of bytes) s += CODE_ALPHABET[b % 32];
  return s;
}

function randomToken() {
  return crypto.randomBytes(18).toString('base64url');
}

function money(n) {
  return Math.round(Number(n) * 100) / 100;
}

function isEmail(s) {
  return typeof s === 'string' && s.length <= 200 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(s);
}

function str(v, max = 500) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function int(v, def = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

function pickLang(obj, lang) {
  if (!obj || typeof obj !== 'object') return typeof obj === 'string' ? obj : '';
  return obj[lang] || obj.en || obj.he || obj.de || '';
}

// Simple in-memory rate limiter: allow `max` hits per `windowMs` per key
const buckets = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset < now) {
    b = { count: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  }
  return b.count <= max;
}

function withTimeout(promise, ms, label) {
  let t;
  return Promise.race([
    promise.finally(() => clearTimeout(t)),
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`${label || 'operation'} timed out after ${ms}ms`)), ms); }),
  ]);
}

module.exports = {
  TZ, LANGS, HttpError, esc, jsonForScript, todayIL, isDate, addDays, nightsBetween, dmy,
  randomCode, randomToken, money, isEmail, str, int, pickLang, rateLimit, withTimeout,
};
