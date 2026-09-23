'use strict';
// Server-rendered pages of the public website (EN at "/", Hebrew at "/he", German at "/de")
const { esc, jsonForScript, pickLang, nightsBetween } = require('./util');
const { STR, t, PAGES } = require('./i18n');

const LANGS = ['en', 'de', 'ru'];
const LANG_LABEL = { en: 'EN', de: 'DE', ru: 'РУ', he: 'עב' };

function prefix(lang) {
  return lang === 'en' ? '' : '/' + lang;
}
function url(lang, path = '') {
  return prefix(lang) + path || '/';
}

function fmtMoney(n, lang, currency = 'ILS') {
  const v = Number(n) || 0;
  return new Intl.NumberFormat(STR[lang].locale, { style: 'currency', currency, maximumFractionDigits: v % 1 ? 2 : 0 }).format(v);
}
function fmtDate(d, lang) {
  return new Intl.DateTimeFormat(STR[lang].locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(d + 'T00:00:00Z'));
}

const I = (p) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${p}</svg>`;
const ICON = {
  bed: I('<path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M3 14h18M7 9V6h4v3"/>'),
  wifi: I('<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.2" r=".9"/>'),
  lock: I('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  car: I('<path d="M5 17h14M4 13l2-5a2 2 0 0 1 2-1h8a2 2 0 0 1 2 1l2 5v4H4z"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/>'),
  phone: I('<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>'),
  chat: I('<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/>'),
  mail: I('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  pin: I('<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>'),
  clock: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  stairs: I('<path d="M3 20h5v-4h4v-4h4V8h5"/>'),
  nosmoke: I('<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8M7 13h7M17 13h0"/>'),
  people: I('<circle cx="8" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.5"/><path d="M2.5 20a5.5 5.5 0 0 1 11 0M14 20a4.5 4.5 0 0 1 7.5-3.4"/>'),
  doc: I('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>'),
  fb: I('<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v7h4v-7h3l1-4h-4V8z"/>'),
  check: I('<path d="m5 12 4.5 4.5L19 7"/>'),
};

const LOGO = `<svg class="logo-mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 30V19a8 8 0 0 1 16 0v11" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 30h22" stroke="currentColor" stroke-width="1.8"/><path d="M20 12v8M16.5 15.5h7" stroke="currentColor" stroke-width="1.5"/></svg>`;

function langSwitch(ctx) {
  return LANGS.map((l) => {
    const cur = l === ctx.lang;
    return `<a href="${esc(url(l, ctx.path))}" hreflang="${l}" lang="${l}"${cur ? ' aria-current="true" class="on"' : ''} title="${esc(STR[l].langName)}">${LANG_LABEL[l]}</a>`;
  }).join('');
}

