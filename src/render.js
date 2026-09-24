'use strict';
// Server-rendered pages of the public website. Building blocks live in src/ui/.
const { esc, jsonForScript, pickLang, nightsBetween, todayIL, addDays } = require('./util');
const { STR, t, PAGES } = require('./i18n');
const { icon } = require('./ui/icons');
const { picture, url: photoUrl } = require('./ui/photos');
const C = require('./ui/components');

const { LANGS, url, prefix, fmtMoney } = C;

function fmtDate(d, lang, opts) {
  return new Intl.DateTimeFormat(STR[lang].locale, opts || { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(d + 'T00:00:00Z'));
}

// "*word*" in admin-editable headlines becomes an accent
function accent(text) {
  return esc(text).replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

// Strings the browser scripts need (date picker, availability, errors)
function siteI18n(lang) {
  const keys = ['check_in', 'check_out', 'search_add_dates', 'dp_title', 'dp_prev', 'dp_next', 'dp_clear', 'dp_done', 'dp_pick_in', 'dp_pick_out',
    'nights_n', 'night_1', 'close', 'room_left_n', 'room_left_1', 'room_none', 'e_network', 'e_generic', 'img_missing', 'e_group_fields', 'e_group_dates'];
  const out = {};
  for (const k of keys) out[k] = t(lang, k);
  return { lang, locale: STR[lang].locale, today: todayIL(), t: out };
}

function layout(ctx, { title, description, body, scripts = [], data = null, bodyClass = '', noindex = false, overlayHeader = false, preload = '' }) {
  const { lang, s } = ctx;
  const L = STR[lang];
  const site = pickLang(s.site_name, lang);
  const fullTitle = title ? `${title} · ${site}` : `${site} – ${pickLang(s.site_subtitle, lang)}`;
  const desc = description || pickLang(s.hero_text, lang).replace(/\*/g, '');
  const abs = (p) => (ctx.origin || '') + p;
  const alternates = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(abs(url(l, ctx.path)))}">`).join('\n')
    + `\n<link rel="alternate" hreflang="x-default" href="${esc(abs(url('en', ctx.path)))}">`;
  const og = photoUrl(s.hero_image || 'garden');

  return `<!doctype html>
<html lang="${lang}" dir="${L.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc.slice(0, 300))}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(abs(url(lang, ctx.path)))}">\n${alternates}`}
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc.slice(0, 300))}">
<meta property="og:image" content="${esc(/^https?:/.test(og) ? og : abs(og))}">
<meta property="og:type" content="website">
<meta name="theme-color" content="#f6f1e8">
<script>document.documentElement.classList.add('js')</script>
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+Display:ital,wght@0,500;0,600;1,400;1,500&family=Onest:wght@400;500;600&display=swap">
${preload}
<link rel="stylesheet" href="/css/site.css?v=${ctx.version}">
</head>
<body class="${esc(bodyClass)}">
<a class="skip-link" href="#main">${esc(L.skip)}</a>
${C.header(ctx, { overlay: overlayHeader })}
<main id="main" tabindex="-1">
${body}
</main>
${C.footer(ctx)}
<script type="application/json" id="site-data">${jsonForScript(siteI18n(lang))}</script>
${data ? `<script type="application/json" id="app-data">${jsonForScript(data)}</script>` : ''}
<script src="/js/site.js?v=${ctx.version}" defer></script>
${scripts.map((src) => `<script src="${esc(src)}?v=${ctx.version}" defer></script>`).join('\n')}
</body>
</html>`;
}

function heroPreload(src) {
  const key = require('./ui/photos').keyOf(src);
  if (!key) return '';
  const m = require('./photos.json')[key];
  const srcset = m.widths.map((w) => `/photos/${key}-${w}.webp ${w}w`).join(', ');
  return `<link rel="preload" as="image" type="image/webp" imagesrcset="${srcset}" imagesizes="100vw" fetchpriority="high">`;
}

// ------------------------------------------------------------------ shared sections

function storySection(ctx, { lead, headingTag = 'h2' } = {}) {
  const { lang } = ctx;
  const pillars = [['leaf', 'story_p1_t', 'story_p1_d'], ['dining', 'story_p2_t', 'story_p2_d'], ['heart', 'story_p3_t', 'story_p3_d']];
  return `<section class="section story" aria-labelledby="story-title">
  <div class="container story__grid">
    <div class="story__media reveal">
      <div class="story__photo story__photo--main">${picture('porch', { alt: t(lang, 'am_garden'), sizes: '(min-width: 1000px) 40vw, 90vw', width: 1440 })}</div>
      <div class="story__photo story__photo--small">${picture('fellowship', { alt: t(lang, 'am_lounge'), sizes: '(min-width: 1000px) 22vw, 50vw', width: 960 })}</div>
    </div>
    <div class="story__copy reveal">
      <p class="eyebrow">${esc(t(lang, 'story_eyebrow'))}</p>
      <${headingTag} class="section-title" id="story-title">${esc(t(lang, 'story_title'))}</${headingTag}>
      <p class="lead">${esc(lead || t(lang, 'story_text'))}</p>
      <ul class="pillars">${pillars.map(([i, tk, dk]) => `<li class="pillar"><span class="pillar__icon">${icon(i)}</span><div><h3 class="pillar__title">${esc(t(lang, tk))}</h3><p>${esc(t(lang, dk))}</p></div></li>`).join('')}</ul>
      <figure class="verse">
        <blockquote><p>${esc(t(lang, 'verse'))}</p></blockquote>
        <figcaption>${esc(t(lang, 'verse_ref'))}</figcaption>
      </figure>
    </div>
  </div>
