'use strict';
// Reusable building blocks of the public website. Every function returns an HTML string.
const { esc, pickLang, addDays, todayIL } = require('../util');
const { STR, t } = require('../i18n');
const { icon, LOGO } = require('./icons');
const { picture } = require('./photos');

const LANGS = ['en', 'de', 'ru'];
const LANG_SHORT = { en: 'EN', de: 'DE', ru: 'RU', he: 'HE' };

function prefix(lang) { return lang === 'en' ? '' : '/' + lang; }
function url(lang, path = '') { return prefix(lang) + path || '/'; }

function fmtMoney(n, lang, currency = 'ILS') {
  const v = Number(n) || 0;
  return new Intl.NumberFormat(STR[lang].locale, { style: 'currency', currency, maximumFractionDigits: v % 1 ? 2 : 0 }).format(v);
}

// ------------------------------------------------------------------ room facts
// Structured facts per room type (by slug). Room types added later in the admin panel fall back to their text only.
const ROOM_FACTS = {
  'dorm-women': { beds: 6, bunks: true, bath: 'shared', kitchen: 'shared', linens: true },
  'dorm-men': { beds: 6, bunks: true, bath: 'shared', kitchen: 'shared', linens: true },
  studio: { bath: 'private', kitchen: 'private', family: true, kidsFree: true, linens: true },
};

function roomKey(type) { return type.slug || String(type.id); }
function roomUrl(lang, type) { return url(lang, '/rooms/' + encodeURIComponent(roomKey(type))); }

function roomFacts(type, lang) {
  const f = ROOM_FACTS[type.slug] || {};
  const out = [];
  if (f.beds) out.push(['bunk', t(lang, 'f_beds_room', { n: f.beds })]);
  else if (type.sold_as === 'room') out.push(['users', f.family ? t(lang, 'f_sleeps_family') : t(lang, 'f_sleeps', { n: type.capacity })]);
  if (f.bath) out.push(['bath', t(lang, f.bath === 'private' ? 'f_bath_private' : 'f_bath_shared')]);
  if (f.kitchen) out.push(['kitchen', t(lang, f.kitchen === 'private' ? 'f_kitchenette' : 'f_kitchen_shared')]);
  if (f.linens) out.push(['towel', t(lang, 'am_linens')]);
  if (f.kidsFree) out.push(['heart', t(lang, 'f_kids_free')]);
  return out;
}

function genderLabel(type, lang) {
  if (type.gender === 'female') return t(lang, 'f_women');
  if (type.gender === 'male') return t(lang, 'f_men');
  return '';
}

function priceLine(type, lang, currency) {
  const prices = (type.prices || []).map(Number).filter((n) => n > 0);
  if (!prices.length) return '';
  const min = Math.min(...prices);
  const perBed = type.sold_as === 'bed';
  const from = !perBed && !prices.every((p) => p === prices[0]);
  return `<p class="price">${from ? `<span class="price__from">${esc(t(lang, 'room_from'))}</span>` : ''}<b class="price__amount">${esc(fmtMoney(min, lang, currency))}</b><span class="price__unit">${esc(t(lang, perBed ? 'room_per_bed' : 'room_per_night'))}</span></p>`;
}

// Price rows grouped by equal price: "1 guest ₪300", "2–4 guests ₪600"
function priceRows(type, lang, currency) {
  const prices = (type.prices || []).map(Number);
  if (type.sold_as === 'bed') return [[t(lang, 'bed_1'), fmtMoney(prices[0] || 0, lang, currency)]];
  const rows = [];
  let start = 0;
  const cap = Math.min(type.capacity, prices.length || 1);
  for (let i = 1; i <= cap; i++) {
    if (i === cap || prices[i] !== prices[start]) {
      const a = start + 1;
      const b = i;
      const label = a === b ? (a === 1 ? t(lang, 'one_guest') : t(lang, 'n_guests', { n: a })) : t(lang, 'rd_guests_range', { a, b });
      rows.push([label, fmtMoney(prices[start], lang, currency)]);
      start = i;
    }
  }
  return rows;
}

// ------------------------------------------------------------------ header, menus, footer
function langLinks(ctx, cls) {
  return LANGS.map((l) => `<a class="${cls}" href="${esc(url(l, ctx.path))}" hreflang="${l}" lang="${l}"${l === ctx.lang ? ' aria-current="true"' : ''}><span class="lang-code">${LANG_SHORT[l]}</span><span class="lang-name">${esc(STR[l].langName)}</span></a>`).join('');
}