function layout(ctx, { title, description, body, scripts = [], data = null, bodyClass = '', noindex = false }) {
  const { lang, s } = ctx;
  const L = STR[lang];
  const site = pickLang(s.site_name, lang);
  const fullTitle = title ? `${title} · ${site}` : `${site} – ${pickLang(s.site_subtitle, lang)}`;
  const desc = description || pickLang(s.hero_text, lang);
  const abs = (p) => (ctx.origin || '') + p;
  const alternates = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(abs(url(l, ctx.path)))}">`).join('\n')
    + `\n<link rel="alternate" hreflang="x-default" href="${esc(abs(url('en', ctx.path)))}">`;
  const home = url(lang);
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="${lang}" dir="${L.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc.slice(0, 300))}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(abs(url(lang, ctx.path)))}">\n${alternates}`}
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc.slice(0, 300))}">
<meta property="og:image" content="${esc(/^https?:/.test(s.hero_image) ? s.hero_image : abs(s.hero_image))}">
<meta property="og:type" content="website">
<meta name="theme-color" content="#2c2217">
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700&family=Heebo:wght@400;500;700&display=swap">
<link rel="stylesheet" href="/css/site.css?v=${ctx.version}">
</head>
<body class="${esc(bodyClass)}">
<a class="skip" href="#main">${esc(L.skip)}</a>
<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="${esc(home)}">${LOGO}<span class="brand-text"><span class="brand-name">${esc(site)}</span><span class="brand-sub">${esc(pickLang(s.site_subtitle, lang))}</span></span></a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span class="bars" aria-hidden="true"></span><span class="sr">${esc(L.menu)}</span></button>
    <nav id="site-nav" class="site-nav" aria-label="${esc(L.menu)}">
      <a href="${esc(url(lang, '/rooms'))}">${esc(L.nav_rooms)}</a>
      <a href="${esc(home)}#hostel">${esc(L.nav_hostel)}</a>
      <a href="${esc(home)}#location">${esc(L.nav_location)}</a>
      <a href="${esc(home)}#contact">${esc(L.nav_contact)}</a>
      <span class="lang-switch" role="group" aria-label="Language">${langSwitch(ctx)}</span>
      <a class="btn btn-accent nav-cta" href="${esc(url(lang, '/book'))}">${esc(L.nav_book)}</a>
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer" id="contact-footer">
  <div class="container footer-grid">
    <div>
      <p class="footer-name">${esc(site)}</p>
      <p>${esc(pickLang(s.site_subtitle, lang))}</p>
      <p class="muted">${esc(L.nonprofit)}</p>
    </div>
    <div>
      <p>${ICON.pin}<span>${esc(pickLang(s.address, lang))}</span></p>
      <p>${ICON.phone}<span dir="ltr">${esc(s.phones)}</span></p>
      <p>${ICON.mail}<a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p>
    </div>
    <div class="footer-links">
      <a href="${esc(url(lang, '/terms'))}">${esc(L.nav_terms)}</a>
      <a href="${esc(url(lang, '/privacy'))}">${esc(L.nav_privacy)}</a>
      <a href="${esc(url(lang, '/accessibility'))}">${esc(L.nav_access)}</a>
      <span class="lang-switch" role="group" aria-label="Language">${langSwitch(ctx)}</span>
    </div>
  </div>
  <div class="container copyright">© ${year} ${esc(site)}</div>
</footer>
${data ? `<script type="application/json" id="app-data">${jsonForScript(data)}</script>` : ''}
<script src="/js/site.js?v=${ctx.version}" defer></script>
${scripts.map((src) => `<script src="${esc(src)}?v=${ctx.version}" defer></script>`).join('\n')}
</body>
</html>`;
}

// ------------------------------------------------------------ pieces

function priceSummary(type, lang, currency) {
  const L = STR[lang];
  const prices = (type.prices || []).map(Number).filter((n) => n > 0);
  if (!prices.length) return '';
  if (type.sold_as === 'bed') return `<b>${esc(fmtMoney(prices[0], lang, currency))}</b> <span>${esc(L.per_bed_night)}</span>`;
  const min = Math.min(...prices);
  const same = prices.every((p) => p === prices[0]);
  return `${same ? '' : `<span>${esc(L.from)}</span>`}<b>${esc(fmtMoney(min, lang, currency))}</b> <span>${esc(L.per_night)}</span>`;
}

function typeBadges(type, lang) {
  const L = STR[lang];
  const b = [];
  if (type.gender === 'male') b.push(`<span class="badge">${esc(L.men_only)}</span>`);
  if (type.gender === 'female') b.push(`<span class="badge">${esc(L.women_only)}</span>`);
  if (type.sold_as === 'room') b.push(`<span class="badge badge-soft">${ICON.people}${esc(t(lang, 'up_to', { n: type.capacity }))}</span>`);
  return b.join('');
}

function roomCard(ctx, type) {
  const { lang, s } = ctx;
  const L = STR[lang];
  const photo = (type.photos || [])[0];
  const name = pickLang(type.name, lang);
  return `<article class="room-card">
  <a class="room-photo" href="${esc(url(lang, '/rooms'))}#room-${type.id}">${photo ? `<img src="${esc(photo)}" alt="${esc(name)}" loading="lazy">` : ''}</a>
  <div class="room-body">
    <div class="badges">${typeBadges(type, lang)}</div>
    <h3>${esc(name)}</h3>
    <p class="room-desc">${esc(pickLang(type.description, lang))}</p>
    <div class="room-foot">
      <p class="price">${priceSummary(type, lang, s.currency)}</p>
      <a class="btn btn-accent btn-sm" href="${esc(url(lang, '/book'))}?type=${type.id}">${esc(L.book)}</a>
    </div>
  </div>
</article>`;
}