</section>`;
}

function roomsRail(ctx, types, { exclude } = {}) {
  const list = types.filter((tp) => tp.id !== exclude);
  return `<div class="room-rail" data-rail>${list.map((tp) => C.roomCard(ctx, tp)).join('')}</div>`;
}

function gtkSection(ctx, { deep = false } = {}) {
  const { lang } = ctx;
  return `<section class="section${deep ? ' section--deep' : ''}" aria-labelledby="gtk-title">
  <div class="container">
    ${C.sectionHead({ eyebrow: t(lang, 'gtk_eyebrow'), title: t(lang, 'gtk_title') , id: 'gtk-title' })}
    ${C.goodToKnow(ctx)}
  </div>
</section>`;
}

function amenitiesSection(ctx) {
  const { lang } = ctx;
  return `<section class="section section--tight amenities-section" aria-labelledby="am-title">
  <div class="container amenities-section__inner">
    <div class="amenities-section__head">
      <p class="eyebrow">${esc(t(lang, 'am_eyebrow'))}</p>
      <h2 class="section-title section-title--sm" id="am-title">${esc(t(lang, 'am_title'))}</h2>
    </div>
    ${C.amenities(ctx)}
  </div>
</section>`;
}

function contactSection(ctx, { deep = true } = {}) {
  const { lang } = ctx;
  return `<section class="section${deep ? ' section--deep' : ''}" aria-labelledby="contact-title">
  <div class="container">
    ${C.sectionHead({ eyebrow: t(lang, 'contact_eyebrow'), title: t(lang, 'contact_title2'), lead: t(lang, 'contact_lead') , id: 'contact-title' })}
    ${C.contactOptions(ctx)}
  </div>
</section>`;
}

function ctaBand(ctx) {
  const { lang } = ctx;
  return `<section class="section section--tight">
  <div class="container">
    <div class="cta-card reveal">
      <div>
        <h2 class="cta-card__title">${esc(t(lang, 'stay_title'))}</h2>
        <p>${esc(t(lang, 'rooms_sub'))}</p>
      </div>
      <div class="btn-row">
        <a class="btn btn-primary btn-lg" href="${esc(url(lang, '/book'))}">${icon('calendar')}<span>${esc(t(lang, 'search_submit'))}</span></a>
        <a class="btn btn-secondary btn-lg" href="${esc(url(lang, '/groups'))}">${esc(t(lang, 'grp_cta'))}</a>
      </div>
    </div>
  </div>
</section>`;
}

// ------------------------------------------------------------------ pages

function home(ctx, types) {
  const { lang, s } = ctx;
  const heroImg = s.hero_image || 'garden';
  const body = `
<section class="hero" data-hero>
  <div class="hero__media">${picture(heroImg, { alt: pickLang(s.site_name, lang), sizes: '100vw', priority: true, width: 2560 })}</div>
  <div class="container hero__inner">
    <div class="hero__copy">
      <p class="eyebrow eyebrow--light hero__eyebrow">${esc(t(lang, 'hero_eyebrow'))}</p>
      <h1 class="hero__title">${accent(pickLang(s.hero_title, lang))}</h1>
      <p class="hero__text">${esc(pickLang(s.hero_text, lang))}</p>
    </div>
    <div class="hero__search" id="search">
      ${C.searchBar(ctx, { variant: 'hero' })}
      <p class="hero__group">${esc(t(lang, 'search_group_hint', { n: s.max_guests_online || 14 }))} <a href="${esc(url(lang, '/groups'))}">${esc(t(lang, 'search_group_link'))}</a></p>
    </div>
  </div>
