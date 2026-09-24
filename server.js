'use strict';
// Force redeploy - healthcheck fix
const path = require('path');
try { process.loadEnvFile(path.join(__dirname, '.env')); } catch (_) { /* no .env file (e.g. on Railway) */ }

const express = require('express');
const db = require('./src/db');
const { seedIfEmpty } = require('./src/seed');
const booking = require('./src/booking');
const publicRoutes = require('./src/routes/public');
const adminRoutes = require('./src/routes/admin');
const { esc } = require('./src/util');

const app = express();
const PORT = Number(process.env.PORT) || 3470;
const VERSION = Date.now().toString(36);

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  booking.rememberOrigin(req);
  next();
});

app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/_version', (req, res) => res.json({ version: '2026-09-24-new', deployed: new Date().toISOString() }));

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d', index: false }));

// Admin panel (single page app)
app.get(['/admin', '/admin/'], (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.set('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  res.send(`<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>ניהול · בית אל</title>
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700&display=swap">
<link rel="stylesheet" href="/css/admin.css?v=${esc(VERSION)}">
</head>
<body>
<div id="app" class="app"><p class="loading">טוען…</p></div>
<script src="/js/admin.js?v=${esc(VERSION)}" defer></script>
</body>
</html>`);
});

app.use('/api/admin', adminRoutes);
app.use(publicRoutes);

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not_found' });
  res.status(404).type('html').send('<!doctype html><meta charset="utf-8"><title>404</title><p style="font-family:sans-serif">Page not found – <a href="/">Bethel Hostel</a></p>');
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = Number(err.status) >= 400 && Number(err.status) < 600 ? Number(err.status) : 500;
  const { HttpError } = require('./src/util');
  let code = err instanceof HttpError ? err.code : null;
  if (err.issue) { status = 502; code = 'payment_failed'; } // raw PayPal error
  if (err.type === 'entity.parse.failed') code = 'bad_json';
  if (status >= 500) console.error('[error]', req.method, req.path, err.stack || err.message);
  if (req.path.startsWith('/api/')) {
    return res.status(status).json({ error: code || (status >= 500 ? 'server_error' : 'error'), message: status < 500 ? err.message : undefined });
  }
  res.status(status).type('text').send(status >= 500 ? 'Server error' : 'Error');
});

async function start() {
  console.log('🚀 APP STARTING - NEW DEPLOYMENT');
  await db.migrate();
  await seedIfEmpty();
  app.listen(PORT, () => {
    console.log(`Bethel booking running on http://localhost:${PORT}`);
    console.log(`  PayPal: ${require('./src/paypal').configured() ? require('./src/paypal').env() : 'not configured'} | Morning: ${require('./src/morning').configured() ? require('./src/morning').env() : 'not configured'} | demo: ${booking.demoMode()}`);
  });
  const sweep = () => booking.sweepHolds().catch((e) => console.error('[sweep]', e.message));
  setTimeout(sweep, 5000);
  setInterval(sweep, 60 * 1000);
}

start().catch((e) => {
  console.error('Failed to start:', e);
  process.exit(1);
});