function gallery(items, lang, cls = '') {
  return `<div class="gallery ${cls}">${items.map((g) => {
    const cap = pickLang(g.caption, lang);
    return `<a class="gallery-item" href="${esc(g.src)}" data-lightbox data-caption="${esc(cap)}"><img src="${esc(g.src)}" alt="${esc(cap)}" loading="lazy"><span class="cap">${esc(cap)}</span></a>`;
  }).join('')}</div>`;
}

function contactBlock(ctx) {
  const { lang, s } = ctx;
  const L = STR[lang];
  const phones = String(s.phones || '').split('/').map((p) => p.trim()).filter(Boolean);
  return `<section class="section contact" id="contact">
  <div class="container contact-inner">
    <h2>${esc(L.contact_title)}</h2>
    <div class="contact-actions">
      ${phones.map((p) => `<a class="contact-pill" href="tel:${esc(p.replace(/[^\d+]/g, ''))}">${ICON.phone}<span dir="ltr">${esc(p)}</span></a>`).join('')}
      ${s.whatsapp ? `<a class="contact-pill" href="https://wa.me/${esc(String(s.whatsapp).replace(/\D/g, ''))}" rel="noopener" target="_blank">${ICON.chat}<span>${esc(L.whatsapp)}</span></a>` : ''}
      ${s.email ? `<a class="contact-pill" href="mailto:${esc(s.email)}">${ICON.mail}<span>${esc(s.email)}</span></a>` : ''}
      ${s.facebook ? `<a class="contact-pill" href="${esc(s.facebook)}" rel="noopener" target="_blank">${ICON.fb}<span>${esc(L.facebook)}</span></a>` : ''}
    </div>
  </div>
</section>`;
}

// ------------------------------------------------------------ pages