</section>

${storySection(ctx)}

<section class="section section--deep" aria-labelledby="stay-title">
  <div class="container">
    ${C.sectionHead({ eyebrow: t(lang, 'stay_eyebrow'), title: t(lang, 'stay_title'), lead: t(lang, 'rooms_sub'), link: { href: url(lang, '/rooms'), label: t(lang, 'view_all_rooms') } , id: 'stay-title' })}
    ${roomsRail(ctx, types)}
  </div>
</section>

${amenitiesSection(ctx)}

<section class="section section--flush-top" aria-labelledby="house-title">
  <div class="container">
    ${C.sectionHead({ eyebrow: t(lang, 'house_eyebrow'), title: t(lang, 'house_title'), lead: t(lang, 'house_lead'), link: { href: url(lang, '/house'), label: t(lang, 'house_more') } , id: 'house-title' })}
    ${C.mosaic(s.gallery || [], lang, { limit: 5 })}
  </div>
</section>

<section class="section section--deep" aria-labelledby="loc-title">
  <div class="container split">
    <div class="split__copy reveal">
      <p class="eyebrow">${esc(t(lang, 'loc_eyebrow'))}</p>
      <h2 class="section-title" id="loc-title">${esc(t(lang, 'loc_title'))}</h2>
      <p class="lead">${esc(t(lang, 'loc_lead'))}</p>
      <ul class="mini-list">
        <li>${icon('city')}<div><b>${esc(t(lang, 'dest_colony_t'))}</b><span>${esc(t(lang, 'dest_colony_d'))}</span></div></li>
        <li>${icon('waves')}<div><b>${esc(t(lang, 'dest_sea_t'))}</b><span>${esc(t(lang, 'dest_sea_d'))}</span></div></li>
        <li>${icon('leaf')}<div><b>${esc(t(lang, 'dest_bahai_t'))}</b><span>${esc(t(lang, 'dest_bahai_d'))}</span></div></li>
      </ul>
      <a class="link-arrow" href="${esc(url(lang, '/location'))}">${esc(t(lang, 'loc_more'))}${icon('arrowRight')}</a>
    </div>
    <div class="split__media reveal">
      <div class="split__photo">${picture('bat-galim', { alt: t(lang, 'dest_sea_t'), sizes: '(min-width: 900px) 50vw, 100vw', width: 1180 })}</div>
      <div class="split__photo split__photo--inset">${picture('haifa-view', { alt: t(lang, 'dest_bahai_t'), sizes: '(min-width: 900px) 22vw, 45vw', width: 640 })}</div>
    </div>
  </div>
</section>

${C.groupBand(ctx)}
${gtkSection(ctx)}
${contactSection(ctx)}
${C.stickyCta(ctx, { href: '#search' })}`;
  return layout(ctx, { body, bodyClass: 'page-home', overlayHeader: true, preload: heroPreload(heroImg) });
}

function roomsPage(ctx, types, query = {}) {
  const { lang } = ctx;
  const body = `
${C.pageHero(ctx, { eyebrow: t(lang, 'stay_eyebrow'), title: t(lang, 'stay_title'), lead: t(lang, 'rooms_sub'), compact: true })}
<section class="section section--tight">
  <div class="container">
    <div class="date-strip" aria-label="${esc(t(lang, 'room_dates_title'))}">
      ${C.searchBar(ctx, { variant: 'inline', action: '/rooms', values: query, submitLabel: t(lang, 'check_availability') })}
      <p class="date-strip__hint" data-avail-hint>${esc(t(lang, 'room_dates_hint'))}</p>
    </div>
    <div class="room-grid" data-avail-scope>${types.map((tp) => C.roomCard(ctx, tp, { headingTag: 'h2' })).join('')}</div>
  </div>