function navItems(ctx) {
  const { lang } = ctx;
  return [
    ['/rooms', 'nav_stay'], ['/house', 'nav_house'], ['/groups', 'nav_groups'], ['/location', 'nav_location'], ['/contact', 'nav_contact'],
  ].map(([p, k]) => ({ href: url(lang, p), label: t(lang, k), current: ctx.path === p || ctx.path.startsWith(p + '/') }));
}

function header(ctx, { overlay = false } = {}) {
  const { lang, s } = ctx;
  const site = pickLang(s.site_name, lang);
  const items = navItems(ctx);
  return `<header class="site-header${overlay ? ' is-overlay' : ''}" data-header>
  ${demoRibbon(ctx)}
  <div class="container site-header__inner">
    <a class="brand" href="${esc(url(lang))}" aria-label="${esc(site)}">${LOGO}<span class="brand__text"><span class="brand__name">Bethel</span><span class="brand__place">Haifa</span></span></a>
    <nav class="nav" aria-label="${esc(t(lang, 'menu'))}">
      ${items.map((i) => `<a class="nav__link" href="${esc(i.href)}"${i.current ? ' aria-current="page"' : ''}>${esc(i.label)}</a>`).join('')}
    </nav>
    <div class="site-header__actions">
      <details class="lang-menu" data-lang-menu>
        <summary class="lang-menu__toggle" aria-label="${esc(t(lang, 'language'))}">${icon('globe')}<span>${LANG_SHORT[lang]}</span>${icon('chevronDown', 'ico-sm')}</summary>
        <div class="lang-menu__list">${langLinks(ctx, 'lang-menu__item')}</div>
      </details>
      <a class="btn btn-primary btn-sm site-header__cta" href="${esc(url(lang, '/book'))}">${esc(t(lang, 'nav_book'))}</a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="menu-sheet" data-menu-open>${icon('menu')}<span class="sr-only">${esc(t(lang, 'open_menu'))}</span></button>
    </div>
  </div>
</header>
${mobileMenu(ctx, items)}`;
}

