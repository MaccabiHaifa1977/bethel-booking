'use strict';
const fs = require('fs');
const path = require('path');
const { Pool, types } = require('pg');

// Keep DATE columns as plain 'YYYY-MM-DD' strings (no timezone shifts)
types.setTypeParser(1082, (v) => v);
// numeric -> JS number, bigint (count) -> JS number
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add it to .env (local) or to the Railway service variables.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => console.error('[db] idle client error', err.message));

async function q(text, params) {
  return pool.query(text, params);
}

async function one(text, params) {
  const r = await pool.query(text, params);
  return r.rows[0] || null;
}

async function many(text, params) {
  const r = await pool.query(text, params);
  return r.rows;
}

async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

async function audit(bookingId, action, detail, client) {
  const runner = client || pool;
  await runner.query('INSERT INTO audit_log (booking_id, action, detail) VALUES ($1, $2, $3)', [bookingId, action, detail ? JSON.stringify(detail) : null]);
}

module.exports = { pool, q, one, many, tx, migrate, audit };