</section>
${amenitiesSection(ctx)}
${gtkSection(ctx, { deep: true })}
${C.groupBand(ctx)}
${C.stickyCta(ctx, { href: url(lang, '/book') })}`;
  return layout(ctx, { title: t(lang, 'stay_title'), body, bodyClass: 'page-rooms' });
}

function roomPage(ctx, type, types, query = {}) {
  const { lang, s } = ctx;
  const name = pickLang(type.name, lang);
  const desc = pickLang(type.description, lang);
  const note = pickLang(type.note, lang);
  const gender = C.genderLabel(type, lang);
  const facts = C.roomFacts(type, lang);
  const own = (type.photos || []).map((src) => ({ src, caption: { [lang]: name } }));
  const shared = (s.gallery || []).filter((g) => !own.some((o) => o.src === g.src)).slice(0, 4);
  const photos = own.concat(shared);
  const rules = [];
  if (note) rules.push(['info', note]);
  if (type.sold_as === 'bed' && type.gender !== 'any') rules.push(['users', t(lang, 'rd_rule_gender')]);
  if ((C.ROOM_FACTS[type.slug] || {}).kidsFree) rules.push(['heart', t(lang, 'rd_rule_kids')]);
  rules.push(['clock', t(lang, 'gtk_times_d', { in: s.checkin_time, out: s.checkout_time })]);
  rules.push(['refund', t(lang, 'gtk_cancel_d', { h: s.cancel_hours })]);
  rules.push(['stairs', t(lang, 'gtk_stairs_d')]);
  rules.push(['nosmoke', t(lang, 'gtk_smoke_d')]);
  const features = facts.concat([['wifi', t(lang, 'am_wifi')], ['safe', t(lang, 'am_safe')], ['leaf', t(lang, 'am_garden')]]);
  const priceHtml = C.priceLine(type, lang, s.currency);

  const galleryItems = photos.map((g, i) => {
    const cap = pickLang(g.caption, lang) || name;
    return `<a class="room-gallery__item" href="${esc(photoUrl(g.src))}" data-lightbox data-caption="${esc(cap)}"${i > 4 ? ' hidden' : ''}>${picture(g.src, { alt: cap, sizes: i === 0 ? '(min-width: 900px) 60vw, 100vw' : '(min-width: 900px) 20vw, 50vw', width: i === 0 ? 1440 : 640, loading: i === 0 ? 'eager' : 'lazy' })}</a>`;
  }).join('');

  const body = `
<section class="room-top">
  <div class="container">
    <a class="back-link" href="${esc(url(lang, '/rooms'))}">${icon('arrowLeft')}<span>${esc(t(lang, 'rd_all_rooms'))}</span></a>
    <div class="room-head">
      <div>
        ${gender ? `<span class="chip chip--accent">${esc(gender)}</span>` : ''}
        <h1 class="room-head__title">${esc(name)}</h1>
        <ul class="facts-inline facts-inline--lg">${facts.slice(0, 3).map(([i, txt]) => `<li>${icon(i)}<span>${esc(txt)}</span></li>`).join('')}</ul>
      </div>
      <div class="room-head__price">${priceHtml}</div>
    </div>
    <div class="room-gallery${photos.length < 3 ? ' room-gallery--few' : ''}" data-gallery>
      ${galleryItems}
      ${photos.length > 1 ? `<button class="btn btn-light btn-sm room-gallery__all" type="button" data-gallery-open>${icon('grid')}<span>${esc(t(lang, 'rd_show_photos', { n: photos.length }))}</span></button>` : ''}
    </div>
  </div>
</section>