function home(ctx, types) {
  const { lang, s } = ctx;
  const L = STR[lang];
  const q = encodeURIComponent(s.maps_query || '');
  const demo = booking.demoMode() ? `<div style="background:#ff9800;color:#000;padding:12px;text-align:center;font-weight:bold;margin-bottom:0;border-bottom:2px solid #e67e22;">🚀 DEMO MODE – This is a test site. Payments are simulated.</div>` : '';
  const body = `${demo}
<section class="hero" style="--hero:url('${esc(String(s.hero_image || '').replace(/'/g, '%27'))}')">
  <div class="container hero-inner">
    <p class="eyebrow">${esc(pickLang(s.site_subtitle, lang))}</p>
    <h1>${esc(pickLang(s.hero_title, lang))}</h1>
    <p class="hero-text">${esc(pickLang(s.hero_text, lang))}</p>
    <form class="quick-book" action="${esc(url(lang, '/book'))}" method="get">
      <label><span>${esc(L.check_in)}</span><input type="date" name="in" required data-date="in"></label>
      <label><span>${esc(L.check_out)}</span><input type="date" name="out" required data-date="out"></label>
      <button class="btn btn-accent" type="submit">${esc(L.check_availability)}</button>
    </form>
  </div>
</section>

<section class="features" aria-label="${esc(L.nav_hostel)}">
  <div class="container features-inner">
    <p>${ICON.bed}<span>${esc(L.f_linens)}</span></p>
    <p>${ICON.wifi}<span>${esc(L.f_wifi)}</span></p>
    <p>${ICON.lock}<span>${esc(L.f_safe)}</span></p>
    <p>${ICON.car}<span>${esc(L.f_parking)}</span></p>
  </div>
</section>

<section class="section" id="rooms">
  <div class="container">
    <div class="section-head">
      <h2>${esc(L.rooms_title)}</h2>
      <p>${esc(L.rooms_sub)}</p>
    </div>
    <div class="room-grid">${types.map((tp) => roomCard(ctx, tp)).join('')}</div>
    <p class="center"><a class="link-arrow" href="${esc(url(lang, '/rooms'))}">${esc(L.view_all_rooms)}</a></p>
  </div>
</section>

<section class="section section-sand" id="hostel">
  <div class="container">
    <div class="section-head">
      <h2>${esc(L.hostel_title)}</h2>
      <p>${esc(pickLang(s.about_text, lang))}</p>
    </div>
    ${gallery(s.gallery || [], lang)}
  </div>
</section>

<section class="section" id="location">
  <div class="container location-grid">
    <div>
      <h2>${esc(L.location_title)}</h2>
      <p>${esc(pickLang(s.location_text, lang))}</p>
      <p class="address">${ICON.pin}<span>${esc(pickLang(s.address, lang))}</span></p>
      <p class="btn-row">
        <a class="btn btn-ghost btn-sm" href="https://www.google.com/maps/search/?api=1&amp;query=${esc(q)}" target="_blank" rel="noopener">${esc(L.open_google)}</a>
        <a class="btn btn-ghost btn-sm" href="https://waze.com/ul?q=${esc(q)}&amp;navigate=yes" target="_blank" rel="noopener">${esc(L.open_waze)}</a>
      </p>
      <div class="good">
        <h3>${esc(L.good_to_know)}</h3>
        <ul class="facts">
          <li>${ICON.clock}<span>${esc(t(lang, 'checkin_from', { t: s.checkin_time }))} · ${esc(t(lang, 'checkout_until', { t: s.checkout_time }))}</span></li>
          <li>${ICON.people}<span>${esc(L.rule_dorms)}</span></li>
          <li>${ICON.nosmoke}<span>${esc(L.rule_smoke)}</span></li>
          <li>${ICON.stairs}<span>${esc(L.rule_stairs)}</span></li>
          <li>${ICON.doc}<a href="${esc(url(lang, '/terms'))}">${esc(L.rule_terms)}</a></li>
        </ul>
      </div>
    </div>
    <div>
      <div class="map" data-map-src="https://maps.google.com/maps?q=${esc(q)}&amp;hl=${lang}&amp;z=16&amp;output=embed">
        <button class="btn btn-ghost" type="button" data-show-map>${ICON.pin}<span>${esc(L.show_map)}</span></button>
        <p class="muted small">${esc(L.map_note)}</p>
      </div>
      ${(s.nearby || []).length ? `<h3 class="nearby-title">${esc(L.nearby_title)}</h3>${gallery(s.nearby, lang, 'gallery-2')}` : ''}
    </div>
  </div>
</section>
${contactBlock(ctx)}`;
  return layout(ctx, { body, bodyClass: 'page-home' });
}

function roomsPage(ctx, types) {
  const { lang, s } = ctx;
  const L = STR[lang];
  const body = `
<section class="page-head"><div class="container"><h1>${esc(L.rooms_title)}</h1><p>${esc(L.rooms_sub)}</p></div></section>
<section class="section section-tight">
  <div class="container room-list">
  ${types.map((tp) => {
    const name = pickLang(tp.name, lang);
    const photos = tp.photos || [];
    const prices = (tp.prices || []).map(Number);
    const rows = tp.sold_as === 'bed'
      ? `<tr><td>${esc(STR[lang].bed_1)}</td><td>${esc(fmtMoney(prices[0] || 0, lang, s.currency))}</td></tr>`
      : prices.slice(0, tp.capacity).map((p, i) => `<tr><td>${esc(i === 0 ? L.one_guest : t(lang, 'n_guests', { n: i + 1 }))}</td><td>${esc(fmtMoney(p, lang, s.currency))}</td></tr>`).join('');
    const note = pickLang(tp.note, lang);
    return `<article class="room-row" id="room-${tp.id}">
    <div class="room-gallery">
      ${photos.length ? `<a class="main-photo" href="${esc(photos[0])}" data-lightbox data-caption="${esc(name)}"><img src="${esc(photos[0])}" alt="${esc(name)}" loading="lazy"></a>` : ''}
      ${photos.length > 1 ? `<div class="thumbs">${photos.slice(1).map((p) => `<a href="${esc(p)}" data-lightbox data-caption="${esc(name)}"><img src="${esc(p)}" alt="" loading="lazy"></a>`).join('')}</div>` : ''}
    </div>
    <div class="room-info">
      <div class="badges">${typeBadges(tp, lang)}</div>
      <h2>${esc(name)}</h2>
      <p>${esc(pickLang(tp.description, lang))}</p>
      ${note ? `<p class="note">${esc(note)}</p>` : ''}
      <table class="price-table"><caption>${esc(L.prices_title)}</caption><tbody>${rows}</tbody></table>
      <a class="btn btn-accent" href="${esc(url(lang, '/book'))}?type=${tp.id}">${esc(L.book)}</a>
    </div>
  </article>`;
  }).join('')}
  </div>
</section>
${contactBlock(ctx)}`;
  return layout(ctx, { title: L.rooms_title, body, bodyClass: 'page-rooms' });
}