function mobileMenu(ctx, items) {
  const { lang, s } = ctx;
  const wa = String(s.whatsapp || '').replace(/\D/g, '');
  const phone = String(s.phones || '').split('/')[0].trim();
  return `<div class="menu-sheet" id="menu-sheet" role="dialog" aria-modal="true" aria-label="${esc(t(lang, 'menu'))}" hidden data-menu>
  <div class="menu-sheet__top">
    <a class="brand" href="${esc(url(lang))}">${LOGO}<span class="brand__text"><span class="brand__name">Bethel</span><span class="brand__place">Haifa</span></span></a>
    <button class="menu-toggle" type="button" data-menu-close>${icon('close')}<span class="sr-only">${esc(t(lang, 'close_menu'))}</span></button>
  </div>
  <nav class="menu-sheet__nav" aria-label="${esc(t(lang, 'menu'))}">
    ${items.map((i, n) => `<a href="${esc(i.href)}"${i.current ? ' aria-current="page"' : ''} style="--i:${n}"><span>${esc(i.label)}</span>${icon('arrowRight')}</a>`).join('')}
  </nav>
  <a class="btn btn-primary btn-lg btn-block" href="${esc(url(lang, '/book'))}">${esc(t(lang, 'nav_book'))}</a>
  <div class="menu-sheet__foot">
    <div class="menu-sheet__contact">
      ${wa ? `<a href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">${icon('chat')}<span>${esc(t(lang, 'whatsapp'))}</span></a>` : ''}
      ${phone ? `<a href="tel:${esc(phone.replace(/[^\d+]/g, ''))}">${icon('phone')}<span>${esc(t(lang, 'call'))}</span></a>` : ''}
      ${s.email ? `<a href="mailto:${esc(s.email)}">${icon('mail')}<span>${esc(t(lang, 'email'))}</span></a>` : ''}
    </div>
    <div class="menu-sheet__langs" role="group" aria-label="${esc(t(lang, 'language'))}">${langLinks(ctx, 'lang-pill')}</div>
  </div>
</div>`;
}

function demoRibbon(ctx) {
  if (!require('../booking').demoMode()) return '';
  return `<div class="demo-ribbon" role="note">${icon('info', 'ico-sm')}<span>${esc(t(ctx.lang, 'demo_banner'))}</span></div>`;
}

function footer(ctx) {
  const { lang, s } = ctx;
  const site = pickLang(s.site_name, lang);
  const phones = String(s.phones || '').split('/').map((p) => p.trim()).filter(Boolean);
  const year = new Date().getFullYear();
  return `<footer class="site-footer">
  <div class="container site-footer__grid">
    <div class="site-footer__brand">
      <a class="brand brand--light" href="${esc(url(lang))}">${LOGO}<span class="brand__text"><span class="brand__name">Bethel</span><span class="brand__place">Haifa</span></span></a>
      <p>${esc(t(lang, 'footer_tagline'))}</p>
      <p class="site-footer__muted">${esc(t(lang, 'nonprofit'))}</p>
    </div>
    <nav class="site-footer__col" aria-label="${esc(t(lang, 'footer_explore'))}">
      <h2 class="site-footer__title">${esc(t(lang, 'footer_explore'))}</h2>
      ${navItems(ctx).map((i) => `<a href="${esc(i.href)}">${esc(i.label)}</a>`).join('')}
      <a href="${esc(url(lang, '/book'))}">${esc(t(lang, 'nav_book'))}</a>
    </nav>
    <div class="site-footer__col">
      <h2 class="site-footer__title">${esc(t(lang, 'nav_contact'))}</h2>
      <p class="site-footer__line">${icon('pin')}<span>${esc(pickLang(s.address, lang))}</span></p>
      ${phones.map((p) => `<a class="site-footer__line" href="tel:${esc(p.replace(/[^\d+]/g, ''))}">${icon('phone')}<span dir="ltr">${esc(p)}</span></a>`).join('')}
      ${s.email ? `<a class="site-footer__line" href="mailto:${esc(s.email)}">${icon('mail')}<span>${esc(s.email)}</span></a>` : ''}
      ${s.facebook ? `<a class="site-footer__line" href="${esc(s.facebook)}" target="_blank" rel="noopener">${icon('facebook')}<span>${esc(t(lang, 'facebook'))}</span></a>` : ''}
    </div>
    <div class="site-footer__col">
      <h2 class="site-footer__title">${esc(t(lang, 'footer_legal'))}</h2>
      <a href="${esc(url(lang, '/terms'))}">${esc(t(lang, 'nav_terms'))}</a>
      <a href="${esc(url(lang, '/privacy'))}">${esc(t(lang, 'nav_privacy'))}</a>
      <a href="${esc(url(lang, '/accessibility'))}">${esc(t(lang, 'nav_access'))}</a>
      <div class="site-footer__langs" role="group" aria-label="${esc(t(lang, 'language'))}">${langLinks(ctx, 'lang-pill lang-pill--dark')}</div>
    </div>
  </div>
  <div class="container site-footer__bottom"><span>© ${year} ${esc(site)}</span></div>
</footer>`;
}

// ------------------------------------------------------------------ search (dates + guests)
function searchBar(ctx, { variant = 'hero', action = '/book', values = {}, hidden = {}, submitLabel } = {}) {
  const { lang, s } = ctx;
  const id = variant + '-' + Math.random().toString(36).slice(2, 7);
  const today = todayIL();
  const max = addDays(today, s.booking_window_days || 365);
  const maxGuests = s.max_guests_online || 14;
  const guests = Math.min(maxGuests, Math.max(1, Number(values.guests) || 2));
  return `<form class="search search--${esc(variant)}" action="${esc(url(lang, action))}" method="get" data-search>
  ${Object.entries(hidden).filter(([, v]) => v != null && v !== '').map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('')}
  <div class="search__dates" data-daterange data-min="${esc(today)}" data-max="${esc(max)}" data-min-nights="${esc(s.min_nights || 1)}" data-max-nights="${esc(s.max_nights || 30)}">
    <div class="search__field">
      <label class="search__label" for="${id}-in">${esc(t(lang, 'check_in'))}</label>
      <input class="search__input" id="${id}-in" type="date" name="in" min="${esc(today)}" max="${esc(max)}" value="${esc(values.in || '')}" data-date-in>
    </div>
    <div class="search__field">
      <label class="search__label" for="${id}-out">${esc(t(lang, 'check_out'))}</label>
      <input class="search__input" id="${id}-out" type="date" name="out" min="${esc(addDays(today, 1))}" value="${esc(values.out || '')}" data-date-out>
    </div>
  </div>
  <div class="search__field search__guests">
    <label class="search__label" for="${id}-guests">${esc(t(lang, 'search_guests'))}</label>
    <div class="stepper" data-stepper>
      <button type="button" class="stepper__btn" data-step="-1" aria-label="${esc(t(lang, 'guests_less'))}">${icon('minus')}</button>
      <input class="stepper__input" id="${id}-guests" type="number" name="guests" min="1" max="${maxGuests}" value="${guests}" inputmode="numeric">
      <button type="button" class="stepper__btn" data-step="1" aria-label="${esc(t(lang, 'guests_more'))}">${icon('plus')}</button>
    </div>
  </div>
  <button class="btn btn-primary btn-lg search__submit" type="submit">${icon('calendar')}<span>${esc(submitLabel || t(lang, 'search_submit'))}</span></button>
</form>`;
}

// ------------------------------------------------------------------ sections
function sectionHead({ eyebrow, title, lead, link, align = 'start', tag = 'h2', id, small = false }) {
  return `<div class="section-head section-head--${align}">
  ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
  <${tag} class="section-title${small ? ' section-title--sm' : ''}"${id ? ` id="${esc(id)}"` : ''}>${esc(title)}</${tag}>
  ${lead ? `<p class="lead">${esc(lead)}</p>` : ''}
  ${link ? `<a class="link-arrow" href="${esc(link.href)}">${esc(link.label)}${icon('arrowRight')}</a>` : ''}
</div>`;
}

function pageHero(ctx, { eyebrow, title, lead, photo, alt = '', compact = false }) {
  return `<section class="page-hero${compact ? ' page-hero--compact' : ''}${photo ? '' : ' page-hero--plain'}">
  ${photo ? `<div class="page-hero__media">${picture(photo, { alt, sizes: '100vw', priority: true, width: 1920 })}</div>` : ''}
  <div class="container page-hero__inner">
    ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
    <h1 class="page-hero__title">${esc(title)}</h1>
    ${lead ? `<p class="page-hero__lead">${esc(lead)}</p>` : ''}
  </div>
</section>`;
}

function roomCard(ctx, type, { headingTag = 'h3' } = {}) {
  const { lang, s } = ctx;
  const name = pickLang(type.name, lang);
  const href = roomUrl(lang, type);
  const gender = genderLabel(type, lang);
  const facts = roomFacts(type, lang).slice(0, 3);
  return `<article class="room-card" data-room-card data-type-id="${type.id}">
  <div class="room-card__media">
    ${picture((type.photos || [])[0], { alt: name, sizes: '(min-width: 1100px) 400px, (min-width: 700px) 45vw, 85vw', width: 960 })}
    ${gender ? `<span class="chip chip--light room-card__badge">${esc(gender)}</span>` : ''}
    <span class="chip chip--avail room-card__avail" data-avail hidden></span>
  </div>
  <div class="room-card__body">
    <${headingTag} class="room-card__title"><a class="stretched" href="${esc(href)}">${esc(name)}</a></${headingTag}>
    ${facts.length ? `<ul class="facts-inline">${facts.map(([i, txt]) => `<li>${icon(i)}<span>${esc(txt)}</span></li>`).join('')}</ul>` : `<p class="room-card__desc">${esc(pickLang(type.description, lang))}</p>`}
    <div class="room-card__foot">
      ${priceLine(type, lang, s.currency)}
      <span class="room-card__more" aria-hidden="true">${esc(t(lang, 'room_view'))}${icon('arrowRight')}</span>
    </div>
  </div>
</article>`;
}

const AMENITIES = [
  ['towel', 'am_linens'], ['wifi', 'am_wifi'], ['kitchen', 'am_kitchen'], ['leaf', 'am_garden'],
  ['sofa', 'am_lounge'], ['dining', 'am_dining'], ['safe', 'am_safe'], ['parking', 'am_parking'],
];
function amenities(ctx) {
  return `<ul class="amenities">${AMENITIES.map(([i, k]) => `<li class="amenity"><span class="amenity__icon">${icon(i)}</span><span>${esc(t(ctx.lang, k))}</span></li>`).join('')}</ul>`;
}

function goodToKnowItems(ctx) {
  const { lang, s } = ctx;
  return [
    ['clock', 'gtk_times_t', t(lang, 'gtk_times_d', { in: s.checkin_time, out: s.checkout_time })],
    ['users', 'gtk_dorms_t', t(lang, 'gtk_dorms_d')],
    ['nosmoke', 'gtk_smoke_t', t(lang, 'gtk_smoke_d')],
    ['stairs', 'gtk_stairs_t', t(lang, 'gtk_stairs_d')],
    ['refund', 'gtk_cancel_t', t(lang, 'gtk_cancel_d', { h: s.cancel_hours })],
    ['shield', 'gtk_pay_t', t(lang, 'gtk_pay_d')],
  ];
}
function goodToKnow(ctx) {
  const { lang } = ctx;
  return `<ul class="gtk">${goodToKnowItems(ctx).map(([i, k, d]) => `<li class="gtk__item"><span class="gtk__icon">${icon(i)}</span><div><h3 class="gtk__title">${esc(t(lang, k))}</h3><p>${esc(d)}</p></div></li>`).join('')}</ul>
<p class="gtk__more"><a class="link-arrow" href="${esc(url(lang, '/terms'))}">${esc(t(lang, 'gtk_all'))}${icon('arrowRight')}</a></p>`;
}

function faq(ctx) {
  const { lang, s } = ctx;
  const vars = { h: s.cancel_hours, n: (s.max_guests_online || 14) + 1 };
  return `<div class="accordion">${[1, 2, 3, 4, 5, 6].map((i) => `<details class="accordion__item">
  <summary class="accordion__q"><span>${esc(t(lang, 'faq_q' + i, vars))}</span>${icon('plus', 'accordion__icon')}</summary>
  <div class="accordion__a"><p>${esc(t(lang, 'faq_a' + i, vars))}${i === 6 ? ` <a href="${esc(url(lang, '/groups'))}">${esc(t(lang, 'grp_cta'))}</a>` : ''}</p></div>
</details>`).join('')}</div>`;
}

function contactOptions(ctx) {
  const { lang, s } = ctx;
  const wa = String(s.whatsapp || '').replace(/\D/g, '');
  const phones = String(s.phones || '').split('/').map((p) => p.trim()).filter(Boolean);
  const cards = [];
  if (wa) cards.push(`<a class="contact-card contact-card--wa" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener"><span class="contact-card__icon">${icon('chat')}</span><span class="contact-card__label">${esc(t(lang, 'contact_wa'))}</span><span class="contact-card__value" dir="ltr">+${esc(wa)}</span></a>`);
  if (phones.length) cards.push(`<div class="contact-card"><span class="contact-card__icon">${icon('phone')}</span><span class="contact-card__label">${esc(t(lang, 'contact_call'))}</span>${phones.map((p) => `<a class="contact-card__value" href="tel:${esc(p.replace(/[^\d+]/g, ''))}" dir="ltr">${esc(p)}</a>`).join('')}</div>`);
  if (s.email) cards.push(`<a class="contact-card" href="mailto:${esc(s.email)}"><span class="contact-card__icon">${icon('mail')}</span><span class="contact-card__label">${esc(t(lang, 'contact_mail'))}</span><span class="contact-card__value">${esc(s.email).replace('@', '@<wbr>')}</span></a>`);
  cards.push(`<a class="contact-card" href="${esc(url(lang, '/location'))}"><span class="contact-card__icon">${icon('pin')}</span><span class="contact-card__label">${esc(t(lang, 'contact_address'))}</span><span class="contact-card__value">${esc(pickLang(s.address, lang))}</span></a>`);
  return `<div class="contact-cards">${cards.join('')}</div>`;
}