<section class="section section--tight">
  <div class="container room-layout">
    <div class="room-main">
      <section class="room-block" aria-labelledby="rd-about">
        <h2 class="room-block__title" id="rd-about">${esc(t(lang, 'rd_about'))}</h2>
        <p class="lead lead--body">${esc(desc)}</p>
      </section>
      <section class="room-block" aria-labelledby="rd-in">
        <h2 class="room-block__title" id="rd-in">${esc(t(lang, 'rd_in_room'))}</h2>
        <ul class="feature-grid">${features.map(([i, txt]) => `<li>${icon(i)}<span>${esc(txt)}</span></li>`).join('')}</ul>
      </section>
      <section class="room-block" aria-labelledby="rd-prices">
        <h2 class="room-block__title" id="rd-prices">${esc(t(lang, 'rd_prices'))}</h2>
        <dl class="price-list">${C.priceRows(type, lang, s.currency).map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>
      </section>
      <section class="room-block" aria-labelledby="rd-rules">
        <h2 class="room-block__title" id="rd-rules">${esc(t(lang, 'rd_rules'))}</h2>
        <ul class="rule-list">${rules.map(([i, txt]) => `<li>${icon(i)}<span>${esc(txt)}</span></li>`).join('')}</ul>
        <a class="link-arrow" href="${esc(url(lang, '/terms'))}">${esc(t(lang, 'gtk_all'))}${icon('arrowRight')}</a>
      </section>
    </div>
    <aside class="booking-panel" id="book-panel" aria-label="${esc(t(lang, 'rd_check'))}">
      <div class="booking-panel__card">
        ${priceHtml}
        ${C.searchBar(ctx, { variant: 'panel', action: '/book', values: query, hidden: { type: type.id }, submitLabel: t(lang, 'rd_check') })}
        <p class="booking-panel__avail" data-panel-avail data-type-id="${type.id}" aria-live="polite"></p>
        <p class="booking-panel__hint">${icon('shield', 'ico-sm')}<span>${esc(t(lang, 'rd_book_hint'))}</span></p>
      </div>
    </aside>
  </div>
</section>

${types.length > 1 ? `<section class="section section--deep" aria-labelledby="other-title">
  <div class="container">
    ${C.sectionHead({ title: t(lang, 'stay_title'), link: { href: url(lang, '/rooms'), label: t(lang, 'view_all_rooms') } , id: 'other-title', small: true })}
    ${roomsRail(ctx, types, { exclude: type.id })}
  </div>
</section>` : ''}
${C.stickyCta(ctx, { href: '#book-panel', label: t(lang, 'rd_check'), price: priceHtml })}`;
  return layout(ctx, { title: name, description: desc, body, bodyClass: 'page-room' });
}

function housePage(ctx) {
  const { lang, s } = ctx;
  const body = `
${C.pageHero(ctx, { eyebrow: t(lang, 'house_eyebrow'), title: t(lang, 'house_title'), lead: t(lang, 'house_lead'), photo: 'courtyard' })}
${storySection(ctx, { lead: pickLang(s.about_text, lang) })}
<section class="section section--flush-top" aria-labelledby="spaces-title">
  <div class="container">
    ${C.sectionHead({ title: t(lang, 'house_spaces') , id: 'spaces-title', small: true })}
    ${C.mosaic(s.gallery || [], lang, { cls: 'mosaic--all' })}
  </div>
</section>
${amenitiesSection(ctx)}
${gtkSection(ctx, { deep: true })}
${ctaBand(ctx)}
${C.stickyCta(ctx, { href: url(lang, '/book') })}`;
  return layout(ctx, { title: t(lang, 'nav_house'), description: t(lang, 'house_lead'), body, bodyClass: 'page-house' });
}

function locationPage(ctx) {
  const { lang, s } = ctx;
  const body = `
${C.pageHero(ctx, { eyebrow: t(lang, 'loc_eyebrow'), title: t(lang, 'loc_title'), lead: t(lang, 'loc_lead'), photo: 'haifa-view' })}
<section class="section section--tight" aria-labelledby="arrive-title">
  <div class="container split split--map">
    <div class="split__copy reveal">
      <h2 class="section-title section-title--sm" id="arrive-title">${esc(t(lang, 'loc_arrive_t'))}</h2>
      <p class="lead lead--body">${esc(pickLang(s.location_text, lang))}</p>
      <p class="callout">${icon('door')}<span>${esc(t(lang, 'loc_arrive_d'))}</span></p>
    </div>
    <div class="reveal">${C.mapBlock(ctx)}</div>
  </div>
</section>
<section class="section section--deep" aria-labelledby="dest-title">
  <div class="container">
    ${C.sectionHead({ eyebrow: t(lang, 'nearby_title'), title: t(lang, 'loc_more') , id: 'dest-title' })}
    ${C.destinations(ctx)}
  </div>
</section>
${ctaBand(ctx)}
${C.stickyCta(ctx, { href: url(lang, '/book') })}`;
  return layout(ctx, { title: t(lang, 'nav_location'), description: t(lang, 'loc_lead'), body, bodyClass: 'page-location' });
}

function contactPage(ctx) {
  const { lang } = ctx;
  const body = `
${C.pageHero(ctx, { eyebrow: t(lang, 'contact_eyebrow'), title: t(lang, 'contact_title2'), lead: t(lang, 'contact_lead'), compact: true })}
<section class="section section--tight">
  <div class="container">${C.contactOptions(ctx)}</div>
</section>
<section class="section section--deep" aria-labelledby="faq-title">
  <div class="container faq-layout">
    <h2 class="section-title" id="faq-title">${esc(t(lang, 'faq_title'))}</h2>
    ${C.faq(ctx)}
  </div>
</section>
${C.groupBand(ctx)}`;
  return layout(ctx, { title: t(lang, 'nav_contact'), description: t(lang, 'contact_lead'), body, bodyClass: 'page-contact' });
}

function groupsPage(ctx, { values = {}, errors = [], sent = null } = {}) {
  const { lang, s } = ctx;
  const today = todayIL();
  const v = (k) => esc(values[k] == null ? '' : values[k]);
  const bad = (k) => (errors.includes(k) ? ' aria-invalid="true"' : '');
  const field = (k, label, input, { opt = false, wide = false } = {}) => `<div class="field${wide ? ' field--wide' : ''}${errors.includes(k) ? ' field--error' : ''}">
    <label for="g-${k}">${esc(label)}${opt ? ` <span class="field__opt">(${esc(t(lang, 'optional'))})</span>` : ''}</label>${input}</div>`;
  const form = sent ? `<div class="form-card form-card--done" role="status">
      <span class="success-mark">${icon('check')}</span>
      <h2 class="form-card__title">${esc(t(lang, 'grp_sent_title'))}</h2>
      <p>${esc(t(lang, 'grp_sent_text', { code: sent }))}</p>
      <a class="btn btn-secondary" href="${esc(url(lang))}">${esc(t(lang, 'back_home'))}</a>
    </div>` : `<form class="form-card" method="post" action="${esc(url(lang, '/groups'))}#group-form" id="group-form" novalidate data-group-form>
      <h2 class="form-card__title">${esc(t(lang, 'grp_form_title'))}</h2>
      <p class="form-card__lead">${esc(t(lang, 'grp_form_lead'))}</p>
      ${errors.length ? `<div class="alert alert--error" role="alert">${icon('alert')}<span>${esc(t(lang, errors.includes('dates') ? 'e_group_dates' : errors.includes('server') ? 'e_generic' : 'e_group_fields'))}</span></div>` : ''}
      <div class="form-grid">
        ${field('group', t(lang, 'grp_name'), `<input id="g-group" name="group" maxlength="160" required value="${v('group')}"${bad('group')}>`, { wide: true })}
        ${field('contact', t(lang, 'grp_contact'), `<input id="g-contact" name="contact" autocomplete="name" maxlength="120" required value="${v('contact')}"${bad('contact')}>`)}
        ${field('email', t(lang, 'email_l'), `<input id="g-email" name="email" type="email" autocomplete="email" maxlength="200" required dir="ltr" value="${v('email')}"${bad('email')}>`)}
        ${field('phone', t(lang, 'grp_phone'), `<input id="g-phone" name="phone" type="tel" autocomplete="tel" maxlength="40" required dir="ltr" value="${v('phone')}"${bad('phone')}>`)}
        ${field('size', t(lang, 'grp_size'), `<input id="g-size" name="size" type="number" min="1" max="500" inputmode="numeric" required value="${v('size')}"${bad('size')}>`)}
        <div class="form-dates field--wide${errors.some((e) => ['arrival', 'departure', 'dates'].includes(e)) ? ' has-error' : ''}" data-daterange data-dates-optional data-min="${today}" data-max="${addDays(today, 730)}" data-min-nights="1" data-max-nights="365">
          ${field('arrival', t(lang, 'grp_arrival'), `<input id="g-arrival" name="arrival" type="date" min="${today}" required value="${v('arrival')}"${bad('arrival')}${bad('dates')} data-date-in>`)}
          ${field('departure', t(lang, 'grp_departure'), `<input id="g-departure" name="departure" type="date" min="${addDays(today, 1)}" required value="${v('departure')}"${bad('departure')}${bad('dates')} data-date-out>`)}
        </div>
        ${field('adults', t(lang, 'grp_adults'), `<input id="g-adults" name="adults" type="number" min="0" max="500" inputmode="numeric" value="${v('adults')}">`, { opt: true })}
        ${field('children', t(lang, 'grp_children'), `<input id="g-children" name="children" type="number" min="0" max="500" inputmode="numeric" value="${v('children')}">`, { opt: true })}
        ${field('needs', t(lang, 'grp_needs'), `<textarea id="g-needs" name="needs" rows="3" maxlength="2000" placeholder="${esc(t(lang, 'grp_needs_help'))}">${v('needs')}</textarea>`, { opt: true, wide: true })}
        ${field('message', t(lang, 'grp_message'), `<textarea id="g-message" name="message" rows="4" maxlength="4000">${v('message')}</textarea>`, { opt: true, wide: true })}
      </div>
      <div class="hp" aria-hidden="true"><label>Website <input name="website" tabindex="-1" autocomplete="off"></label></div>
      <div class="form-card__foot">
        <p class="form-card__privacy">${icon('shield', 'ico-sm')}<span>${esc(t(lang, 'grp_privacy'))}</span></p>
        <button class="btn btn-primary btn-lg" type="submit" data-sending="${esc(t(lang, 'grp_sending'))}">${esc(t(lang, 'grp_submit'))}</button>
      </div>
    </form>`;
  const body = `
${C.pageHero(ctx, { eyebrow: t(lang, 'grp_eyebrow'), title: t(lang, 'grp_title'), lead: t(lang, 'grp_text'), photo: 'garden' })}
<section class="section section--tight">
  <div class="container group-layout">
    <div class="group-layout__aside">
      <ul class="check-list">${['grp_p1', 'grp_p2', 'grp_p3'].map((k) => `<li>${icon('checkCircle')}<span>${esc(t(lang, k))}</span></li>`).join('')}</ul>
      <div class="group-layout__photo">${picture('fellowship', { alt: t(lang, 'am_lounge'), sizes: '(min-width: 900px) 35vw, 100vw', width: 960 })}</div>
      <p class="muted">${esc(t(lang, 'contact_lead'))}</p>
      <p class="btn-row">${s.whatsapp ? `<a class="btn btn-secondary btn-sm" href="https://wa.me/${esc(String(s.whatsapp).replace(/\D/g, ''))}" target="_blank" rel="noopener">${icon('chat')}<span>${esc(t(lang, 'whatsapp'))}</span></a>` : ''}${s.email ? `<a class="btn btn-secondary btn-sm" href="mailto:${esc(s.email)}">${icon('mail')}<span>${esc(t(lang, 'email'))}</span></a>` : ''}</p>
    </div>
    ${form}
  </div>
</section>`;
  return layout(ctx, { title: t(lang, 'grp_title'), description: t(lang, 'grp_text'), body, bodyClass: 'page-groups', noindex: Boolean(sent) });
}

function bookPage(ctx, config) {
  const { lang, s } = ctx;
  const body = `
<section class="book-head">
  <div class="container">
    <h1 class="book-head__title">${esc(t(lang, 'book_title'))}</h1>
    <ul class="trust-row">
      <li>${icon('shield', 'ico-sm')}<span>${esc(t(lang, 'bk_secure'))}</span></li>
      <li>${icon('refund', 'ico-sm')}<span>${esc(t(lang, 'bk_free_cancel', { h: s.cancel_hours }))}</span></li>
    </ul>
  </div>
</section>
<section class="section section--book">
  <div class="container">
    <div id="book-app" class="book-app" data-mode="new">
      <noscript><div class="alert">${icon('info')}<span>JavaScript is required to book online. ${esc(s.phones)} · ${esc(s.email)}</span></div></noscript>
      <div class="skeleton-stack" aria-hidden="true"><div class="skeleton"></div><div class="skeleton"></div></div>
    </div>
  </div>
</section>`;
  return layout(ctx, { title: t(lang, 'book_title'), body, data: config, scripts: ['/js/book.js'], bodyClass: 'page-book' });
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
  const q = encodeURIComponent(s.maps_query || '');
  const address = pickLang(s.address, lang);

  let banner = '';
  if (isNew && b.status === 'confirmed') {
    banner = `<div class="confirm-hero" role="status">
      <span class="success-mark">${icon('check')}</span>
      <h1 class="confirm-hero__title">${esc(L.bk_thanks)}</h1>
      ${b.email && notified ? `<p>${esc(t(lang, 'bk_thanks_sub', { email: b.email }))}</p>` : ''}
    </div>`;
  } else if (statusKey === 'expired') {
    banner = `<div class="alert alert--warn">${icon('clock')}<span>${esc(L.bk_expired_text)} <a href="${esc(url(lang, '/book'))}?in=${esc(b.check_in)}&amp;out=${esc(b.check_out)}">${esc(L.bk_search_again)}</a></span></div>`;
  } else if (b.status === 'cancelled') {
    banner = `<div class="alert alert--warn">${icon('info')}<span>${esc(L.bk_cancelled_text)}</span></div>`;
  }
  const heading = isNew && b.status === 'confirmed' ? '' : `<h1 class="book-head__title">${esc(L.bk_title)}</h1>`;

  const body = `
<section class="section section--book">
  <div class="container booking-view">
    ${heading}
    ${banner}
    <article class="ticket">
      <header class="ticket__head">
        <div><span class="ticket__label">${esc(L.bk_code)}</span><div class="ticket__code">${esc(b.code)}</div></div>
        <span class="status status--${esc(statusKey)}">${esc(L['st_' + statusKey] || statusKey)}</span>
      </header>
      <div class="ticket__dates">
        <div><span class="ticket__label">${esc(L.check_in)}</span><b>${esc(fmtDate(b.check_in, lang))}</b><span class="muted">${esc(t(lang, 'checkin_from', { t: s.checkin_time }))}</span></div>
        <span class="ticket__nights">${esc(nights === 1 ? L.bk_night : t(lang, 'bk_nights', { n: nights }))}</span>
        <div><span class="ticket__label">${esc(L.check_out)}</span><b>${esc(fmtDate(b.check_out, lang))}</b><span class="muted">${esc(t(lang, 'checkout_until', { t: s.checkout_time }))}</span></div>
      </div>
      <dl class="ticket__rows">
        <div><dt>${esc(L.bk_rooms)}</dt><dd>${groupLines(lines, lang).map(esc).join('<br>')}</dd></div>
        ${travelers.length ? `<div><dt>${esc(L.bk_guests)}</dt><dd>${travelers.map((x) => esc(x.name)).join('<br>')}</dd></div>` : ''}
        <div class="ticket__total"><dt>${esc(L.bk_total)}</dt><dd>${esc(fmtMoney(b.total, lang, b.currency))}</dd></div>
        ${Number(b.paid) ? `<div><dt>${esc(L.bk_paid)}</dt><dd>${esc(fmtMoney(b.paid, lang, b.currency))}</dd></div>` : ''}
        ${b.status === 'confirmed' && due > 0 ? `<div><dt>${esc(L.bk_due)}</dt><dd><b>${esc(fmtMoney(due, lang, b.currency))}</b></dd></div>` : ''}
        ${receipts.length ? `<div><dt>${esc(L.bk_receipt)}</dt><dd>${receipts.map((p) => `<a href="${esc(p.doc_url)}" target="_blank" rel="noopener">${icon('external', 'ico-sm')} ${esc(t(lang, 'bk_download', { n: p.doc_number }))}</a>`).join('<br>')}</dd></div>` : ''}
      </dl>
    </article>
    ${pendingActive ? '<div id="book-app" class="book-app" data-mode="resume"></div>' : ''}
    ${b.status === 'confirmed' ? `<section class="next-steps" aria-labelledby="next-title">
      <h2 class="next-steps__title" id="next-title">${esc(t(lang, 'bk_next_title'))}</h2>
      <ul class="rule-list">
        <li>${icon('info')}<span>${esc(t(lang, 'bk_next_1'))}</span></li>
        <li>${icon('pin')}<span>${esc(t(lang, 'bk_next_2', { t: s.checkin_time, address }))}</span></li>
        <li>${icon('refund')}<span>${esc(t(lang, 'bk_cancel_text', { h: s.cancel_hours }))}</span></li>
      </ul>
      <div class="btn-row">
        <a class="btn btn-secondary btn-sm" href="https://www.google.com/maps/search/?api=1&amp;query=${esc(q)}" target="_blank" rel="noopener">${icon('map')}<span>${esc(t(lang, 'bk_directions'))}</span></a>
        <button class="btn btn-secondary btn-sm" type="button" data-print>${icon('printer')}<span>${esc(L.bk_print)}</span></button>
      </div>
    </section>` : ''}
  </div>
</section>
${contactSection(ctx)}`;
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
${C.pageHero(ctx, { title: L.terms_title, compact: true })}
<section class="section section--tight"><div class="container prose"><ol class="terms">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div></section>`;
  return layout(ctx, { title: L.terms_title, body, bodyClass: 'page-text' });
}