function bookPage(ctx, config) {
  const L = STR[ctx.lang];
  const body = `
<section class="page-head page-head-sm"><div class="container"><h1>${esc(L.book_title)}</h1></div></section>
<section class="section section-tight">
  <div class="container">
    <div id="book-app" class="book-app" data-mode="new"><noscript><p class="alert">JavaScript is required to book online. ${esc(ctx.s.phones)} · ${esc(ctx.s.email)}</p></noscript></div>
  </div>
</section>`;
  return layout(ctx, { title: L.book_title, body, data: config, scripts: ['/js/book.js'], bodyClass: 'page-book' });
}

function groupLines(lines, lang) {
  const groups = new Map();
  for (const l of lines) {
    const name = pickLang(l.typeName, lang);
    const key = `${name}|${l.soldAs}|${l.guests}`;
    const g = groups.get(key) || { name, soldAs: l.soldAs, guests: l.guests, count: 0 };
    g.count += 1;
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => (g.soldAs === 'bed'
    ? `${g.count} × ${g.name}`
    : `${g.count} × ${g.name} (${g.guests === 1 ? STR[lang].one_guest : t(lang, 'n_guests', { n: g.guests })})`));
}

function bookingPage(ctx, { b, lines, payments, isNew, config, notified }) {
  const { lang, s } = ctx;
  const L = STR[lang];
  const nights = nightsBetween(b.check_in, b.check_out);
  const due = Math.max(0, Number(b.total) - Number(b.paid));
  const pendingActive = b.status === 'pending' && new Date(b.expires_at) > new Date();
  const statusKey = b.status === 'pending' && !pendingActive ? 'expired' : b.status;
  const receipts = payments.filter((p) => p.doc_url && Number(p.amount) > 0);
  const travelers = Array.isArray(b.travelers) ? b.travelers : [];

  let banner = '';
  if (isNew && b.status === 'confirmed') {
    banner = `<div class="alert alert-ok">${ICON.check}<div><b>${esc(L.bk_thanks)}</b>${b.email && notified ? `<br>${esc(t(lang, 'bk_thanks_sub', { email: b.email }))}` : ''}</div></div>`;
  } else if (statusKey === 'expired') {
    banner = `<div class="alert">${esc(L.bk_expired_text)} <a href="${esc(url(lang, '/book'))}?in=${esc(b.check_in)}&amp;out=${esc(b.check_out)}">${esc(L.bk_search_again)}</a></div>`;
  } else if (b.status === 'cancelled') {
    banner = `<div class="alert">${esc(L.bk_cancelled_text)}</div>`;
  }

  const body = `
<section class="page-head page-head-sm"><div class="container"><h1>${esc(L.bk_title)}</h1></div></section>
<section class="section section-tight">
  <div class="container booking-view">
    ${banner}
    <div class="booking-card">
      <div class="booking-card-head">
        <div><span class="muted">${esc(L.bk_code)}</span><div class="code">${esc(b.code)}</div></div>
        <span class="status status-${esc(statusKey)}">${esc(L['st_' + statusKey] || statusKey)}</span>
      </div>
      <dl class="kv">
        <dt>${esc(L.bk_dates)}</dt>
        <dd>${esc(fmtDate(b.check_in, lang))} → ${esc(fmtDate(b.check_out, lang))} <span class="muted">(${esc(nights === 1 ? L.bk_night : t(lang, 'bk_nights', { n: nights }))})</span><br>
          <span class="muted">${esc(t(lang, 'checkin_from', { t: s.checkin_time }))} · ${esc(t(lang, 'checkout_until', { t: s.checkout_time }))}</span></dd>
        <dt>${esc(L.bk_rooms)}</dt><dd>${groupLines(lines, lang).map(esc).join('<br>')}</dd>
        ${travelers.length ? `<dt>${esc(L.bk_guests)}</dt><dd>${travelers.map((x) => esc(x.name)).join('<br>')}</dd>` : ''}
        <dt>${esc(L.bk_total)}</dt><dd><b>${esc(fmtMoney(b.total, lang, b.currency))}</b></dd>
        ${Number(b.paid) ? `<dt>${esc(L.bk_paid)}</dt><dd>${esc(fmtMoney(b.paid, lang, b.currency))}</dd>` : ''}
        ${b.status === 'confirmed' && due > 0 ? `<dt>${esc(L.bk_due)}</dt><dd><b>${esc(fmtMoney(due, lang, b.currency))}</b></dd>` : ''}
        ${receipts.length ? `<dt>${esc(L.bk_receipt)}</dt><dd>${receipts.map((p) => `<a href="${esc(p.doc_url)}" target="_blank" rel="noopener">${ICON.doc}${esc(t(lang, 'bk_download', { n: p.doc_number }))}</a>`).join('<br>')}</dd>` : ''}
        <dt>${esc(L.bk_arrival)}</dt><dd>${esc(pickLang(s.address, lang))}</dd>
      </dl>
    </div>
    ${pendingActive ? '<div id="book-app" class="book-app" data-mode="resume"></div>' : ''}
    ${b.status === 'confirmed' ? `<p class="muted">${esc(t(lang, 'bk_cancel_text', { h: s.cancel_hours }))}</p><p><button class="btn btn-ghost btn-sm" type="button" data-print>${esc(L.bk_print)}</button></p>` : ''}
  </div>
</section>
${contactBlock(ctx)}`;
  return layout(ctx, {
    title: L.bk_title, body, noindex: true, bodyClass: 'page-booking',
    data: pendingActive ? config : null, scripts: pendingActive ? ['/js/book.js'] : [],
  });
}