function destinations(ctx) {
  const { lang } = ctx;
  const items = [
    ['entrance', 'city', 'dest_colony_t', 'dest_colony_d'],
    ['haifa-view', 'leaf', 'dest_bahai_t', 'dest_bahai_d'],
    ['bat-galim', 'waves', 'dest_sea_t', 'dest_sea_d'],
    [null, 'map', 'dest_downtown_t', 'dest_downtown_d'],
    [null, 'train', 'dest_transit_t', 'dest_transit_d'],
  ];
  return `<ul class="dest-grid">${items.map(([photo, ic, tk, dk]) => `<li class="dest${photo ? ' dest--photo' : ''}">
  ${photo ? `<div class="dest__media">${picture(photo, { alt: '', sizes: '(min-width: 900px) 33vw, 85vw', width: 640 })}</div>` : `<span class="dest__icon">${icon(ic)}</span>`}
  <div class="dest__body"><h3 class="dest__title">${esc(t(lang, tk))}</h3><p>${esc(t(lang, dk))}</p></div>
</li>`).join('')}</ul>`;
}

function mapBlock(ctx) {
  const { lang, s } = ctx;
  const q = encodeURIComponent(s.maps_query || '');
  return `<div class="map-card">
  <div class="map" data-map-src="https://maps.google.com/maps?q=${esc(q)}&amp;hl=${lang}&amp;z=16&amp;output=embed">
    ${picture('entrance', { alt: '', sizes: '(min-width: 900px) 50vw, 100vw', width: 960, cls: 'map__backdrop' })}
    <div class="map__overlay">
      <span class="map__pin">${icon('pin')}</span>
      <button class="btn btn-light" type="button" data-show-map>${icon('map')}<span>${esc(t(lang, 'show_map'))}</span></button>
      <p class="map__note">${esc(t(lang, 'map_note'))}</p>
    </div>
  </div>
  <div class="map-card__body">
    <p class="map-card__address">${icon('pin')}<span>${esc(pickLang(s.address, lang))}</span></p>
    <div class="btn-row">
      <a class="btn btn-secondary btn-sm" href="https://www.google.com/maps/search/?api=1&amp;query=${esc(q)}" target="_blank" rel="noopener">${esc(t(lang, 'open_google'))}</a>
      <a class="btn btn-secondary btn-sm" href="https://waze.com/ul?q=${esc(q)}&amp;navigate=yes" target="_blank" rel="noopener">${esc(t(lang, 'open_waze'))}</a>
    </div>
  </div>
</div>`;
}