function textPage(ctx, key) {
  const { lang, s } = ctx;
  const L = STR[lang];
  const title = key === 'privacy' ? L.privacy_title : L.access_title;
  const vars = { org: pickLang(s.site_name, lang), email: s.email, phone: s.phones, address: pickLang(s.address, lang) };
  const paras = (PAGES[key][lang] || PAGES[key].en).map((p) => p.replace(/\{(\w+)\}/g, (_, k) => vars[k] || ''));
  const body = `
${C.pageHero(ctx, { title, compact: true })}
<section class="section section--tight"><div class="container prose">${paras.map((p) => `<p>${esc(p)}</p>`).join('')}</div></section>`;
  return layout(ctx, { title, body, bodyClass: 'page-text' });
}

function notFound(ctx) {
  const L = STR[ctx.lang];
  const body = `
${C.pageHero(ctx, { title: L.not_found, compact: true })}
<section class="section section--tight"><div class="container"><a class="btn btn-primary" href="${esc(url(ctx.lang))}">${esc(L.back_home)}</a></div></section>`;
  return layout(ctx, { title: L.not_found, body, noindex: true, bodyClass: 'page-text' });
}

module.exports = {
  LANGS, url, prefix, fmtMoney, home, roomsPage, roomPage, housePage, locationPage, contactPage, groupsPage,
  bookPage, bookingPage, termsPage, textPage, notFound,
};
