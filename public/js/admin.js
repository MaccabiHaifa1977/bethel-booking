/* Bethel Hostel – admin panel (Hebrew). Hash router: #/dashboard, #/calendar, #/bookings, #/booking/ID, #/new, #/rooms, #/settings, #/integrations */
(function () {
  'use strict';

  const app = document.getElementById('app');

  // ---------------------------------------------------------------- texts
  const STATUS = { pending: ['ממתינה לתשלום', 'b-warn'], confirmed: ['מאושרת', 'b-ok'], cancelled: ['בוטלה', 'b-bad'], expired: ['פג תוקף', 'b'] };
  const METHOD = { paypal: 'PayPal', cash: 'מזומן', card: 'כרטיס אשראי', transfer: 'העברה בנקאית', bit: 'ביט', demo: 'הדגמה' };
  const LANGN = { he: 'עברית', en: 'English', de: 'Deutsch' };
  const AUDIT = {
    created: 'ההזמנה נוצרה', paid: 'התקבל תשלום', paypal_order_created: 'האורח פתח תשלום PayPal', receipt_issued: 'הופקה קבלה',
    receipt_failed: 'הפקת הקבלה נכשלה', payment_recorded: 'נרשם תשלום', refunded: 'בוצע החזר כספי', cancelled: 'ההזמנה בוטלה',
    expired: 'השריון פג (לא שולם)', unit_moved: 'הוחלפה יחידה', dates_changed: 'שונו תאריכים', edited: 'הפרטים נערכו', email_resent: 'מייל אישור נשלח שוב',
  };
  const ERR = {
    no_availability: 'אין מספיק יחידות פנויות בתאריכים שנבחרו', unit_busy: 'היחידה תפוסה בתאריכים האלה', dates_invalid: 'תאריכים לא תקינים',
    wrong_password: 'סיסמה שגויה', rate_limited: 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות', prices_required: 'יש למלא מחיר (גדול מ-0) לכל מספר אורחים',
    name_required: 'יש למלא שם', type_in_use: 'אי אפשר למחוק סוג חדר שיש עליו הזמנות. אפשר לסמן אותו כלא פעיל.',
    unit_in_use: 'אי אפשר למחוק יחידה שיש עליה הזמנות. אפשר לסמן אותה כלא פעילה.', payment_unavailable: 'PayPal לא מחובר',
    refund_amount: 'סכום ההחזר לא תקין', not_refundable: 'את התשלום הזה אי אפשר להחזיר דרך המערכת', amount_invalid: 'סכום לא תקין',
    method_invalid: 'אמצעי תשלום לא תקין', total_invalid: 'סכום לא תקין', guests_invalid: 'מספר אורחים לא תקין', email_invalid: 'כתובת מייל לא תקינה',
    gender_mismatch: 'המגדר של המתארחים לא מתאים לחדרי המעונות', admin_password_missing: 'לא הוגדרה סיסמת ניהול (ADMIN_PASSWORD)',
    payment_failed: 'PayPal החזיר שגיאה', server_error: 'שגיאת שרת', not_found: 'לא נמצא', no_rooms: 'יש להוסיף לפחות חדר או מיטה אחת',
    room_type_invalid: 'סוג חדר לא תקין', not_active: 'אפשר לשנות תאריכים רק בהזמנה פעילה', receipt_negative: 'אין מפיקים קבלה על החזר',
    image_invalid: 'קובץ תמונה לא תקין', json_required: 'בקשה לא תקינה',
  };
  const COUNTRIES = ('IL DE AT CH NL BE FR GB IE US CA AU NZ ZA BR AR MX DK SE NO FI IS PL CZ SK HU RO BG UA RU EE LV LT IT ES PT GR CY MT TR JO EG AE IN CN JP KR PH SG TH ID MY NG KE ET GH TZ UG').split(' ');

  // ---------------------------------------------------------------- helpers
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const nf = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 2, minimumFractionDigits: 0 });
  function money(n, cur) {
    if (cur && cur !== 'ILS') return new Intl.NumberFormat('he-IL', { style: 'currency', currency: cur }).format(Number(n) || 0);
    return nf.format(Number(n) || 0);
  }
  function dmy(s) {
    if (!s) return '';
    const p = String(s).slice(0, 10).split('-');
    return `${p[2]}/${p[1]}/${p[0]}`;
  }
  const wdFmt = new Intl.DateTimeFormat('he-IL', { weekday: 'short', timeZone: 'UTC' });
  function wd(s) { return wdFmt.format(new Date(s + 'T00:00:00Z')); }
  function dateTime(s) { return s ? new Date(s).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : ''; }
  function addDays(s, n) {
    const d = new Date(s + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function nights(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5); }
  function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date()); }
  function pick(o) { return o ? o.he || o.en || o.de || '' : ''; }
  function badge(status) { const s = STATUS[status] || [status, 'b']; return `<span class="b ${s[1]}">${esc(s[0])}</span>`; }
  function payBadge(b) {
    if (b.kind === 'block') return '<span class="b">חסימה</span>';
    if (Number(b.total) <= 0) return '';
    if (Number(b.paid) >= Number(b.total) - 0.004) return '<span class="b b-ok">שולם</span>';
    if (Number(b.paid) > 0) return '<span class="b b-warn">שולם חלקית</span>';
    return '<span class="b b-warn">לא שולם</span>';
  }
  function countryOptions(sel) {
    let names = null;
    try { names = new Intl.DisplayNames(['he'], { type: 'region' }); } catch (_) { /* old browser */ }
    return '<option value="">—</option>' + COUNTRIES.map((c) => `<option value="${c}"${c === sel ? ' selected' : ''}>${esc(names ? names.of(c) : c)}</option>`).join('');
  }

  async function api(method, url, body) {
    const res = await fetch('/api/admin' + url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    let data = {};
    try { data = await res.json(); } catch (_) { /* empty */ }
    if (res.status === 401 && url !== '/login') {
      showLogin();
      throw new Error('unauthorized');
    }
    if (!res.ok) {
      const e = new Error(ERR[data.error] || data.message || data.error || 'שגיאה');
      e.code = data.error;
      throw e;
    }
    return data;
  }

  let toastTimer = null;
  function toast(msg, bad) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.toggle('bad', Boolean(bad));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), bad ? 6000 : 3000);
  }

  // Run an async action from a button: disable while running, show errors as toast
  async function run(btn, fn) {
    if (btn) btn.disabled = true;
    try {
      return await fn();
    } catch (e) {
      if (e.message !== 'unauthorized') toast(e.message, true);
      return undefined;
    } finally {
      if (btn && document.body.contains(btn)) btn.disabled = false;
    }
  }

  function field(form, name) { return form.querySelector(`[name="${name}"]`); }

  // Resize a photo in the browser and upload it
  async function uploadImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      const max = 1920;
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.84));
      const res = await fetch('/api/admin/images', { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob, credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) throw new Error(ERR[data.error] || 'העלאה נכשלה');
      return data.url;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // ---------------------------------------------------------------- shell & router
  const TABS = [
    ['dashboard', 'לוח בקרה'], ['calendar', 'לוח תפוסה'], ['bookings', 'הזמנות'], ['new', '+ הזמנה חדשה'],
    ['groups', 'בקשות קבוצות'], ['rooms', 'חדרים ומחירים'], ['settings', 'הגדרות האתר'], ['integrations', 'חיבורים'],
  ];

  function shell(active) {
    if (!document.querySelector('.topbar')) {
      app.innerHTML = `<header class="topbar"><div class="topbar-inner">
        <a class="brand" href="#/dashboard">בית אל · ניהול</a>
        <nav class="tabs" aria-label="ניווט">${TABS.map(([k, n]) => `<a href="#/${k}" data-tab="${k}">${esc(n)}</a>`).join('')}</nav>
        <a class="btn btn-sm" href="/" target="_blank" rel="noopener" style="background:transparent;color:#f3e9da;border-color:rgba(255,255,255,.3)">לאתר</a>
        <button class="logout" type="button" data-logout>יציאה</button>
      </div></header><main id="main" class="main"></main>`;
      app.querySelector('[data-logout]').addEventListener('click', async () => {
        await api('POST', '/logout', {});
        showLogin();
      });
    }
    app.querySelectorAll('[data-tab]').forEach((a) => {
      const on = a.getAttribute('data-tab') === active || (active === 'booking' && a.getAttribute('data-tab') === 'bookings');
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function freshMain() {
    const old = document.getElementById('main');
    const m = document.createElement('main');
    m.id = 'main';
    m.className = 'main';
    old.replaceWith(m);
    return m;
  }

  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    return { parts: path.split('/').filter(Boolean), q: Object.fromEntries(new URLSearchParams(qs || '')) };
  }

  async function route() {
    const { parts, q } = parseHash();
    const name = parts[0] || 'dashboard';
    shell(name);
    const main = freshMain();
    main.innerHTML = '<p class="loading">טוען…</p>';
    window.scrollTo(0, 0);
    try {
      if (name === 'dashboard') await viewDashboard(main);
      else if (name === 'calendar') await viewCalendar(main, q);
      else if (name === 'bookings') await viewBookings(main, q);
      else if (name === 'booking') await viewBooking(main, parts[1]);
      else if (name === 'new') await viewNew(main, q);
      else if (name === 'rooms') await (parts[1] ? viewRoomEdit(main, parts[1]) : viewRooms(main));
      else if (name === 'groups') await viewGroups(main);
      else if (name === 'settings') await viewSettings(main);
      else if (name === 'integrations') await viewIntegrations(main);
      else main.innerHTML = '<p>הדף לא נמצא</p>';
    } catch (e) {
      const current = document.getElementById('main'); // a view may have replaced <main>
      if (e.message !== 'unauthorized' && current) current.innerHTML = `<div class="alert alert-bad">${esc(e.message)}</div>`;
    }
  }

  function showLogin() {
    app.innerHTML = `<div class="login card">
      <h1>כניסה לניהול</h1>
      <form data-login>
        <label class="f"><span>סיסמה</span><input type="password" name="password" autocomplete="current-password" required></label>
        <div data-msg></div>
        <button class="btn btn-primary" style="width:100%" type="submit">כניסה</button>
      </form></div>`;
    const form = app.querySelector('[data-login]');
    field(form, 'password').focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button');
      btn.disabled = true;
      try {
        await api('POST', '/login', { password: field(form, 'password').value });
        app.innerHTML = '';
        if (!location.hash) location.hash = '#/dashboard';
        route();
      } catch (err) {
        form.querySelector('[data-msg]').innerHTML = `<div class="alert alert-bad">${esc(err.message)}</div>`;
        btn.disabled = false;
      }
    });
  }

  // ---------------------------------------------------------------- dashboard
  function integrationWarnings(i) {
    const w = [];
    if (i.demo) w.push('מצב הדגמה פעיל: אפשר להשלים הזמנה בלי תשלום אמיתי. יש לכבות אותו (DEMO_MODE) לפני שהאתר עולה לאוויר.');
    if (!i.paypal.configured) w.push('PayPal עדיין לא מחובר.');
    else if (i.paypal.env !== 'live') w.push('PayPal במצב ניסיון (sandbox): אין חיובים אמיתיים.');
    if (!i.morning.configured) w.push('מורנינג עדיין לא מחוברת, ולכן קבלות לא מופקות אוטומטית.');
    else if (i.morning.env !== 'production') w.push('מורנינג במצב ניסיון (sandbox): הקבלות לא אמיתיות.');
    if (!i.mail.configured) w.push('שליחת מיילים לא מוגדרת: אורחים לא מקבלים מייל אישור (הקבלה ממורנינג נשלחת בנפרד).');
    return w;
  }

  function miniList(rows, empty, fn) {
    if (!rows.length) return `<p class="muted">${esc(empty)}</p>`;
    return `<ul class="list">${rows.map(fn).join('')}</ul>`;
  }

  async function viewDashboard(main) {
    const d = await api('GET', '/overview');
    const warnings = integrationWarnings(d.integrations);
    const maxUnits = Math.max(1, d.totalUnits);
    const bookingLi = (b) => `<li><a href="#/booking/${b.id}"><b>${esc(b.guest_name)}</b></a><span class="muted">${esc(b.code)}</span>
      <span class="muted">${dmy(b.check_in)}–${dmy(b.check_out)}</span>${b.guests_count ? `<span class="muted">${b.guests_count} אורחים</span>` : ''}
      <span class="spacer"></span>${payBadge(b)}${b.phone ? `<a class="ltr small" href="tel:${esc(b.phone)}">${esc(b.phone)}</a>` : ''}</li>`;

    main.innerHTML = `
      <h1>לוח בקרה</h1>
      ${warnings.length ? `<div class="alert"><b>שימו לב:</b><ul style="margin:6px 0 0;padding-inline-start:18px">${warnings.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><a href="#/integrations">לדף החיבורים</a></div>` : ''}
      ${d.receiptIssues.length ? `<div class="alert alert-bad"><b>קבלות שלא הופקו:</b> ${d.receiptIssues.map((p) => `<a href="#/booking/${p.booking_id}">${esc(p.code)}</a>`).join(', ')}</div>` : ''}
      <div class="grid grid-4" style="margin-bottom:16px">
        <div class="stat"><div class="n">${d.arrivals.length}</div><div class="l">מגיעים היום</div></div>
        <div class="stat"><div class="n">${d.departures.length}</div><div class="l">עוזבים היום</div></div>
        <div class="stat"><div class="n">${d.inhouse.guests}</div><div class="l">אורחים באכסניה עכשיו</div></div>
        <div class="stat"><div class="n">${d.occupancy30}%</div><div class="l">תפוסה ב-30 הימים הקרובים</div></div>
      </div>
      <div class="card">
        <h2>תפוסה בשבועיים הקרובים <span class="muted small">(יחידות תפוסות מתוך ${d.totalUnits})</span></h2>
        <div class="bars">${d.days.map((x) => `<div class="bar" style="height:100%" title="${dmy(x.day)}: ${x.units} יחידות, ${x.guests} אורחים"><i style="height:${Math.round((x.units / maxUnits) * 100)}%"></i></div>`).join('')}</div>
        <div class="bars-labels">${d.days.map((x) => `<span>${esc(wd(x.day))}<br>${x.day.slice(8, 10)}/${x.day.slice(5, 7)}</span>`).join('')}</div>
      </div>
      <div class="grid grid-2">
        <section class="card"><h2>מגיעים היום</h2>${miniList(d.arrivals, 'אין הגעות היום', bookingLi)}</section>
        <section class="card"><h2>עוזבים היום</h2>${miniList(d.departures, 'אין עזיבות היום', bookingLi)}</section>
        <section class="card"><h2>לגבייה בהגעה</h2>${miniList(d.unpaid, 'אין יתרות פתוחות', (b) => `<li><a href="#/booking/${b.id}"><b>${esc(b.guest_name)}</b></a><span class="muted">${dmy(b.check_in)}</span><span class="spacer"></span><b>${money(Number(b.total) - Number(b.paid))}</b></li>`)}</section>
        <section class="card"><h2>הזמנות אחרונות</h2>${miniList(d.recent, 'עדיין אין הזמנות', (b) => `<li><a href="#/booking/${b.id}"><b>${esc(b.guest_name)}</b></a><span class="muted">${dmy(b.check_in)}–${dmy(b.check_out)}</span><span class="spacer"></span>${badge(b.status)}${b.source === 'web' ? '<span class="b b-info">מהאתר</span>' : ''}</li>`)}</section>
      </div>
      ${d.pending.length ? `<section class="card"><h2>ממתינות לתשלום עכשיו</h2>${miniList(d.pending, '', (b) => `<li><a href="#/booking/${b.id}">${esc(b.guest_name)}</a><span class="muted">${esc(b.code)} · ${money(b.total)}</span><span class="spacer"></span><span class="small muted">השריון עד ${dateTime(b.expires_at)}</span></li>`)}</section>` : ''}`;
  }

  // ---------------------------------------------------------------- calendar
  async function viewCalendar(main, q) {
    const from = /^\d{4}-\d{2}-\d{2}$/.test(q.from || '') ? q.from : today();
    const days = [14, 21, 31].includes(Number(q.days)) ? Number(q.days) : 21;
    const d = await api('GET', `/calendar?from=${from}&days=${days}`);
    const dates = Array.from({ length: d.days }, (_, i) => addDays(d.from, i));
    const tday = today();
    const cols = `170px repeat(${d.days}, minmax(46px, 1fr))`;
    const dayCls = (s) => {
      const w = new Date(s + 'T00:00:00Z').getUTCDay();
      return (w === 5 || w === 6 ? ' we' : '') + (s === tday ? ' today' : '');
    };
    const go = (f, n) => `#/calendar?from=${f}&days=${n}`;

    let rows = `<div class="cal-row cal-head" style="grid-template-columns:${cols}"><div class="cal-label">יחידה</div>${dates.map((s, i) => `<div class="cal-day${dayCls(s)}" style="grid-column:${i + 2}">${esc(wd(s))}<br><b>${s.slice(8, 10)}/${s.slice(5, 7)}</b></div>`).join('')}</div>`;
    for (const tp of d.types) {
      const units = tp.units.filter((u) => u.active || d.items.some((it) => it.unit_id === u.id));
      if (!units.length) continue;
      rows += `<div class="cal-row cal-type" style="grid-template-columns:${cols}"><div class="cal-label">${esc(pick(tp.name))}${tp.active ? '' : ' (לא פעיל)'}</div><div class="cal-fill" style="grid-column:2 / -1"></div></div>`;
      for (const u of units) {
        const cells = dates.map((s, i) => `<div class="cal-day cal-cell${dayCls(s)}" style="grid-column:${i + 2}" data-unit="${u.id}" data-date="${s}" title="${esc(u.name)} · ${dmy(s)}"></div>`).join('');
        const bars = d.items.filter((it) => it.unit_id === u.id).map((it) => {
          const a = Math.max(0, nights(d.from, it.start));
          const b = Math.min(d.days, nights(d.from, it.end));
          if (b <= a) return '';
          let cls = 'cal-bar';
          if (it.kind === 'block') cls += ' block';
          else if (it.status === 'pending') cls += ' pending';
          else if (Number(it.paid) < Number(it.total) - 0.004) cls += ' unpaid';
          if (it.start < d.from) cls += ' cut-start';
          if (nights(d.from, it.end) > d.days) cls += ' cut-end';
          const label = it.kind === 'block' ? `⛔ ${it.guest_name || 'חסימה'}` : `${it.guest_name || ''}${it.guests > 1 ? ` (${it.guests})` : ''}`;
          return `<a class="${cls}" href="#/booking/${it.id}" style="grid-column:${a + 2} / ${b + 2}" title="${esc(it.code)} · ${esc(it.guest_name || '')} · ${dmy(it.start)}–${dmy(it.end)}">${esc(label)}</a>`;
        }).join('');
        rows += `<div class="cal-row" style="grid-template-columns:${cols}"><div class="cal-label" title="${esc(u.name)}">${esc(u.name)}${u.active ? '' : ' ✕'}</div>${cells}${bars}</div>`;
      }
    }

    main.innerHTML = `
      <div class="row" style="margin-bottom:12px">
        <h1 style="margin:0">לוח תפוסה</h1><span class="spacer"></span>
        <a class="btn btn-sm" href="${go(addDays(d.from, -7), days)}">→ שבוע קודם</a>
        <a class="btn btn-sm" href="${go(tday, days)}">היום</a>
        <a class="btn btn-sm" href="${go(addDays(d.from, 7), days)}">שבוע הבא ←</a>
        <input type="date" value="${d.from}" data-jump aria-label="קפיצה לתאריך" style="width:auto">
        <select data-days aria-label="מספר ימים" style="width:auto">${[14, 21, 31].map((n) => `<option value="${n}"${n === days ? ' selected' : ''}>${n} ימים</option>`).join('')}</select>
      </div>
      <div class="legend"><span><i style="background:#5c7a3a"></i>מאושרת ושולמה</span><span><i style="background:#b7791f"></i>מאושרת, לא שולמה במלואה</span><span><i style="background:#9c8a73"></i>ממתינה לתשלום</span><span><i style="background:#7d7d7d"></i>חסימה</span><span>לחיצה על משבצת ריקה פותחת הזמנה חדשה</span></div>
      <div class="cal-wrap">${rows}</div>`;

    main.addEventListener('click', (e) => {
      const cell = e.target.closest('.cal-cell');
      if (cell) location.hash = `#/new?unit=${cell.getAttribute('data-unit')}&date=${cell.getAttribute('data-date')}`;
    });
    main.querySelector('[data-jump]').addEventListener('change', (e) => { if (e.target.value) location.hash = go(e.target.value, days); });
    main.querySelector('[data-days]').addEventListener('change', (e) => { location.hash = go(d.from, e.target.value); });
  }

  // ---------------------------------------------------------------- bookings list
  async function viewBookings(main, q) {
    const f = { scope: q.scope || 'upcoming', status: q.status || '', kind: q.kind || 'guest', q: q.q || '' };
    main.innerHTML = `
      <div class="row" style="margin-bottom:12px"><h1 style="margin:0">הזמנות</h1><span class="spacer"></span><a class="btn btn-primary" href="#/new">+ הזמנה חדשה</a></div>
      <div class="card row" data-filters>
        <select name="scope" style="width:auto"><option value="upcoming">עתידיות ונוכחיות</option><option value="past">עבר</option><option value="all">הכול</option></select>
        <select name="status" style="width:auto"><option value="">כל הסטטוסים</option><option value="confirmed">מאושרות</option><option value="pending">ממתינות לתשלום</option><option value="cancelled">בוטלו</option><option value="expired">פג תוקף</option></select>
        <select name="kind" style="width:auto"><option value="guest">הזמנות</option><option value="block">חסימות</option></select>
        <input type="search" name="q" placeholder="חיפוש: שם, מייל, טלפון או מספר הזמנה" style="flex:1;min-width:200px">
      </div>
      <div data-results><p class="loading">טוען…</p></div>`;
    const box = main.querySelector('[data-filters]');
    Object.keys(f).forEach((k) => { field(box, k).value = f[k]; });

    async function load() {
      const params = new URLSearchParams(f);
      history.replaceState(null, '', '#/bookings?' + params.toString());
      const res = main.querySelector('[data-results]');
      const data = await api('GET', '/bookings?' + params.toString());
      if (!data.bookings.length) { res.innerHTML = '<p class="muted">לא נמצאו הזמנות.</p>'; return; }
      res.innerHTML = `<div class="table-wrap card" style="padding:0"><table class="t"><thead><tr>
        <th>מספר</th><th>שם</th><th>תאריכים</th><th>לילות</th><th>יחידות</th><th>אורחים</th><th class="num">סה״כ</th><th class="num">שולם</th><th>סטטוס</th></tr></thead><tbody>
        ${data.bookings.map((b) => `<tr class="click" data-id="${b.id}">
          <td class="nowrap"><a href="#/booking/${b.id}">${esc(b.code)}</a></td>
          <td>${esc(b.guest_name)}${b.source === 'web' ? ' <span class="b b-info">אתר</span>' : ''}${b.receipt_issue ? ' <span class="b b-bad">קבלה</span>' : ''}</td>
          <td class="nowrap">${dmy(b.check_in)} – ${dmy(b.check_out)}</td>
          <td>${nights(b.check_in, b.check_out)}</td>
          <td class="small">${esc(b.units || '')}</td>
          <td>${b.guests_count || ''}</td>
          <td class="num">${money(b.total)}</td>
          <td class="num">${money(b.paid)}</td>
          <td class="nowrap">${badge(b.status)} ${b.status === 'confirmed' ? payBadge(b) : ''}</td></tr>`).join('')}
        </tbody></table></div><p class="muted small">${data.bookings.length} תוצאות</p>`;
    }
    let t = null;
    box.addEventListener('input', (e) => {
      f[e.target.name] = e.target.value;
      clearTimeout(t);
      t = setTimeout(() => load().catch((err) => toast(err.message, true)), e.target.name === 'q' ? 350 : 0);
    });
    main.addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (tr && !e.target.closest('a')) location.hash = '#/booking/' + tr.getAttribute('data-id');
    });
    await load();
  }

  // ---------------------------------------------------------------- booking detail
  async function viewBooking(main, id) {
    const data = await api('GET', '/bookings/' + Number(id));
    if (!main.isConnected) return; // user already moved to another page
    renderBooking(data);
  }

  function travelerRows(list) {
    return list.map((tr, i) => `<div class="traveler-row" data-tr="${i}">
      <input type="text" value="${esc(tr.name)}" data-tr-name aria-label="שם מתארח ${i + 1}">
      <select data-tr-gender aria-label="מגדר"><option value="male"${tr.gender !== 'female' ? ' selected' : ''}>גבר</option><option value="female"${tr.gender === 'female' ? ' selected' : ''}>אישה</option></select>
      <button type="button" class="btn btn-sm btn-danger" data-tr-del aria-label="הסרה">✕</button></div>`).join('');
  }
  function readTravelers(scope) {
    return [...scope.querySelectorAll('[data-tr]')].map((row) => ({
      name: row.querySelector('[data-tr-name]').value.trim(),
      gender: row.querySelector('[data-tr-gender]').value,
    })).filter((x) => x.name);
  }
  function bindTravelerEditor(scope) {
    scope.addEventListener('click', (e) => {
      if (e.target.closest('[data-tr-del]')) e.target.closest('[data-tr]').remove();
      if (e.target.closest('[data-tr-add]')) {
        const list = scope.querySelector('[data-tr-list]');
        list.insertAdjacentHTML('beforeend', travelerRows([{ name: '', gender: 'male' }]).replace('data-tr="0"', `data-tr="${list.children.length}"`));
      }
    });
  }

  function renderBooking(data) {
    const main = freshMain(); // new element = no duplicated event listeners after reload
    const b = data.booking;
    const integ = data.integrations;
    const active = b.status === 'confirmed' || b.status === 'pending';
    const balance = Number(b.total) - Number(b.paid);
    const isBlock = b.kind === 'block';
    const refundable = data.payments.filter((p) => ['paypal', 'demo'].includes(p.method) && Number(p.amount) > 0 && Number(p.amount) - Number(p.refunded || 0) > 0.004);
    const warnings = String(b.admin_notes || '').split('\n').filter((l) => l.startsWith('⚠'));

    const unitsHtml = data.lines.map((l) => `<li data-bu="${l.id}">
      <b>${esc(l.unitName)}</b><span class="muted">${esc(pick(l.typeName))}</span>
      ${l.soldAs === 'room' && !isBlock ? `<span class="muted">${l.guests} אורחים</span>` : ''}
      ${!isBlock ? `<span class="muted">${money(l.nightly)} ללילה</span>` : ''}
      ${!l.active ? '<span class="b">שוחרר</span>' : ''}
      <span class="spacer"></span>
      ${active && l.active ? `<button type="button" class="btn btn-sm" data-move-open>החלפת יחידה</button>` : ''}
      <span data-move-box></span></li>`).join('');

    const payRows = data.payments.map((p) => {
      let receipt = '';
      if (p.doc_url) receipt = `<a href="${esc(p.doc_url)}" target="_blank" rel="noopener">קבלה ${esc(p.doc_number)}</a>`;
      else if (Number(p.amount) > 0) {
        receipt = (p.doc_error ? `<span class="b b-bad" title="${esc(p.doc_error)}">לא הופקה</span> ` : '')
          + `<button type="button" class="btn btn-sm" data-receipt="${p.id}">הפקת קבלה</button>`
          + (p.doc_error ? `<div class="small muted" style="max-width:260px">${esc(p.doc_error)}</div>` : '');
      }
      const canRefund = ['paypal', 'demo'].includes(p.method) && Number(p.amount) > 0 && Number(p.amount) - Number(p.refunded || 0) > 0.004;
      return `<tr>
        <td class="nowrap">${dateTime(p.created_at)}</td>
        <td>${esc(METHOD[p.method] || p.method)}${p.payer_email ? `<div class="small muted ltr">${esc(p.payer_email)}</div>` : ''}${p.note ? `<div class="small muted">${esc(p.note)}</div>` : ''}</td>
        <td class="num">${money(p.amount, p.currency)}${p.status && p.status !== 'completed' ? ` <span class="b b-warn">${esc(p.status)}</span>` : ''}</td>
        <td>${receipt}</td>
        <td>${canRefund ? `<button type="button" class="btn btn-sm btn-danger" data-refund="${p.id}" data-max="${Number(p.amount) - Number(p.refunded || 0)}">החזר</button>` : ''}</td></tr>`;
    }).join('');

    main.innerHTML = `
      <p><a href="#/bookings">→ לכל ההזמנות</a></p>
      <div class="row" style="margin-bottom:14px">
        <h1 style="margin:0">${isBlock ? 'חסימה' : 'הזמנה'} ${esc(b.code)}</h1>
        ${badge(b.status)} ${b.status === 'confirmed' ? payBadge(b) : ''} <span class="b ${b.source === 'web' ? 'b-info' : ''}">${b.source === 'web' ? 'הוזמנה באתר' : 'נוצרה ידנית'}</span>
        <span class="spacer"></span>
        ${!isBlock ? `<a class="btn btn-sm" href="${esc(b.link)}" target="_blank" rel="noopener">דף האורח</a>` : ''}
        ${!isBlock && b.email && b.status === 'confirmed' ? '<button type="button" class="btn btn-sm" data-resend>שליחת אישור במייל</button>' : ''}
        ${active ? '<button type="button" class="btn btn-sm btn-danger" data-cancel-open>ביטול</button>' : ''}
      </div>
      ${warnings.map((w) => `<div class="alert alert-bad">${esc(w)}</div>`).join('')}
      <div class="card hide" data-cancel-box>
        <h2>ביטול ${isBlock ? 'החסימה' : 'ההזמנה'}</h2>
        ${refundable.length ? `<label class="check"><input type="checkbox" data-c-refund checked> החזר כספי מלא ב-PayPal (${money(refundable.reduce((a, p) => a + Number(p.amount) - Number(p.refunded || 0), 0))})</label>` : ''}
        ${!isBlock && b.email ? '<label class="check"><input type="checkbox" data-c-notify checked> שליחת מייל ביטול לאורח</label>' : ''}
        <label class="f"><span>סיבה (פנימי)</span><input type="text" data-c-reason maxlength="300"></label>
        ${Number(b.paid) > 0 && !refundable.length ? '<p class="alert">שולם כסף שלא דרך PayPal. אחרי הביטול יש להחזיר אותו ידנית ולרשום החזר (סכום שלילי) בחלק התשלומים.</p>' : ''}
        <div class="row"><button type="button" class="btn btn-danger" data-cancel-go>אישור ביטול</button><button type="button" class="btn" data-cancel-close>חזרה</button></div>
      </div>
      <div class="grid grid-2">
        <section class="card">
          <h2>שהות</h2>
          <dl class="kv">
            <dt>הגעה</dt><dd>${esc(wd(b.check_in))} ${dmy(b.check_in)}</dd>
            <dt>עזיבה</dt><dd>${esc(wd(b.check_out))} ${dmy(b.check_out)}</dd>
            <dt>לילות</dt><dd>${nights(b.check_in, b.check_out)}</dd>
            ${!isBlock ? `<dt>אורחים</dt><dd>${b.guests_count}</dd>` : ''}
          </dl>
          <h3 style="margin-top:14px">יחידות</h3>
          <ul class="list" data-units>${unitsHtml}</ul>
          ${active ? `<details style="margin-top:12px"><summary class="link">שינוי תאריכים</summary>
            <form class="row" data-dates style="margin-top:10px;align-items:end">
              <label class="f" style="margin:0"><span>הגעה</span><input type="date" name="checkIn" value="${b.check_in}" required></label>
              <label class="f" style="margin:0"><span>עזיבה</span><input type="date" name="checkOut" value="${b.check_out}" required></label>
              ${!isBlock ? '<label class="check" style="margin:0"><input type="checkbox" name="reprice" checked> לחשב מחיר מחדש</label>' : ''}
              <button class="btn btn-primary" type="submit">שמירה</button>
            </form></details>` : ''}
        </section>
        ${!isBlock ? `<section class="card">
          <h2>תשלום</h2>
          <form class="row" data-total style="align-items:end;margin-bottom:10px">
            <label class="f" style="margin:0"><span>סה״כ להזמנה</span><input type="number" name="total" min="0" step="0.01" value="${Number(b.total)}" style="width:140px"></label>
            <button class="btn btn-sm" type="submit">עדכון</button>
            <span class="spacer"></span>
            <div><div class="muted small">שולם</div><b>${money(b.paid, b.currency)}</b></div>
            <div><div class="muted small">יתרה</div><b style="color:${balance > 0.004 ? 'var(--bad)' : 'var(--ok)'}">${money(balance, b.currency)}</b></div>
          </form>
          ${data.payments.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>תאריך</th><th>אמצעי</th><th class="num">סכום</th><th>קבלה</th><th></th></tr></thead><tbody>${payRows}</tbody></table></div>` : '<p class="muted">עדיין אין תשלומים.</p>'}
          ${b.status !== 'expired' ? `<details style="margin-top:12px"${balance > 0.004 && b.status === 'confirmed' ? ' open' : ''}><summary class="link">רישום תשלום (מזומן, אשראי, העברה, ביט)</summary>
            <form data-pay style="margin-top:10px">
              <div class="grid grid-2" style="gap:0 12px">
                <label class="f"><span>אמצעי תשלום</span><select name="method"><option value="cash">מזומן</option><option value="card">כרטיס אשראי</option><option value="transfer">העברה בנקאית</option><option value="bit">ביט</option><option value="paypal">PayPal (ידני)</option></select></label>
                <label class="f"><span>סכום (החזר = מינוס)</span><input type="number" name="amount" step="0.01" value="${balance > 0 ? balance : ''}" required></label>
              </div>
              <label class="f"><span>הערה</span><input type="text" name="note" maxlength="300"></label>
              <label class="check"><input type="checkbox" name="issueReceipt"${integ.morning.configured ? ' checked' : ''}> הפקת קבלה במורנינג ושליחתה לאורח</label>
              <button class="btn btn-primary" type="submit">רישום התשלום</button>
            </form></details>` : ''}
        </section>` : ''}
        <section class="card">
          <h2>${isBlock ? 'פרטים' : 'פרטי האורח'}</h2>
          <form data-guest>
            <label class="f"><span>${isBlock ? 'סיבת החסימה' : 'שם מלא'}</span><input type="text" name="guest_name" value="${esc(b.guest_name)}" maxlength="100"></label>
            ${!isBlock ? `<div class="grid grid-2" style="gap:0 12px">
              <label class="f"><span>מייל</span><input type="email" name="email" value="${esc(b.email)}" class="ltr"></label>
              <label class="f"><span>טלפון</span><input type="tel" name="phone" value="${esc(b.phone)}" class="ltr"></label>
              <label class="f"><span>מדינה</span><select name="country">${countryOptions(b.country)}</select></label>
              <label class="f"><span>שפת המיילים והקבלה</span><select name="lang">${Object.keys(LANGN).map((l) => `<option value="${l}"${l === b.lang ? ' selected' : ''}>${LANGN[l]}</option>`).join('')}</select></label>
            </div>
            <div class="f"><span>מתארחים (שם ומגדר)</span><div data-tr-list>${travelerRows(b.travelers || [])}</div><button type="button" class="link" data-tr-add>+ הוספת מתארח</button></div>
            <label class="f"><span>בקשות האורח</span><textarea name="notes" maxlength="2000">${esc(b.notes)}</textarea></label>` : ''}
            <label class="f"><span>הערות פנימיות (לא נראות לאורח)</span><textarea name="admin_notes" maxlength="4000">${esc(b.admin_notes)}</textarea></label>
            <button class="btn btn-primary" type="submit">שמירת פרטים</button>
          </form>
        </section>
        <section class="card">
          <h2>היסטוריה</h2>
          <ul class="list audit">${data.audit.map((a) => `<li><span class="muted small nowrap">${dateTime(a.created_at)}</span><span>${esc(AUDIT[a.action] || a.action)}</span>${a.detail && a.detail.error ? `<span class="small muted">${esc(a.detail.error)}</span>` : ''}${a.detail && a.detail.amount ? `<span class="small muted">${money(a.detail.amount)}</span>` : ''}</li>`).join('')}</ul>
          <p class="small muted">נוצרה ${dateTime(b.created_at)}</p>
        </section>
      </div>`;

    const reload = (d) => renderBooking(d);
    const $ = (sel) => main.querySelector(sel);
    const guestForm = $('[data-guest]');
    if (guestForm && !isBlock) bindTravelerEditor(guestForm);

    main.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.hasAttribute('data-cancel-open')) $('[data-cancel-box]').classList.remove('hide');
      if (btn.hasAttribute('data-cancel-close')) $('[data-cancel-box]').classList.add('hide');
      if (btn.hasAttribute('data-cancel-go')) {
        await run(btn, async () => {
          const d = await api('POST', `/bookings/${b.id}/cancel`, {
            refund: Boolean($('[data-c-refund]') && $('[data-c-refund]').checked),
            notifyGuest: Boolean($('[data-c-notify]') && $('[data-c-notify]').checked),
            reason: $('[data-c-reason]').value,
          });
          toast('ההזמנה בוטלה');
          reload(d);
        });
      }
      if (btn.hasAttribute('data-resend')) {
        await run(btn, async () => {
          const r = await api('POST', `/bookings/${b.id}/resend`, {});
          toast(r.mailConfigured ? 'המייל נשלח' : 'שליחת מיילים לא מוגדרת – לא נשלח', !r.mailConfigured);
        });
      }
      if (btn.hasAttribute('data-receipt')) {
        await run(btn, async () => {
          const d = await api('POST', `/payments/${btn.getAttribute('data-receipt')}/receipt`, {});
          toast('הקבלה הופקה');
          reload(d);
        });
      }
      if (btn.hasAttribute('data-refund')) {
        const max = Number(btn.getAttribute('data-max'));
        const v = window.prompt(`סכום להחזר (עד ${max}):`, String(max));
        if (v === null) return;
        await run(btn, async () => {
          const d = await api('POST', `/payments/${btn.getAttribute('data-refund')}/refund`, { amount: Number(v) });
          toast('ההחזר בוצע. אם הופקה קבלה, יש להפיק במורנינג מסמך ביטול או זיכוי.');
          reload(d);
        });
      }
      if (btn.hasAttribute('data-move-open')) {
        const li = btn.closest('[data-bu]');
        const box = li.querySelector('[data-move-box]');
        await run(btn, async () => {
          const r = await api('GET', `/free-units?checkIn=${b.check_in}&checkOut=${b.check_out}&exclude=${b.id}`);
          box.innerHTML = `<select data-move-unit style="width:auto">${r.units.map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select> <button type="button" class="btn btn-sm btn-primary" data-move-go>העברה</button>`;
          btn.remove();
        });
      }
      if (btn.hasAttribute('data-move-go')) {
        const li = btn.closest('[data-bu]');
        await run(btn, async () => {
          const d = await api('POST', `/booking-units/${li.getAttribute('data-bu')}/move`, { unitId: Number(li.querySelector('[data-move-unit]').value) });
          toast('היחידה הוחלפה');
          reload(d);
        });
      }
    });

    main.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const btn = form.querySelector('button[type=submit]');
      if (form.hasAttribute('data-dates')) {
        await run(btn, async () => {
          const d = await api('POST', `/bookings/${b.id}/dates`, { checkIn: field(form, 'checkIn').value, checkOut: field(form, 'checkOut').value, reprice: field(form, 'reprice') ? field(form, 'reprice').checked : false });
          toast('התאריכים עודכנו');
          reload(d);
        });
      } else if (form.hasAttribute('data-total')) {
        await run(btn, async () => { reload(await api('PATCH', `/bookings/${b.id}`, { total: Number(field(form, 'total').value) })); toast('נשמר'); });
      } else if (form.hasAttribute('data-pay')) {
        await run(btn, async () => {
          const d = await api('POST', `/bookings/${b.id}/payments`, {
            method: field(form, 'method').value,
            amount: Number(field(form, 'amount').value),
            note: field(form, 'note').value,
            issueReceipt: field(form, 'issueReceipt').checked,
          });
          toast('התשלום נרשם');
          reload(d);
        });
      } else if (form.hasAttribute('data-guest')) {
        const body = { guest_name: field(form, 'guest_name').value, admin_notes: field(form, 'admin_notes').value };
        if (!isBlock) {
          Object.assign(body, {
            email: field(form, 'email').value, phone: field(form, 'phone').value, country: field(form, 'country').value,
            lang: field(form, 'lang').value, notes: field(form, 'notes').value, travelers: readTravelers(form),
          });
        }
        await run(btn, async () => { reload(await api('PATCH', `/bookings/${b.id}`, body)); toast('הפרטים נשמרו'); });
      }
    });
  }

  // ---------------------------------------------------------------- new booking / block
  async function viewNew(main, q) {
    const { types } = await api('GET', '/room-types');
    const byId = {};
    types.forEach((t) => { byId[t.id] = t; });
    let unitType = null;
    if (q.unit) types.forEach((t) => t.units.forEach((u) => { if (String(u.id) === q.unit) unitType = t; }));
    const start = /^\d{4}-\d{2}-\d{2}$/.test(q.date || '') ? q.date : today();
    const st = {
      kind: q.kind === 'block' ? 'block' : 'guest',
      checkIn: start,
      checkOut: addDays(start, 1),
      lines: unitType ? [{ typeId: unitType.id, guests: unitType.sold_as === 'bed' ? 1 : Math.min(2, unitType.capacity), unitId: Number(q.unit) }] : [],
      free: [],
    };

    main.innerHTML = `
      <h1>הזמנה חדשה</h1>
      <form data-new>
        <div class="card">
          <div class="row" style="margin-bottom:12px">
            <label class="check" style="margin:0"><input type="radio" name="kind" value="guest"${st.kind === 'guest' ? ' checked' : ''}> הזמנה של אורח</label>
            <label class="check" style="margin:0"><input type="radio" name="kind" value="block"${st.kind === 'block' ? ' checked' : ''}> חסימת יחידות (שיפוץ, שימוש פנימי)</label>
          </div>
          <div class="grid grid-3" style="gap:0 12px">
            <label class="f"><span>הגעה</span><input type="date" name="checkIn" value="${st.checkIn}" required></label>
            <label class="f"><span>עזיבה</span><input type="date" name="checkOut" value="${st.checkOut}" required></label>
            <div class="f"><span>לילות</span><b data-nights style="padding-top:8px"></b></div>
          </div>
          <h2>חדרים ומיטות</h2>
          <div data-lines></div>
          <button type="button" class="btn btn-sm" data-add-line>+ הוספת חדר או מיטה</button>
        </div>
        <div class="card" data-guest-part>
          <h2>פרטי האורח</h2>
          <div class="grid grid-2" style="gap:0 12px">
            <label class="f"><span>שם מלא *</span><input type="text" name="name" maxlength="100"></label>
            <label class="f"><span>מייל</span><input type="email" name="email" class="ltr"></label>
            <label class="f"><span>טלפון</span><input type="tel" name="phone" class="ltr"></label>
            <label class="f"><span>מדינה</span><select name="country">${countryOptions('IL')}</select></label>
            <label class="f"><span>שפת המיילים והקבלה</span><select name="lang">${Object.keys(LANGN).map((l) => `<option value="${l}">${LANGN[l]}</option>`).join('')}</select></label>
          </div>
          <div class="f"><span>מתארחים (לא חובה)</span><div data-tr-list></div><button type="button" class="link" data-tr-add>+ הוספת מתארח</button></div>
          <label class="f"><span>בקשות האורח</span><textarea name="notes"></textarea></label>
          <label class="f"><span>הערות פנימיות</span><textarea name="adminNotes"></textarea></label>
          <div class="row" style="align-items:end">
            <div class="f" style="margin:0"><span>מחיר לפי המחירון</span><b data-auto-total style="padding-top:8px"></b></div>
            <label class="f" style="margin:0"><span>מחיר אחר (לא חובה)</span><input type="number" name="total" min="0" step="0.01" style="width:160px"></label>
          </div>
          <label class="check"><input type="checkbox" name="sendEmail" checked> שליחת מייל אישור לאורח (אם יש מייל)</label>
        </div>
        <div class="card hide" data-block-part>
          <label class="f"><span>סיבת החסימה</span><input type="text" name="blockReason" maxlength="100" placeholder="לדוגמה: שיפוץ, צוות, קבוצה"></label>
        </div>
        <div class="form-bar"><button class="btn btn-primary" type="submit">שמירה</button><a class="btn" href="#/calendar">ביטול</a></div>
      </form>`;
    const form = main.querySelector('[data-new]');
    bindTravelerEditor(form);

    function freeFor(typeId) { return st.free.filter((u) => u.room_type_id === Number(typeId)); }
    function renderLines() {
      const n = Math.max(0, nights(st.checkIn, st.checkOut));
      form.querySelector('[data-nights]').textContent = n || '—';
      const box = form.querySelector('[data-lines]');
      if (!st.lines.length) box.innerHTML = '<p class="muted">עדיין לא נבחרו חדרים.</p>';
      else {
        box.innerHTML = st.lines.map((l, i) => {
          const tp = byId[l.typeId];
          const free = freeFor(l.typeId);
          const used = st.lines.filter((x, j) => j !== i && x.unitId).map((x) => x.unitId);
          return `<div class="line-item" data-line="${i}">
            <label class="f" style="margin:0"><span>סוג</span><select data-l="typeId">${types.map((t) => `<option value="${t.id}"${t.id === l.typeId ? ' selected' : ''}>${esc(pick(t.name))}${t.active ? '' : ' (לא פעיל)'}</option>`).join('')}</select></label>
            ${tp.sold_as === 'room' && st.kind === 'guest'
              ? `<label class="f" style="margin:0"><span>אורחים</span><select data-l="guests">${Array.from({ length: tp.capacity }, (_, k) => `<option value="${k + 1}"${k + 1 === l.guests ? ' selected' : ''}>${k + 1}</option>`).join('')}</select></label>`
              : '<div></div>'}
            <label class="f" style="margin:0"><span>יחידה (${free.length} פנויות)</span><select data-l="unitId"><option value="">שיבוץ אוטומטי</option>${free.filter((u) => !used.includes(u.id)).map((u) => `<option value="${u.id}"${u.id === l.unitId ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>
            <button type="button" class="btn btn-sm btn-danger" data-del-line aria-label="הסרה">✕</button></div>`;
        }).join('');
      }
      const total = st.lines.reduce((a, l) => {
        const tp = byId[l.typeId];
        const p = tp.prices || [];
        const nightly = tp.sold_as === 'bed' ? p[0] : (p[Math.min(l.guests, tp.capacity) - 1] != null ? p[Math.min(l.guests, tp.capacity) - 1] : p[p.length - 1]);
        return a + Number(nightly || 0) * n;
      }, 0);
      form.querySelector('[data-auto-total]').textContent = money(total);
    }
    async function loadFree() {
      if (!(st.checkOut > st.checkIn)) { st.free = []; renderLines(); return; }
      try {
        st.free = (await api('GET', `/free-units?checkIn=${st.checkIn}&checkOut=${st.checkOut}`)).units;
      } catch (e) { st.free = []; }
      st.lines.forEach((l) => { if (l.unitId && !st.free.some((u) => u.id === l.unitId)) l.unitId = null; });
      renderLines();
    }
    function setKind(kind) {
      st.kind = kind;
      form.querySelector('[data-guest-part]').classList.toggle('hide', kind !== 'guest');
      form.querySelector('[data-block-part]').classList.toggle('hide', kind !== 'block');
      renderLines();
    }

    form.addEventListener('change', (e) => {
      const el = e.target;
      if (el.name === 'kind') setKind(el.value);
      if (el.name === 'checkIn') {
        st.checkIn = el.value;
        if (!(st.checkOut > st.checkIn)) { st.checkOut = addDays(st.checkIn, 1); field(form, 'checkOut').value = st.checkOut; }
        loadFree();
      }
      if (el.name === 'checkOut') { st.checkOut = el.value; loadFree(); }
      const lineEl = el.closest('[data-line]');
      if (lineEl) {
        const l = st.lines[Number(lineEl.getAttribute('data-line'))];
        const k = el.getAttribute('data-l');
        if (k === 'typeId') { l.typeId = Number(el.value); l.unitId = null; l.guests = Math.min(l.guests, byId[l.typeId].capacity); }
        if (k === 'guests') l.guests = Number(el.value);
        if (k === 'unitId') l.unitId = el.value ? Number(el.value) : null;
        renderLines();
      }
    });
    form.addEventListener('click', (e) => {
      if (e.target.closest('[data-add-line]')) {
        const t = types.find((x) => x.active) || types[0];
        if (t) st.lines.push({ typeId: t.id, guests: t.sold_as === 'bed' ? 1 : Math.min(2, t.capacity), unitId: null });
        renderLines();
      }
      const del = e.target.closest('[data-del-line]');
      if (del) { st.lines.splice(Number(del.closest('[data-line]').getAttribute('data-line')), 1); renderLines(); }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      if (!st.lines.length) { toast(ERR.no_rooms, true); return; }
      if (st.kind === 'guest' && !field(form, 'name').value.trim()) { toast('יש למלא שם', true); field(form, 'name').focus(); return; }
      const body = {
        kind: st.kind,
        checkIn: st.checkIn,
        checkOut: st.checkOut,
        lines: st.lines.map((l) => ({ typeId: l.typeId, guests: l.guests, unitId: l.unitId || undefined })),
      };
      if (st.kind === 'guest') {
        Object.assign(body, {
          lang: field(form, 'lang').value,
          contact: { name: field(form, 'name').value, email: field(form, 'email').value, phone: field(form, 'phone').value, country: field(form, 'country').value },
          travelers: readTravelers(form),
          notes: field(form, 'notes').value,
          adminNotes: field(form, 'adminNotes').value,
          total: field(form, 'total').value === '' ? undefined : Number(field(form, 'total').value),
          sendEmail: field(form, 'sendEmail').checked,
        });
      } else body.blockReason = field(form, 'blockReason').value || 'חסימה';
      await run(btn, async () => {
        const r = await api('POST', '/bookings', body);
        toast('נשמר');
        location.hash = '#/booking/' + r.id;
      });
    });
    setKind(st.kind);
    loadFree();
  }

  // ---------------------------------------------------------------- rooms
  async function viewRooms(main) {
    const { types } = await api('GET', '/room-types');
    main.innerHTML = `
      <div class="row" style="margin-bottom:12px"><h1 style="margin:0">חדרים ומחירים</h1><span class="spacer"></span><a class="btn btn-primary" href="#/rooms/new">+ סוג חדר חדש</a></div>
      <p class="muted">כל סוג חדר הוא מה שהאורח מזמין באתר. בתוך כל סוג יש יחידות: חדרים (למשל ״חדר 3״) או מיטות בחדר מעונות. המערכת משבצת אוטומטית יחידה פנויה, ואפשר להחליף ידנית.</p>
      ${types.map((t) => `<div class="card type-row">
        <img src="${esc((t.photos || [])[0] || '')}" alt="">
        <div>
          <h2 style="margin-bottom:4px">${esc(pick(t.name))} ${t.active ? '' : '<span class="b">לא פעיל</span>'}</h2>
          <div class="muted small">${t.sold_as === 'bed' ? 'נמכר לפי מיטה' : `חדר עד ${t.capacity} אורחים`}${t.gender === 'male' ? ' · גברים בלבד' : t.gender === 'female' ? ' · נשים בלבד' : ''} · ${t.units.filter((u) => u.active).length} יחידות פעילות</div>
          <div class="small">${t.sold_as === 'bed' ? `${money(t.prices[0])} למיטה ללילה` : t.prices.map((p, i) => `${i + 1} אורחים: ${money(p)}`).join(' · ')}</div>
        </div>
        <div class="row"><a class="btn" href="#/rooms/${t.id}">עריכה</a></div>
      </div>`).join('')}`;
  }

  function langFields(label, key, value, opts = {}) {
    const v = value || {};
    const tag = opts.textarea ? 'textarea' : 'input';
    const one = (l) => opts.textarea
      ? `<label class="f"><span class="lang-tag">${LANGN[l]}</span><textarea data-field="${key}" data-lang="${l}" rows="${opts.rows || 3}"${l !== 'he' ? ' dir="ltr"' : ''}>${esc(v[l])}</textarea></label>`
      : `<label class="f"><span class="lang-tag">${LANGN[l]}</span><${tag} type="text" data-field="${key}" data-lang="${l}" value="${esc(v[l])}"${l !== 'he' ? ' dir="ltr"' : ''}></label>`;
    return `<div class="langs-block"><span class="lbl">${esc(label)}</span><div class="langs">${['he', 'en', 'de'].map(one).join('')}</div>${opts.help ? `<p class="help">${esc(opts.help)}</p>` : ''}</div>`;
  }
  function readLangFields(scope) {
    const out = {};
    scope.querySelectorAll('[data-field][data-lang]').forEach((el) => {
      const k = el.getAttribute('data-field');
      out[k] = out[k] || {};
      out[k][el.getAttribute('data-lang')] = el.value;
    });
    return out;
  }

  function photoManager(container, photos, onChange) {
    function draw() {
      container.innerHTML = `<div class="photos">${photos.map((p, i) => `<div class="photo">
          <img src="${esc(p)}" alt="">
          <div class="row"><button type="button" class="btn" data-ph-move="${i}" data-dir="-1" aria-label="הזזה קדימה">→</button><button type="button" class="btn" data-ph-move="${i}" data-dir="1" aria-label="הזזה אחורה">←</button><button type="button" class="btn btn-danger" data-ph-del="${i}" aria-label="מחיקה">✕</button>${i === 0 ? '<span class="b">ראשית</span>' : ''}</div>
        </div>`).join('')}</div>
        <div class="row" style="margin-top:10px">
          <label class="btn btn-sm">העלאת תמונות<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden data-ph-upload></label>
          <input type="url" placeholder="או כתובת תמונה https://" data-ph-url style="flex:1;min-width:200px"><button type="button" class="btn btn-sm" data-ph-add>הוספה</button>
        </div>`;
    }
    container.addEventListener('click', (e) => {
      const mv = e.target.closest('[data-ph-move]');
      if (mv) {
        const i = Number(mv.getAttribute('data-ph-move'));
        const j = i + Number(mv.getAttribute('data-dir'));
        if (j >= 0 && j < photos.length) { [photos[i], photos[j]] = [photos[j], photos[i]]; draw(); onChange && onChange(); }
      }
      const del = e.target.closest('[data-ph-del]');
      if (del) { photos.splice(Number(del.getAttribute('data-ph-del')), 1); draw(); onChange && onChange(); }
      if (e.target.closest('[data-ph-add]')) {
        const inp = container.querySelector('[data-ph-url]');
        if (/^https:\/\//.test(inp.value.trim())) { photos.push(inp.value.trim()); draw(); onChange && onChange(); } else toast('הכתובת צריכה להתחיל ב-https://', true);
      }
    });
    container.addEventListener('change', async (e) => {
      if (!e.target.hasAttribute('data-ph-upload')) return;
      const files = [...e.target.files];
      toast('מעלה ' + files.length + ' תמונות…');
      for (const f of files) {
        try { photos.push(await uploadImage(f)); } catch (err) { toast(err.message, true); }
      }
      draw();
      onChange && onChange();
      toast('התמונות הועלו. לא לשכוח לשמור.');
    });
    draw();
  }

  async function viewRoomEdit(main, id) {
    const { types } = await api('GET', '/room-types');
    const isNew = id === 'new';
    const t = isNew
      ? { name: {}, description: {}, note: {}, sold_as: 'room', capacity: 2, prices: [0, 0], gender: 'any', photos: [], sort: (types.length + 1) * 10, active: true, units: [] }
      : types.find((x) => String(x.id) === String(id));
    if (!t) { main.innerHTML = '<p>לא נמצא</p>'; return; }
    const photos = [...(t.photos || [])];

    main.innerHTML = `
      <p><a href="#/rooms">→ לכל החדרים</a></p>
      <h1>${isNew ? 'סוג חדר חדש' : esc(pick(t.name))}</h1>
      <form data-type-form>
        <div class="card">
          ${langFields('שם (מה שהאורח רואה)', 'name', t.name)}
          ${langFields('תיאור', 'description', t.description, { textarea: true })}
          ${langFields('הערה חשובה לפני הזמנה (לא חובה)', 'note', t.note, { help: 'לדוגמה: חדר לזוג מיועד לזוגות נשואים בלבד' })}
        </div>
        <div class="card">
          <h2>מכירה ומחיר</h2>
          <div class="row" style="margin-bottom:10px">
            <label class="check" style="margin:0"><input type="radio" name="sold_as" value="room"${t.sold_as === 'room' ? ' checked' : ''}> נמכר כחדר שלם</label>
            <label class="check" style="margin:0"><input type="radio" name="sold_as" value="bed"${t.sold_as === 'bed' ? ' checked' : ''}> נמכר לפי מיטה (חדר מעונות)</label>
          </div>
          <div class="grid grid-3" style="gap:0 12px">
            <label class="f" data-cap-wrap><span>מקסימום אורחים בחדר</span><input type="number" name="capacity" min="1" max="30" value="${t.capacity}"></label>
            <label class="f"><span>מגדר</span><select name="gender"><option value="any">כולם</option><option value="male"${t.gender === 'male' ? ' selected' : ''}>גברים בלבד</option><option value="female"${t.gender === 'female' ? ' selected' : ''}>נשים בלבד</option></select></label>
            <label class="f"><span>סדר תצוגה</span><input type="number" name="sort" value="${t.sort}"></label>
          </div>
          <div data-prices></div>
          <label class="check"><input type="checkbox" name="active"${t.active ? ' checked' : ''}> פעיל (מוצג באתר ואפשר להזמין)</label>
        </div>
        <div class="card"><h2>תמונות</h2><p class="help">התמונה הראשונה מוצגת בכרטיס החדר. תמונות שמעלים מוקטנות אוטומטית.</p><div data-photos></div></div>
        <div class="form-bar"><button class="btn btn-primary" type="submit">שמירה</button>${!isNew ? '<button type="button" class="btn btn-danger" data-del-type>מחיקת סוג החדר</button>' : ''}</div>
      </form>
      ${!isNew ? `<div class="card" style="margin-top:16px">
        <h2>יחידות (${esc(t.sold_as === 'bed' ? 'מיטות' : 'חדרים')})</h2>
        <p class="help">כל יחידה היא חדר או מיטה אחת שאפשר להזמין. יחידה לא פעילה לא תשובץ להזמנות חדשות.</p>
        <div data-units>${t.units.map((u) => `<div class="unit-row" data-unit="${u.id}">
          <input type="text" value="${esc(u.name)}" data-u-name aria-label="שם היחידה">
          <label class="check" style="margin:0"><input type="checkbox" data-u-active${u.active ? ' checked' : ''}> פעילה</label>
          <button type="button" class="btn btn-sm" data-u-save>שמירה</button>
          ${u.used ? '<span class="small muted">יש הזמנות</span>' : '<button type="button" class="btn btn-sm btn-danger" data-u-del>מחיקה</button>'}
        </div>`).join('')}</div>
        <div class="row" style="margin-top:10px"><input type="text" data-u-new placeholder="שם יחידה חדשה, למשל: חדר 11" style="flex:1"><button type="button" class="btn btn-primary btn-sm" data-u-add>הוספת יחידה</button></div>
      </div>` : ''}`;

    const form = main.querySelector('[data-type-form]');
    let prices = [...(t.prices || [])];
    function drawPrices() {
      const soldAs = form.querySelector('[name=sold_as]:checked').value;
      const cap = soldAs === 'bed' ? 1 : Math.max(1, Math.min(30, Number(field(form, 'capacity').value) || 1));
      form.querySelector('[data-cap-wrap]').classList.toggle('hide', soldAs === 'bed');
      const box = form.querySelector('[data-prices]');
      box.innerHTML = `<div class="f"><span>${soldAs === 'bed' ? 'מחיר למיטה ללילה (₪)' : 'מחיר לחדר ללילה, לפי מספר האורחים (₪)'}</span>
        <div class="row">${Array.from({ length: cap }, (_, i) => `<label class="f" style="margin:0;width:110px"><span class="small">${soldAs === 'bed' ? 'מיטה' : (i + 1) + ' אורחים'}</span><input type="number" min="0" step="1" data-price="${i}" value="${prices[i] != null ? prices[i] : prices[prices.length - 1] || ''}"></label>`).join('')}</div></div>`;
    }
    function readPrices() { prices = [...form.querySelectorAll('[data-price]')].map((el) => Number(el.value)); return prices; }
    form.addEventListener('input', (e) => { if (e.target.hasAttribute('data-price')) readPrices(); });
    form.addEventListener('change', (e) => { if (e.target.name === 'sold_as' || e.target.name === 'capacity') { readPrices(); drawPrices(); } });
    drawPrices();
    photoManager(main.querySelector('[data-photos]'), photos);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      const body = Object.assign(readLangFields(form), {
        sold_as: form.querySelector('[name=sold_as]:checked').value,
        capacity: Number(field(form, 'capacity').value),
        gender: field(form, 'gender').value,
        sort: Number(field(form, 'sort').value),
        active: field(form, 'active').checked,
        prices: readPrices(),
        photos,
      });
      await run(btn, async () => {
        if (isNew) {
          const r = await api('POST', '/room-types', body);
          toast('נשמר. עכשיו אפשר להוסיף יחידות.');
          location.hash = '#/rooms/' + r.id;
        } else {
          await api('PUT', '/room-types/' + t.id, body);
          toast('נשמר');
        }
      });
    });

    main.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.hasAttribute('data-del-type')) {
        if (!window.confirm('למחוק את סוג החדר?')) return;
        await run(btn, async () => { await api('DELETE', '/room-types/' + t.id); toast('נמחק'); location.hash = '#/rooms'; });
      }
      const row = btn.closest('[data-unit]');
      if (btn.hasAttribute('data-u-save')) {
        await run(btn, async () => {
          await api('PUT', '/units/' + row.getAttribute('data-unit'), { name: row.querySelector('[data-u-name]').value, active: row.querySelector('[data-u-active]').checked });
          toast('היחידה נשמרה');
        });
      }
      if (btn.hasAttribute('data-u-del')) {
        if (!window.confirm('למחוק את היחידה?')) return;
        await run(btn, async () => { await api('DELETE', '/units/' + row.getAttribute('data-unit')); route(); });
      }
      if (btn.hasAttribute('data-u-add')) {
        const name = main.querySelector('[data-u-new]').value.trim();
        if (!name) return;
        await run(btn, async () => { await api('POST', '/units', { typeId: t.id, name }); toast('נוספה יחידה'); route(); });
      }
    });
  }

  // ---------------------------------------------------------------- settings
  function galleryEditor(container, items) {
    function draw() {
      container.innerHTML = items.map((g, i) => `<div class="gallery-item" data-g="${i}">
        <img src="${esc(g.src)}" alt="">
        <div class="langs">${['he', 'en', 'de'].map((l) => `<label class="f"><span class="lang-tag">כיתוב – ${LANGN[l]}</span><input type="text" data-g-cap="${l}" value="${esc((g.caption || {})[l])}"${l !== 'he' ? ' dir="ltr"' : ''}></label>`).join('')}</div>
        <div class="row"><button type="button" class="btn btn-sm" data-g-move="-1" aria-label="למעלה">↑</button><button type="button" class="btn btn-sm" data-g-move="1" aria-label="למטה">↓</button><button type="button" class="btn btn-sm btn-danger" data-g-del aria-label="מחיקה">✕</button></div>
      </div>`).join('') + `<div class="row" style="margin-top:10px"><label class="btn btn-sm">העלאת תמונות<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden data-g-upload></label></div>`;
    }
    container.addEventListener('input', (e) => {
      const lang = e.target.getAttribute('data-g-cap');
      if (!lang) return;
      const g = items[Number(e.target.closest('[data-g]').getAttribute('data-g'))];
      g.caption = g.caption || {};
      g.caption[lang] = e.target.value;
    });
    container.addEventListener('click', (e) => {
      const row = e.target.closest('[data-g]');
      if (!row) return;
      const i = Number(row.getAttribute('data-g'));
      const mv = e.target.closest('[data-g-move]');
      if (mv) {
        const j = i + Number(mv.getAttribute('data-g-move'));
        if (j >= 0 && j < items.length) { [items[i], items[j]] = [items[j], items[i]]; draw(); }
      }
      if (e.target.closest('[data-g-del]')) { items.splice(i, 1); draw(); }
    });
    container.addEventListener('change', async (e) => {
      if (!e.target.hasAttribute('data-g-upload')) return;
      for (const f of [...e.target.files]) {
        try { items.push({ src: await uploadImage(f), caption: { he: '', en: '', de: '' } }); } catch (err) { toast(err.message, true); }
      }
      draw();
      toast('התמונות הועלו. לא לשכוח לשמור.');
    });
    draw();
  }

  async function viewSettings(main) {
    const { settings: s } = await api('GET', '/settings');
    const gallery = JSON.parse(JSON.stringify(s.gallery || []));
    const nearby = JSON.parse(JSON.stringify(s.nearby || []));
    const heroPhotos = s.hero_image ? [s.hero_image] : [];
    const num = (name, label, min, max) => `<label class="f"><span>${esc(label)}</span><input type="number" name="${name}" value="${esc(s[name])}" min="${min}" max="${max}"></label>`;
    const txt = (name, label, extra = '') => `<label class="f"><span>${esc(label)}</span><input type="text" name="${name}" value="${esc(s[name])}" ${extra}></label>`;

    main.innerHTML = `
      <h1>הגדרות האתר</h1>
      <form data-settings>
        <fieldset><legend>שם וטקסטים ראשיים</legend>
          ${langFields('שם האכסניה', 'site_name', s.site_name)}
          ${langFields('שורת משנה', 'site_subtitle', s.site_subtitle)}
          ${langFields('כותרת ראשית', 'hero_title', s.hero_title)}
          ${langFields('פסקת פתיחה', 'hero_text', s.hero_text, { textarea: true })}
          ${langFields('על האכסניה', 'about_text', s.about_text, { textarea: true, rows: 4 })}
          ${langFields('מיקום', 'location_text', s.location_text, { textarea: true })}
          <div class="f"><span>תמונה ראשית</span><div data-hero></div></div>
        </fieldset>
        <fieldset><legend>פרטי קשר</legend>
          ${langFields('כתובת', 'address', s.address)}
          <div class="grid grid-2" style="gap:0 12px">
            ${txt('phones', 'טלפונים (מופרדים ב-/)', 'dir="ltr"')}
            ${txt('whatsapp', 'מספר וואטסאפ (ספרות בלבד, עם 972)', 'dir="ltr"')}
            ${txt('email', 'מייל', 'dir="ltr"')}
            ${txt('facebook', 'עמוד פייסבוק', 'dir="ltr"')}
            ${txt('maps_query', 'כתובת למפה', 'dir="ltr"')}
            ${txt('notify_email', 'מייל להתראות על הזמנות חדשות', 'dir="ltr"')}
          </div>
        </fieldset>
        <fieldset><legend>כללי הזמנה ותשלום</legend>
          <div class="grid grid-3" style="gap:0 12px">
            <label class="f"><span>צ׳ק-אין מהשעה</span><input type="time" name="checkin_time" value="${esc(s.checkin_time)}"></label>
            <label class="f"><span>צ׳ק-אאוט עד השעה</span><input type="time" name="checkout_time" value="${esc(s.checkout_time)}"></label>
            ${num('cancel_hours', 'ביטול חינם עד (שעות לפני הגעה)', 0, 720)}
            ${num('min_nights', 'מינימום לילות', 1, 60)}
            ${num('max_nights', 'מקסימום לילות באתר', 1, 365)}
            ${num('max_guests_online', 'מקסימום אורחים בהזמנה באתר', 1, 60)}
            ${num('booking_window_days', 'אפשר להזמין עד (ימים קדימה)', 7, 1000)}
            ${num('hold_minutes', 'זמן שריון לתשלום (דקות)', 5, 120)}
            <label class="f"><span>מטבע</span><select name="currency">${['ILS', 'USD', 'EUR'].map((c) => `<option${c === s.currency ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
          </div>
          <label class="f"><span>אופן התשלום באתר</span><select name="payment_mode">
            <option value="paypal"${s.payment_mode === 'paypal' ? ' selected' : ''}>תשלום מלא ב-PayPal בזמן ההזמנה</option>
            <option value="paypal_or_arrival"${s.payment_mode === 'paypal_or_arrival' ? ' selected' : ''}>האורח בוחר: PayPal עכשיו או תשלום בהגעה</option>
            <option value="arrival"${s.payment_mode === 'arrival' ? ' selected' : ''}>תשלום בהגעה בלבד (בלי PayPal)</option></select></label>
          <p class="help">אם משנים את אופן התשלום, צריך לעדכן גם את סעיף התשלום בתנאי ההזמנה למטה.</p>
          <label class="f"><span>מסמך שמופק במורנינג על כל תשלום</span><select name="doc_type">
            <option value="400"${Number(s.doc_type) === 400 ? ' selected' : ''}>קבלה (לעמותה / מלכ״ר – בלי מע״מ)</option>
            <option value="320"${Number(s.doc_type) === 320 ? ' selected' : ''}>חשבונית מס / קבלה (אם יש תיק עוסק במע״מ)</option>
            <option value="0"${Number(s.doc_type) === 0 ? ' selected' : ''}>לא להפיק מסמך</option></select></label>
        </fieldset>
        <fieldset><legend>תנאי ההזמנה</legend>
          ${langFields('כל שורה היא סעיף נפרד', 'terms', s.terms, { textarea: true, rows: 14 })}
        </fieldset>
        <fieldset><legend>גלריית האכסניה</legend><div data-gallery></div></fieldset>
        <fieldset><legend>תמונות מהסביבה</legend><div data-nearby></div></fieldset>
        <div class="form-bar"><button class="btn btn-primary" type="submit">שמירת כל ההגדרות</button><a class="btn" href="/he" target="_blank" rel="noopener">צפייה באתר</a></div>
      </form>`;
    const form = main.querySelector('[data-settings]');
    photoManager(main.querySelector('[data-hero]'), heroPhotos);
    galleryEditor(main.querySelector('[data-gallery]'), gallery);
    galleryEditor(main.querySelector('[data-nearby]'), nearby);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = readLangFields(form);
      ['phones', 'whatsapp', 'email', 'facebook', 'maps_query', 'notify_email', 'checkin_time', 'checkout_time', 'currency', 'payment_mode'].forEach((k) => { body[k] = field(form, k).value; });
      ['cancel_hours', 'min_nights', 'max_nights', 'max_guests_online', 'booking_window_days', 'hold_minutes', 'doc_type'].forEach((k) => { body[k] = Number(field(form, k).value); });
      body.hero_image = heroPhotos[0] || '';
      body.gallery = gallery;
      body.nearby = nearby;
      await run(form.querySelector('button[type=submit]'), async () => { await api('PUT', '/settings', body); toast('ההגדרות נשמרו'); });
    });
  }

  // ---------------------------------------------------------------- integrations
  async function viewGroups(main) {
    const { requests } = await api('GET', '/group-requests');
    const GST = { new: ['חדשה', 'b-warn'], answered: ['נענתה', 'b-ok'], closed: ['סגורה', 'b'] };
    const LN = { en: 'אנגלית', de: 'גרמנית', ru: 'רוסית', he: 'עברית' };
    const card = (r) => {
      const st = GST[r.status] || GST.new;
      const a = String(r.arrival).slice(0, 10);
      const d = String(r.departure).slice(0, 10);
      const extra = [r.adults != null ? `${esc(r.adults)} מבוגרים` : '', r.children != null ? `${esc(r.children)} ילדים` : ''].filter(Boolean).join(' · ');
      return `<section class="card" data-req="${r.id}" style="margin-bottom:14px">
        <div class="row"><h2 style="margin:0">${esc(r.group_name)}</h2><span class="b ${st[1]}">${esc(st[0])}</span><span class="spacer"></span><span class="muted small">${esc(r.code)} · ${esc(dateTime(r.created_at))}</span></div>
        <p><b>${esc(r.contact_name)}</b> · <a class="ltr" href="mailto:${esc(r.email)}">${esc(r.email)}</a> · <a class="ltr" href="tel:${esc(String(r.phone).replace(/[^\d+]/g, ''))}">${esc(r.phone)}</a> · ${esc(LN[r.lang] || r.lang)}</p>
        <p>${esc(dmy(a))} – ${esc(dmy(d))} (${nights(a, d)} לילות) · ${esc(r.group_size)} אנשים${extra ? ' · ' + extra : ''}</p>
        ${r.needs ? `<p><b>בקשות מיוחדות:</b> <span style="white-space:pre-wrap">${esc(r.needs)}</span></p>` : ''}
        ${r.message ? `<p><b>הודעה:</b> <span style="white-space:pre-wrap">${esc(r.message)}</span></p>` : ''}
        <label class="f"><span>הערות פנימיות</span><textarea rows="2" data-notes>${esc(r.admin_notes || '')}</textarea></label>
        <div class="row">
          <button type="button" class="btn btn-sm" data-set="answered">סימון כנענתה</button>
          <button type="button" class="btn btn-sm" data-set="closed">סגירה</button>
          <button type="button" class="btn btn-sm" data-set="new">החזרה לחדשה</button>
          <button type="button" class="btn btn-sm btn-primary" data-save>שמירת הערות</button>
        </div>
      </section>`;
    };
    main.innerHTML = `
      <h1>בקשות קבוצות</h1>
      <p class="muted">בקשות שנשלחו מטופס ״קבוצות״ באתר. אין בהן תשלום ואין חסימת חדרים – חוזרים לאיש הקשר עם הצעה.</p>
      ${requests.length ? requests.map(card).join('') : '<div class="card"><p class="muted" style="margin:0">עדיין אין בקשות.</p></div>'}`;
    main.querySelectorAll('[data-req]').forEach((el) => {
      const id = el.getAttribute('data-req');
      el.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-set], [data-save]');
        if (!btn) return;
        await run(btn, async () => {
          const set = btn.getAttribute('data-set');
          await api('PATCH', '/group-requests/' + id, set ? { status: set } : { admin_notes: el.querySelector('[data-notes]').value });
          toast('נשמר');
          if (set) route();
        });
      });
    });
  }

  async function viewIntegrations(main) {
    const i = await api('GET', '/integrations');
    const st = (ok, env, liveName) => (ok ? `<span class="b ${env === liveName ? 'b-ok' : 'b-warn'}">${env === liveName ? 'מחובר – אמיתי' : 'מחובר – ניסיון'}</span>` : '<span class="b b-bad">לא מחובר</span>');
    main.innerHTML = `
      <h1>חיבורים</h1>
      <p class="muted">המפתחות נשמרים כמשתני סביבה בשרת (בקובץ .env במחשב, או ב-Variables ב-Railway), לא בדף הזה. אחרי שינוי משתנים צריך להפעיל את השרת מחדש.</p>
      ${i.demo ? '<div class="alert alert-bad"><b>מצב הדגמה פעיל (DEMO_MODE=true).</b> כל עוד PayPal לא מחובר, אפשר לסיים הזמנה עם ״תשלום הדגמה״ בלי כסף אמיתי. לפני העלייה לאוויר צריך למחוק את DEMO_MODE.</div>' : ''}
      <div class="grid grid-2">
        <section class="card">
          <div class="row"><h2 style="margin:0">PayPal</h2>${st(i.paypal.configured, i.paypal.env, 'live')}<span class="spacer"></span><button type="button" class="btn btn-sm" data-test="paypal">בדיקת חיבור</button></div>
          <ol class="small" style="padding-inline-start:18px">
            <li>נכנסים ל-developer.paypal.com עם חשבון ה-Business של העמותה.</li>
            <li>Apps &amp; Credentials ← Create App (פעם אחת ב-Sandbox לניסיון, פעם אחת ב-Live).</li>
            <li>מעתיקים את Client ID ואת Secret למשתנים <span class="ltr">PAYPAL_CLIENT_ID</span> ו-<span class="ltr">PAYPAL_CLIENT_SECRET</span>.</li>
            <li><span class="ltr">PAYPAL_ENV=sandbox</span> לניסיון, <span class="ltr">PAYPAL_ENV=live</span> לתשלומים אמיתיים.</li>
          </ol>
        </section>
        <section class="card">
          <div class="row"><h2 style="margin:0">מורנינג (חשבונית ירוקה)</h2>${st(i.morning.configured, i.morning.env, 'production')}<span class="spacer"></span><button type="button" class="btn btn-sm" data-test="morning">בדיקת חיבור</button></div>
          <ol class="small" style="padding-inline-start:18px">
            <li>צריך מסלול Best ומעלה (כולל API). סוג העסק במורנינג: עמותה.</li>
            <li>יוצרים מפתח API לפי המדריך של מורנינג (greeninvoice.co.il/help-center/api).</li>
            <li>מעתיקים למשתנים <span class="ltr">MORNING_CLIENT_ID</span> ו-<span class="ltr">MORNING_CLIENT_SECRET</span>.</li>
            <li><span class="ltr">MORNING_ENV=sandbox</span> לניסיון (חשבון נפרד בסביבת הניסוי), <span class="ltr">MORNING_ENV=production</span> לקבלות אמיתיות.</li>
            <li>לא להפעיל במורנינג את ״חיבור ל-PayPal״, אחרת כל תשלום יקבל שתי קבלות.</li>
          </ol>
        </section>
        <section class="card">
          <div class="row"><h2 style="margin:0">מיילים (Resend)</h2>${i.mail.configured ? '<span class="b b-ok">מוגדר</span>' : '<span class="b b-bad">לא מוגדר</span>'}<span class="spacer"></span><button type="button" class="btn btn-sm" data-test="mail">שליחת מייל בדיקה</button></div>
          <p class="small">מייל אישור לאורח והתראה לאכסניה על כל הזמנה. נרשמים ב-resend.com, מאמתים את הדומיין של האתר, ומגדירים <span class="ltr">RESEND_API_KEY</span> ו-<span class="ltr">MAIL_FROM</span> (למשל <span class="ltr">Bethel Hostel &lt;booking@bethel-hostel.com&gt;</span>).</p>
          ${i.mail.from ? `<p class="small muted ltr">${esc(i.mail.from)}</p>` : ''}
        </section>
        <section class="card">
          <h2>תמונות מהאתר הישן</h2>
          <p class="small">כרגע חלק מהתמונות נטענות מהאתר הישן (bethel-hostel.com). הכפתור מעתיק אותן למסד הנתונים של האתר החדש, כדי שיישארו גם אחרי שהאתר הישן ייסגר.</p>
          <button type="button" class="btn" data-import>העתקת התמונות</button>
          <p class="small muted">כתובת האתר: <span class="ltr">${esc(i.publicUrl)}</span></p>
        </section>
      </div>`;
    main.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.hasAttribute('data-test')) {
        await run(btn, async () => {
          const r = await api('POST', '/integrations/test', { which: btn.getAttribute('data-test') });
          toast(r.ok ? 'החיבור תקין ✔' : 'החיבור נכשל: ' + r.error, !r.ok);
        });
      }
      if (btn.hasAttribute('data-import')) {
        await run(btn, async () => {
          toast('מעתיק תמונות…');
          const r = await api('POST', '/import-photos', {});
          toast(`הועתקו ${r.imported} תמונות${r.errors.length ? `, ${r.errors.length} נכשלו` : ''}`, r.errors.length > 0);
        });
      }
    });
  }

  // ---------------------------------------------------------------- start
  window.addEventListener('hashchange', route);
  api('GET', '/me').then((r) => {
    if (r.authed) {
      if (!location.hash) location.hash = '#/dashboard';
      else route();
    } else showLogin();
  }).catch(() => showLogin());
})();