function groupBand(ctx) {
  const { lang } = ctx;
  return `<section class="band band--photo" aria-labelledby="grp-band-title">
  <div class="band__media">${picture('fellowship', { alt: '', sizes: '100vw', width: 1920 })}</div>
  <div class="container band__inner reveal">
    <p class="eyebrow eyebrow--light">${esc(t(lang, 'grp_eyebrow'))}</p>
    <h2 class="band__title" id="grp-band-title">${esc(t(lang, 'grp_title'))}</h2>
    <p class="band__text">${esc(t(lang, 'grp_text'))}</p>
    <a class="btn btn-light btn-lg" href="${esc(url(lang, '/groups'))}">${icon('users')}<span>${esc(t(lang, 'grp_cta'))}</span></a>
  </div>
</section>`;
}

function mosaic(items, lang, { limit, cls = '' } = {}) {
  const list = limit ? items.slice(0, limit) : items;
  return `<div class="mosaic ${esc(cls)}" data-gallery>${list.map((g, i) => {
    const cap = pickLang(g.caption, lang);
    return `<a class="mosaic__item" href="${esc(require('./photos').url(g.src))}" data-lightbox data-caption="${esc(cap)}" style="--i:${i}">
  ${picture(g.src, { alt: cap, sizes: i === 0 ? '(min-width: 900px) 50vw, 100vw' : '(min-width: 900px) 25vw, 50vw', width: 960 })}
  <span class="mosaic__cap">${esc(cap)}</span>
</a>`;
  }).join('')}</div>`;
}

function stickyCta(ctx, { label, href, price } = {}) {
  const { lang } = ctx;
  return `<div class="sticky-cta" data-sticky-cta hidden>
  ${price ? `<div class="sticky-cta__price">${price}</div>` : ''}
  <a class="btn btn-primary btn-lg${price ? '' : ' btn-block'}" href="${esc(href || url(lang, '/book'))}" data-sticky-link>${icon('calendar')}<span>${esc(label || t(lang, 'sticky_cta'))}</span></a>
</div>`;
}

module.exports = {
  LANGS, prefix, url, fmtMoney, roomUrl, roomKey, roomFacts, genderLabel, priceLine, priceRows, ROOM_FACTS,
  header, footer, demoRibbon, searchBar, sectionHead, pageHero, roomCard, amenities, goodToKnow, goodToKnowItems,
  faq, contactOptions, destinations, mapBlock, groupBand, mosaic, stickyCta,
};