function termsPage(ctx) {
  const { lang, s } = ctx;
  const L = STR[lang];
  const items = pickLang(s.terms, lang).split('\n').map((x) => x.trim()).filter(Boolean);
  const body = `
<section class="page-head page-head-sm"><div class="container"><h1>${esc(L.terms_title)}</h1></div></section>
<section class="section section-tight"><div class="container prose"><ol class="terms">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div></section>`;
  return layout(ctx, { title: L.terms_title, body });
}

function textPage(ctx, key) {
  const { lang, s } = ctx;
  const L = STR[lang];
  const title = key === 'privacy' ? L.privacy_title : L.access_title;
  const vars = { org: pickLang(s.site_name, lang), email: s.email, phone: s.phones, address: pickLang(s.address, lang) };
  const paras = (PAGES[key][lang] || PAGES[key].en).map((p) => p.replace(/\{(\w+)\}/g, (_, k) => vars[k] || ''));
  const body = `
<section class="page-head page-head-sm"><div class="container"><h1>${esc(title)}</h1></div></section>
<section class="section section-tight"><div class="container prose">${paras.map((p) => `<p>${esc(p)}</p>`).join('')}</div></section>`;
  return layout(ctx, { title, body });
}

function notFound(ctx) {
  const L = STR[ctx.lang];
  const body = `<section class="page-head"><div class="container"><h1>${esc(L.not_found)}</h1><p><a class="btn btn-accent" href="${esc(url(ctx.lang))}">${esc(L.back_home)}</a></p></div></section>`;
  return layout(ctx, { title: L.not_found, body, noindex: true });
}

module.exports = { LANGS, url, prefix, fmtMoney, home, roomsPage, bookPage, bookingPage, termsPage, textPage, notFound };
