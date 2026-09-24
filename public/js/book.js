/* Bethel Hostel – booking app: dates -> rooms -> details -> payment (PayPal or demo).
   Server rules (availability, prices, gender, holds) live in src/booking.js; this file only drives the screens. */
(function () {
  'use strict';

  const root = document.getElementById('book-app');
  const dataEl = document.getElementById('app-data');
  if (!root || !dataEl) return;

  const C = JSON.parse(dataEl.textContent);
  const T = C.t;
  const MODE = root.getAttribute('data-mode') || 'new';
  const TYPES = {};
  C.types.forEach((tp) => { TYPES[tp.id] = tp; });
  const UI = window.Bethel || {};

  const COUNTRIES = ('AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI KH CM CA CV CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HK HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PW PS PA PG PY PE PH PL PT PR QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW').split(' ');

  // ---------------------------------------------------------------- helpers
  function t(key, vars) {
    let s = T[key] || key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
    return s;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const ICONS = {
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    minus: '<path d="M6 12h12"/>',
    plus: '<path d="M12 6v12M6 12h12"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
    alert: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4M12 17h.01"/>',
    shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    refund: '<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"/><path d="M12 8v4l2.5 1.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0M16 5.2a3 3 0 0 1 0 5.6M18 14.3A5.5 5.5 0 0 1 21 20"/>',
    bunk: '<path d="M5 3v18M19 3v18M5 7.5h14M5 16h14M8 7.5V5.8h4v1.7M8 16v-1.7h4V16"/>',
    bath: '<path d="M4 12h16v2.5a4.5 4.5 0 0 1-4.5 4.5h-7A4.5 4.5 0 0 1 4 14.5V12zM6 12V6a2 2 0 0 1 3.6-1.2M7.5 19l-1 2M16.5 19l1 2"/>',
    kitchen: '<path d="M7 3v8M4.5 3v4.5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 21V3c-2.2 1.3-3.3 3.7-3.3 6.5V13H17"/>',
    towel: '<path d="M6 3h12v14H6zM6 17v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3M9 7h6M9 10.5h6"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    bed: '<path d="M3 19v-8.5A1.5 1.5 0 0 1 4.5 9h15a1.5 1.5 0 0 1 1.5 1.5V19M3 15h18M6.5 9V7.2c0-.7.5-1.2 1.2-1.2h3.1c.7 0 1.2.5 1.2 1.2V9"/>',
  };
  function icon(name, cls) {
    return `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
  }
  const nf0 = new Intl.NumberFormat(C.locale, { style: 'currency', currency: C.currency, maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat(C.locale, { style: 'currency', currency: C.currency });
  function money(n) {
    n = Number(n) || 0;
    return (n % 1 ? nf2 : nf0).format(n);
  }
  const df = new Intl.DateTimeFormat(C.locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const dfy = new Intl.DateTimeFormat(C.locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  function fdate(s, withYear) { return (withYear ? dfy : df).format(new Date(s + 'T00:00:00Z')); }
  function addDays(s, n) {
    const d = new Date(s + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(Date.parse(s + 'T00:00:00Z')); }
  function nightsText(n) { return n === 1 ? t('night_1') : t('nights_n', { n }); }
  function guestsText(n) { return n === 1 ? t('one_guest') : t('n_guests', { n }); }
  function errText(code) {
    const vars = { n: '' };
    if (code === 'min_nights') vars.n = C.minNights;
    if (code === 'max_nights') vars.n = C.maxNights;
    if (code === 'max_guests') vars.n = C.maxGuests;
    if (code === 'dates_too_far') vars.n = C.windowDays;
    return T['e_' + code] ? t('e_' + code, vars) : t('e_generic');
  }
  async function api(method, url, body) {
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'same-origin',
      });
    } catch (_) {
      const err = new Error('network');
      err.code = 'network';
      throw err;
    }
    let data = {};
    try { data = await res.json(); } catch (_) { /* empty */ }
    if (!res.ok) {
      const err = new Error(data.error || 'generic');
      err.code = data.error || 'generic';
      throw err;
    }
    return data;
  }
  function scrollToApp() {
    const top = root.getBoundingClientRect().top + window.scrollY - 96;
    if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
  }

  // ---------------------------------------------------------------- state
  const init = C.initial || {};
  const S = {
    step: 1,
    checkIn: isDate(init.checkIn) ? init.checkIn : '',
    checkOut: isDate(init.checkOut) ? init.checkOut : '',
    guests: Math.min(C.maxGuests, Math.max(1, Number(init.guests) || 2)),
    nights: 0,
    avail: null,
    loading: false,
    sel: {}, // typeId -> [guests, guests, ...] (one entry per room or bed)
    highlight: init.typeId || null,
    contact: { name: '', email: '', phone: '', country: '' },
    travelers: [],
    notes: '',
    accept: false,
    payMethod: C.paymentMode === 'arrival' || !C.onlineAvailable ? 'arrival' : 'paypal',
    booking: null,
    error: '',
    busy: false,
  };

  function priceFor(tp, g) {
    const p = tp.prices || [];
    if (!p.length) return 0;
    if (tp.soldAs === 'bed') return p[0];
    const i = Math.min(Math.max(g, 1), tp.capacity) - 1;
    return p[i] != null ? p[i] : p[p.length - 1];
  }
  function lines() {
    const out = [];
    Object.keys(S.sel).forEach((id) => {
      (S.sel[id] || []).forEach((g) => out.push({ typeId: Number(id), guests: g }));
    });
    return out;
  }
  function totalGuests() { return lines().reduce((a, l) => a + l.guests, 0); }
  function totalPrice() { return lines().reduce((a, l) => a + priceFor(TYPES[l.typeId], l.guests) * S.nights, 0); }
  function genderNeeds() {
    let men = 0;
    let women = 0;
    lines().forEach((l) => {
      const g = TYPES[l.typeId].gender;
      if (g === 'male') men += l.guests;
      if (g === 'female') women += l.guests;
    });
    return { men, women };
  }
  function syncTravelers() {
    const n = totalGuests();
    while (S.travelers.length < n) S.travelers.push({ name: '', gender: '' });
    S.travelers.length = n;
  }

  // ---------------------------------------------------------------- rendering
  function progressHtml() {
    const names = [t('s_dates'), t('s_rooms'), t('s_details'), t('s_payment')];
    return `<ol class="progress" aria-label="${esc(t('bk_steps_label'))}">${names.map((n, i) => {
      const k = i + 1;
      const cls = k === S.step ? 'is-current' : k < S.step ? 'is-done' : '';
      return `<li class="progress__step ${cls}"${k === S.step ? ' aria-current="step"' : ''}><span class="progress__label">${esc(n)}</span></li>`;
    }).join('')}</ol>`;
  }

  function searchHtml() {
    const maxOut = addDays(C.maxDate, C.maxNights);
    return `<form class="search search--inline" data-form="dates" data-dates-optional novalidate>
      <div class="search__dates" data-daterange data-min="${C.today}" data-max="${esc(C.maxDate)}" data-min-nights="${C.minNights}" data-max-nights="${C.maxNights}">
        <div class="search__field"><label class="search__label" for="bk-in">${esc(t('check_in'))}</label>
          <input class="search__input" id="bk-in" type="date" name="checkIn" required min="${C.today}" max="${esc(C.maxDate)}" value="${esc(S.checkIn)}" data-date-in></div>
        <div class="search__field"><label class="search__label" for="bk-out">${esc(t('check_out'))}</label>
          <input class="search__input" id="bk-out" type="date" name="checkOut" required min="${esc(S.checkIn ? addDays(S.checkIn, 1) : addDays(C.today, 1))}" max="${esc(maxOut)}" value="${esc(S.checkOut)}" data-date-out></div>
      </div>
      <div class="search__field search__guests">
        <label class="search__label" for="bk-guests">${esc(t('search_guests'))}</label>
        <div class="stepper" data-stepper>
          <button type="button" class="stepper__btn" data-step="-1" aria-label="${esc(t('guests_less'))}">${icon('minus')}</button>
          <input class="stepper__input" id="bk-guests" type="number" name="guests" min="1" max="${C.maxGuests}" value="${S.guests}" inputmode="numeric" data-bind="guests">
          <button type="button" class="stepper__btn" data-step="1" aria-label="${esc(t('guests_more'))}">${icon('plus')}</button>
        </div>
      </div>
      <button class="btn btn-primary btn-lg search__submit" type="submit"${S.loading ? ' disabled' : ''}>${S.loading ? '<span class="spinner"></span>' : icon('search')}<span>${esc(t('search'))}</span></button>
    </form>
    <p class="hint" style="margin-top:12px">${icon('users')}<span>${esc(t('search_group_hint', { n: C.maxGuests }))} <a href="${esc(C.groupsUrl)}">${esc(t('search_group_link'))}</a></span></p>`;
  }

  function trustHtml() {
    return `<ul class="summary__trust">
      ${C.onlineAvailable || C.demo ? `<li>${icon('shield', 'ico-sm')}<span>${esc(t('bk_secure'))}</span></li>` : ''}
      <li>${icon('refund', 'ico-sm')}<span>${esc(t('bk_free_cancel', { h: C.cancelHours }))}</span></li>
    </ul>`;
  }

  function summaryHtml(withButton) {
    const ls = lines();
    const groups = {};
    ls.forEach((l) => {
      const key = l.typeId + ':' + l.guests;
      groups[key] = groups[key] || { tp: TYPES[l.typeId], guests: l.guests, count: 0 };
      groups[key].count += 1;
    });
    const items = Object.keys(groups).map((k) => {
      const g = groups[k];
      const label = g.tp.soldAs === 'bed' ? `${g.count} × ${g.tp.name}` : `${g.count} × ${g.tp.name}`;
      const sub = g.tp.soldAs === 'bed' ? `${money(priceFor(g.tp, g.guests))} × ${nightsText(S.nights)}` : `${guestsText(g.guests)} · ${money(priceFor(g.tp, g.guests))} × ${nightsText(S.nights)}`;
      return `<li><span>${esc(label)}<small>${esc(sub)}</small></span><span>${esc(money(priceFor(g.tp, g.guests) * S.nights * g.count))}</span></li>`;
    }).join('');
    const n = totalGuests();
    const over = n > C.maxGuests;
    return `<aside class="panel summary${withButton ? ' summary--collapsible' : ''}" aria-live="polite" aria-label="${esc(t('your_stay'))}">
      <h2 class="summary__title">${esc(t('your_stay'))}</h2>
      <div class="summary__dates">
        <div><span>${esc(t('check_in'))}</span><b>${esc(fdate(S.checkIn))}</b></div>
        ${icon('arrow')}
        <div><span>${esc(t('check_out'))}</span><b>${esc(fdate(S.checkOut))}</b></div>
      </div>
      <p class="muted" style="margin:0">${esc(nightsText(S.nights))}${n ? ' · ' + esc(guestsText(n)) : ''}</p>
      ${items ? `<ul class="summary__lines">${items}</ul>` : `<p class="muted" style="margin:0">${esc(t('empty_sel'))}</p>`}
      <div class="summary__total"><span>${esc(t('total'))}</span><b>${esc(money(totalPrice()))}</b></div>
      ${over ? `<div class="alert alert--error">${icon('alert')}<span>${esc(t('max_guests_note', { n: C.maxGuests }))} <a href="${esc(C.groupsUrl)}">${esc(t('search_group_link'))}</a></span></div>` : ''}
      ${withButton ? `<button class="btn btn-primary btn-lg btn-block" type="button" data-action="to-details"${!items || over ? ' disabled' : ''}>${esc(t('continue'))}${icon('arrow')}</button>` : ''}
      ${trustHtml()}
    </aside>`;
  }

  function placedHtml() {
    const placed = totalGuests();
    const want = Math.max(S.guests, placed);
    const done = placed >= S.guests && placed > 0;
    const pct = want ? Math.min(100, Math.round((placed / want) * 100)) : 0;
    return `<div class="placed${done ? ' is-done' : ''}" aria-live="polite">${icon('users')}<span>${esc(done ? t('bk_placed_done') : t('bk_placed', { placed, n: S.guests }))}</span><span class="placed__bar" aria-hidden="true"><span style="width:${pct}%"></span></span></div>`;
  }

  function typeCardHtml(tp) {
    const avail = S.avail ? S.avail[tp.id] || 0 : 0;
    const chosen = S.sel[tp.id] || [];
    const gender = tp.gender === 'male' ? t('men_only') : tp.gender === 'female' ? t('women_only') : '';
    const unit = tp.soldAs === 'bed' ? t('room_per_bed') : t('room_per_night');
    const minPrice = Math.min.apply(null, tp.prices.slice(0, tp.soldAs === 'bed' ? 1 : tp.capacity));
    const from = tp.soldAs !== 'bed' && !tp.prices.slice(0, tp.capacity).every((p) => p === tp.prices[0]);
    const img = tp.photo ? `<picture>${tp.photoSrcset ? `<source type="image/webp" srcset="${esc(tp.photoSrcset)}" sizes="(min-width: 700px) 240px, 100vw">` : ''}<img src="${esc(tp.photo)}" alt="" loading="lazy" decoding="async"></picture>` : '';

    let controls = '';
    if (avail > 0 || chosen.length) {
      if (tp.soldAs === 'bed') {
        controls = `<div class="type-card__row">
          <span>${esc(t('beds'))}</span>
          <span class="stepper">
            <button type="button" class="stepper__btn" data-action="dec" data-type="${tp.id}" aria-label="− ${esc(tp.name)}"${chosen.length ? '' : ' disabled'} data-key="dec-${tp.id}">${icon('minus')}</button>
            <output class="stepper__input" aria-live="polite">${chosen.length}</output>
            <button type="button" class="stepper__btn" data-action="inc" data-type="${tp.id}" aria-label="+ ${esc(tp.name)}"${chosen.length < avail ? '' : ' disabled'} data-key="inc-${tp.id}">${icon('plus')}</button>
          </span>
          <b>${chosen.length ? esc(money(tp.prices[0] * chosen.length * S.nights)) : ''}</b>
        </div>`;
      } else {
        const opts = (sel) => Array.from({ length: tp.capacity }, (_, i) => `<option value="${i + 1}"${i + 1 === sel ? ' selected' : ''}>${esc(guestsText(i + 1))}</option>`).join('');
        controls = chosen.map((g, i) => `
          <div class="unit-line">
            <span class="unit-line__name">${esc(tp.name)}${chosen.length > 1 ? ' ' + (i + 1) : ''}</span>
            <label class="sr-only" for="g-${tp.id}-${i}">${esc(t('guests_in_room'))}</label>
            <span class="field" style="flex:0 0 auto"><select id="g-${tp.id}-${i}" data-action="guests" data-type="${tp.id}" data-idx="${i}" data-key="g-${tp.id}-${i}">${opts(g)}</select></span>
            <span class="unit-line__amt">${esc(money(priceFor(tp, g) * S.nights))}</span>
            <button type="button" class="link-btn" data-action="remove" data-type="${tp.id}" data-idx="${i}">${esc(t('remove'))}</button>
          </div>`).join('')
          + `<div><button type="button" class="btn btn-secondary btn-sm" data-action="add" data-type="${tp.id}" data-key="add-${tp.id}"${chosen.length < avail ? '' : ' disabled'}>${icon('plus')}<span>${esc(t('add_room'))}</span></button></div>`;
      }
    }

    return `<article class="type-card${chosen.length ? ' is-selected' : ''}${avail > 0 || chosen.length ? '' : ' is-soldout'}${S.highlight === tp.id ? ' is-highlight' : ''}" id="type-${tp.id}">
      <div class="type-card__media">${img}${gender ? `<span class="chip chip--light">${esc(gender)}</span>` : ''}</div>
      <div class="type-card__body">
        <div class="type-card__top">
          <h3 class="type-card__title">${esc(tp.name)}</h3>
          <p class="price">${from ? `<span class="price__from">${esc(t('room_from'))}</span>` : ''}<b class="price__amount">${esc(money(minPrice))}</b><span class="price__unit">${esc(unit)}</span></p>
        </div>
        <span class="avail-tag${avail > 0 ? '' : ' is-none'}">${esc(avail > 0 ? t('available_n', { n: avail }) : t('sold_out'))}</span>
        ${(tp.facts || []).length ? `<ul class="facts-inline">${tp.facts.map((f) => `<li>${icon(f.icon)}<span>${esc(f.text)}</span></li>`).join('')}</ul>` : ''}
        ${tp.note ? `<p class="type-card__note">${icon('info', 'ico-sm')}<span>${esc(tp.note)}</span></p>` : ''}
        ${controls ? `<div class="type-card__controls">${controls}</div>` : ''}
      </div>
    </article>`;
  }

  function roomsHtml() {
    if (S.loading) return `<div class="skeleton-stack" aria-busy="true" aria-label="${esc(t('bk_loading'))}"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>`;
    const anyAvail = C.types.some((tp) => (S.avail[tp.id] || 0) > 0);
    if (!anyAvail) {
      return `<div class="empty">
        <span class="empty__icon">${icon('calendar')}</span>
        <p>${esc(t('none_available'))}</p>
        <p class="muted"><span dir="ltr">${esc(C.contact.phones)}</span> · <a href="mailto:${esc(C.contact.email)}">${esc(C.contact.email)}</a></p>
      </div>`;
    }
    const n = totalGuests();
    const bar = lines().length
      ? `<div class="book-bar"><span class="book-bar__total"><b>${esc(money(totalPrice()))}</b><span>${esc(nightsText(S.nights))} · ${esc(guestsText(n))}</span></span>
          <button class="btn btn-primary" type="button" data-action="to-details"${n > C.maxGuests ? ' disabled' : ''}>${esc(t('continue'))}</button></div>`
      : '';
    return `<div class="book-layout">
      <div>
        ${S.error ? `<div class="alert alert--error" role="alert">${icon('alert')}<span>${esc(S.error)}</span></div>` : ''}
        ${placedHtml()}
        ${C.types.map(typeCardHtml).join('')}
        ${bar}
      </div>
      ${summaryHtml(true)}
    </div>`;
  }

  function countryOptions() {
    let names;
    try { names = new Intl.DisplayNames([C.locale], { type: 'region' }); } catch (_) { names = null; }
    const list = COUNTRIES.map((c) => ({ c, n: names ? names.of(c) : c })).sort((a, b) => a.n.localeCompare(b.n, C.locale));
    return `<option value="">${esc(t('choose'))}</option>` + list.map((x) => `<option value="${x.c}"${x.c === S.contact.country ? ' selected' : ''}>${esc(x.n)}</option>`).join('');
  }

  function detailsHtml() {
    syncTravelers();
    const needs = genderNeeds();
    const hints = [];
    if (needs.men) hints.push(t('men_needed', { n: needs.men }));
    if (needs.women) hints.push(t('women_needed', { n: needs.women }));
    const travelers = S.travelers.map((tr, i) => `
      <div class="traveler">
        <div class="field"><label for="tn-${i}">${esc(t('traveler_n', { n: i + 1 }))} – ${esc(t('full_name'))}</label>
          <input id="tn-${i}" type="text" autocomplete="off" maxlength="100" value="${esc(tr.name)}" data-bind="tname" data-idx="${i}" required></div>
        <div class="field"><span class="field__label" id="gl-${i}">${esc(t('gender'))}</span>
          <div class="seg" role="radiogroup" aria-labelledby="gl-${i}" data-gender-idx="${i}">
            <label><input type="radio" name="g${i}" value="male" data-bind="tgender" data-idx="${i}"${tr.gender === 'male' ? ' checked' : ''}><span>${esc(t('male'))}</span></label>
            <label><input type="radio" name="g${i}" value="female" data-bind="tgender" data-idx="${i}"${tr.gender === 'female' ? ' checked' : ''}><span>${esc(t('female'))}</span></label>
          </div>
        </div>
      </div>`).join('');

    const showChoice = C.paymentMode === 'paypal_or_arrival' && C.onlineAvailable;
    const payChoice = showChoice ? `
      <fieldset style="border:0;padding:0;margin:24px 0 0">
        <legend class="panel__sub" style="margin-top:0">${esc(t('pay_how'))}</legend>
        <div class="radio-list">
          <label class="radio-card"><input type="radio" name="pay" value="paypal" data-bind="pay"${S.payMethod === 'paypal' ? ' checked' : ''}><span>${esc(t('pay_paypal'))}</span></label>
          <label class="radio-card"><input type="radio" name="pay" value="arrival" data-bind="pay"${S.payMethod === 'arrival' ? ' checked' : ''}><span>${esc(t('pay_arrival'))}</span></label>
        </div>
      </fieldset>` : '';
    const submitLabel = S.payMethod === 'arrival' ? t('confirm_booking') : t('to_payment');

    return `<div class="book-layout">
      <form class="panel" data-form="details" novalidate>
        <h2 class="panel__title">${esc(t('details_title'))}</h2>
        <div class="msg" data-msg>${S.error ? `<div class="alert alert--error" role="alert">${icon('alert')}<span>${esc(S.error)}</span></div>` : ''}</div>
        <div class="form-grid">
          <div class="field"><label for="c-name">${esc(t('full_name'))}</label><input id="c-name" type="text" autocomplete="name" maxlength="100" required value="${esc(S.contact.name)}" data-bind="name"></div>
          <div class="field"><label for="c-email">${esc(t('email_l'))}</label><input id="c-email" type="email" autocomplete="email" maxlength="200" required value="${esc(S.contact.email)}" data-bind="email" dir="ltr"></div>
          <div class="field"><label for="c-phone">${esc(t('phone'))}</label><input id="c-phone" type="tel" autocomplete="tel" maxlength="40" required value="${esc(S.contact.phone)}" data-bind="phone" dir="ltr"></div>
          <div class="field"><label for="c-country">${esc(t('country'))}</label><select id="c-country" autocomplete="country" data-bind="country">${countryOptions()}</select></div>
        </div>
        <h3 class="panel__sub">${esc(t('travelers_title'))}</h3>
        <p class="hint">${icon('info', 'ico-sm')}<span>${esc(t('travelers_help'))}</span></p>
        ${hints.length ? `<p class="type-card__note">${icon('users', 'ico-sm')}<span>${hints.map(esc).join('<br>')}</span></p>` : ''}
        ${travelers}
        <div class="field" style="margin-top:16px"><label for="c-notes">${esc(t('notes'))}</label><textarea id="c-notes" maxlength="2000" data-bind="notes">${esc(S.notes)}</textarea></div>
        ${payChoice}
        <label class="check" data-accept-wrap><input type="checkbox" data-bind="accept"${S.accept ? ' checked' : ''}><span>${esc(t('accept_terms'))} <a href="${esc(C.termsUrl)}" target="_blank" rel="noopener">${esc(t('terms_link'))}</a></span></label>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" data-action="back-rooms">${esc(t('back'))}</button>
          <button type="submit" class="btn btn-primary btn-lg" data-submit${S.busy ? ' disabled' : ''}>${S.busy ? '<span class="spinner"></span>' : ''}<span>${esc(submitLabel)}</span></button>
        </div>
      </form>
      ${summaryHtml(false)}
    </div>`;
  }

  function paymentHtml() {
    const b = S.booking;
    let body;
    if (C.demo) {
      body = `<p class="demo-note">${icon('info', 'ico-sm')}<span>${esc(t('demo_notice'))}</span></p>
        <button type="button" class="btn btn-primary btn-lg btn-block" data-action="demo-pay"${S.busy ? ' disabled' : ''}>${S.busy ? '<span class="spinner"></span>' : icon('shield')}<span>${esc(t('demo_pay'))}</span></button>`;
    } else if (C.paypal) {
      body = `<p class="hint">${icon('shield', 'ico-sm')}<span>${esc(t('pay_secure'))}</span></p><div id="paypal-buttons"><span class="spinner"></span></div>`;
    } else {
      body = `<div class="alert">${icon('info')}<span>${esc(t('e_payment_unavailable'))}</span></div>`;
    }
    const box = `<div class="panel pay-box">
      <h2 class="panel__title">${esc(t('pay_title'))}</h2>
      <div class="pay-meta"><span>${esc(t('bk_code'))}: <b>${esc(b.code)}</b></span>${S.checkIn ? `<span>${esc(fdate(S.checkIn))} – ${esc(fdate(S.checkOut))}</span>` : ''}</div>
      <p class="muted" style="margin:0">${esc(t('pay_amount'))}</p>
      <p class="pay-amount">${esc(money(b.total))}</p>
      <p class="hold" data-hold>${icon('clock', 'ico-sm')}<span>${esc(t('hold_notice', { t: '' }))}</span></p>
      <div data-pay-area>${body}</div>
      <div class="msg" role="alert" data-pay-msg></div>
    </div>`;
    if (MODE === 'resume' || !lines().length) return box;
    return `<div class="book-layout"><div>${box}</div>${summaryHtml(false)}</div>`;
  }

  function render() {
    const active = document.activeElement;
    const key = active && root.contains(active) ? active.getAttribute('data-key') : null;
    let html = '';
    if (MODE === 'resume') {
      html = paymentHtml();
    } else {
      html = progressHtml();
      if (S.step <= 2) {
        html += searchHtml();
        if (S.step === 1 && S.error) html += `<div class="alert alert--error" role="alert" style="margin-top:16px">${icon('alert')}<span>${esc(S.error)}</span></div>`;
        if (S.step === 2 && (S.avail || S.loading)) html += `<div style="margin-top:28px" data-results>${roomsHtml()}</div>`;
      } else if (S.step === 3) html += detailsHtml();
      else html += paymentHtml();
    }
    root.innerHTML = html;
    if (UI.enhanceDates) UI.enhanceDates(root);
    if (UI.enhanceSteppers) UI.enhanceSteppers(root);
    if (key) {
      const el = root.querySelector(`[data-key="${key}"]`);
      if (el && !el.disabled) el.focus();
    }
    if (MODE === 'resume' || S.step === 4) afterPaymentRender();
  }

  // ---------------------------------------------------------------- step 1-2: search & select
  function openDates() {
    const box = root.querySelector('[data-daterange]');
    if (box && box.openPicker) box.openPicker();
  }

  async function search() {
    S.error = '';
    if (!isDate(S.checkIn) || !isDate(S.checkOut) || S.checkOut <= S.checkIn) {
      if (S.step === 1 && !S.checkIn && !S.checkOut) { openDates(); return; }
      S.error = errText('dates_invalid');
      S.step = 1;
      render();
      return;
    }
    S.loading = true;
    S.step = 2;
    render();
    try {
      const d = await api('GET', `/api/public/availability?checkIn=${S.checkIn}&checkOut=${S.checkOut}`);
      S.nights = d.nights;
      S.avail = d.available;
      Object.keys(S.sel).forEach((id) => {
        const max = S.avail[id] || 0;
        if (S.sel[id].length > max) S.sel[id] = S.sel[id].slice(0, max);
      });
      // preselect the room type the guest came from, sized to the number of guests
      if (S.highlight && TYPES[S.highlight] && !lines().length && (S.avail[S.highlight] || 0) > 0) {
        const tp = TYPES[S.highlight];
        S.sel[tp.id] = tp.soldAs === 'bed'
          ? Array.from({ length: Math.min(S.guests, S.avail[tp.id]) }, () => 1)
          : [Math.min(S.guests, tp.capacity)];
      }
      S.loading = false;
      render();
      const results = root.querySelector('[data-results]');
      if (results && window.innerWidth < 1000 && !S.highlight) results.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (S.highlight) {
        const card = document.getElementById('type-' + S.highlight);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (e) {
      S.loading = false;
      S.avail = null;
      S.error = errText(e.code);
      S.step = 1;
      render();
    }
  }

  // ---------------------------------------------------------------- step 3: details
  function validateDetails() {
    const form = root.querySelector('[data-form="details"]');
    form.querySelectorAll('.invalid, [aria-invalid]').forEach((el) => { el.classList.remove('invalid'); el.removeAttribute('aria-invalid'); });
    const bad = [];
    const mark = (sel) => {
      const el = form.querySelector(sel);
      if (el) { el.classList.add('invalid'); el.setAttribute('aria-invalid', 'true'); bad.push(el); }
    };
    let msg = '';
    if (S.contact.name.trim().length < 2) { mark('[data-bind="name"]'); msg = msg || errText('name_required'); }
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(S.contact.email.trim())) { mark('[data-bind="email"]'); msg = msg || errText('email_invalid'); }
    if (S.contact.phone.replace(/\D/g, '').length < 6) { mark('[data-bind="phone"]'); msg = msg || errText('phone_required'); }
    S.travelers.forEach((tr, i) => {
      if (tr.name.trim().length < 2) { mark(`[data-bind="tname"][data-idx="${i}"]`); msg = msg || errText('travelers_incomplete'); }
      if (!tr.gender) { mark(`[data-gender-idx="${i}"]`); msg = msg || errText('travelers_incomplete'); }
    });
    if (!msg) {
      const needs = genderNeeds();
      const men = S.travelers.filter((x) => x.gender === 'male').length;
      const women = S.travelers.filter((x) => x.gender === 'female').length;
      if (needs.men > men || needs.women > women) msg = errText('gender_mismatch');
    }
    if (!msg && !S.accept) { mark('[data-accept-wrap]'); msg = errText('terms_required'); }
    return { msg, first: bad[0] };
  }

  async function submitDetails() {
    const v = validateDetails();
    const msgBox = root.querySelector('[data-form="details"] [data-msg]');
    if (v.msg) {
      msgBox.innerHTML = `<div class="alert alert--error" role="alert">${icon('alert')}<span>${esc(v.msg)}</span></div>`;
      const target = v.first && (v.first.querySelector ? v.first.querySelector('input') || v.first : v.first);
      if (target && target.focus) target.focus();
      else msgBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    S.busy = true;
    S.error = '';
    const btn = root.querySelector('[data-submit]');
    if (btn) { btn.disabled = true; btn.insertAdjacentHTML('afterbegin', '<span class="spinner"></span>'); }
    try {
      const d = await api('POST', '/api/public/bookings', {
        lang: C.lang,
        checkIn: S.checkIn,
        checkOut: S.checkOut,
        lines: lines(),
        contact: { name: S.contact.name.trim(), email: S.contact.email.trim(), phone: S.contact.phone.trim(), country: S.contact.country },
        travelers: S.travelers.map((x) => ({ name: x.name.trim(), gender: x.gender })),
        notes: S.notes,
        acceptTerms: S.accept,
        payMethod: S.payMethod,
      });
      S.busy = false;
      if (d.status === 'confirmed') {
        window.location.href = d.redirect;
        return;
      }
      S.booking = { token: d.token, code: d.code, total: d.total, currency: d.currency, expiresAt: d.expiresAt };
      S.step = 4;
      render();
      scrollToApp();
    } catch (e) {
      S.busy = false;
      if (e.code === 'no_availability') {
        S.sel = {};
        await search();
        S.error = errText('no_availability');
        render();
        return;
      }
      S.error = errText(e.code);
      render();
      const box = root.querySelector('[data-msg]');
      if (box) box.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  // ---------------------------------------------------------------- step 4: payment
  let timer = null;
  let lastPayError = null;

  function afterPaymentRender() {
    startTimer();
    if (C.paypal && !C.demo) mountPaypal();
  }

  function startTimer() {
    clearInterval(timer);
    const holdEl = root.querySelector('[data-hold] span');
    if (!holdEl || !S.booking) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(S.booking.expiresAt).getTime() - Date.now()) / 1000));
      const mm = String(Math.floor(left / 60)).padStart(2, '0');
      const ss = String(left % 60).padStart(2, '0');
      holdEl.innerHTML = esc(t('hold_notice', { t: '§' })).replace('§', `<span class="timer">${mm}:${ss}</span>`);
      if (left <= 0) {
        clearInterval(timer);
        const area = root.querySelector('[data-pay-area]');
        if (area) area.innerHTML = '';
        payMessage('hold_expired', true);
      }
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  function payMessage(code, withLink) {
    const box = root.querySelector('[data-pay-msg]');
    if (!box) return;
    const link = withLink ? ` <a href="${esc(window.location.pathname.replace(/\/booking\/.*$/, '/book'))}">${esc(t('bk_search_again'))}</a>` : '';
    box.innerHTML = `<div class="alert alert--error" style="margin-top:16px">${icon('alert')}<span>${esc(errText(code))}${link}</span></div>`;
  }

  function setProcessing(on) {
    const area = root.querySelector('[data-pay-area]');
    if (!area) return;
    area.style.display = on ? 'none' : '';
    const p = root.querySelector('[data-processing]');
    if (on && !p) area.insertAdjacentHTML('afterend', `<p class="processing" data-processing><span class="spinner"></span> ${esc(t('processing'))}</p>`);
    if (!on && p) p.remove();
  }

  function loadPaypalSdk() {
    return new Promise((resolve, reject) => {
      if (window.paypal && window.paypal.Buttons) return resolve(window.paypal);
      const s = document.createElement('script');
      s.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(C.paypal.clientId)
        + '&currency=' + encodeURIComponent(C.currency) + '&intent=capture&components=buttons'
        + '&locale=' + encodeURIComponent(C.paypal.locale) + '&disable-funding=paylater,venmo';
      s.onload = () => resolve(window.paypal);
      s.onerror = () => reject(new Error('paypal_load'));
      document.head.appendChild(s);
    });
  }

  async function refreshBooking() {
    try {
      const d = await api('GET', `/api/public/bookings/${encodeURIComponent(S.booking.token)}`);
      S.booking.expiresAt = d.expiresAt;
    } catch (_) { /* keep old timer */ }
  }

  function mountPaypal() {
    const target = root.querySelector('#paypal-buttons');
    if (!target) return;
    const token = encodeURIComponent(S.booking.token);
    loadPaypalSdk().then((paypal) => {
      target.innerHTML = '';
      return paypal.Buttons({
        style: { layout: 'vertical', shape: 'pill', label: 'pay', height: 50 },
        createOrder: () => api('POST', `/api/public/bookings/${token}/paypal-order`)
          .then((d) => { refreshBooking(); return d.id; })
          .catch((e) => { lastPayError = e.code; throw e; }),
        onApprove: (data, actions) => {
          setProcessing(true);
          return api('POST', `/api/public/bookings/${token}/paypal-capture`, { orderId: data.orderID })
            .then((d) => { window.location.href = d.redirect; })
            .catch((e) => {
              setProcessing(false);
              if (e.code === 'INSTRUMENT_DECLINED') return actions.restart();
              payMessage(e.code, e.code === 'hold_expired');
              return undefined;
            });
        },
        onError: () => {
          setProcessing(false);
          payMessage(lastPayError || 'payment_failed', lastPayError === 'hold_expired');
        },
      }).render(target);
    }).catch(() => {
      target.innerHTML = '';
      payMessage('paypal_load');
    });
  }

  async function demoPay() {
    S.busy = true;
    render();
    try {
      const d = await api('POST', `/api/public/bookings/${encodeURIComponent(S.booking.token)}/demo-pay`);
      window.location.href = d.redirect;
    } catch (e) {
      S.busy = false;
      render();
      payMessage(e.code, e.code === 'hold_expired');
    }
  }

  // ---------------------------------------------------------------- events
  root.addEventListener('submit', (e) => {
    const form = e.target.closest('form');
    if (!form) return;
    e.preventDefault();
    if (form.getAttribute('data-form') === 'dates') {
      S.checkIn = form.checkIn.value;
      S.checkOut = form.checkOut.value;
      if (!S.checkIn || !S.checkOut) { openDates(); return; }
      search();
    } else if (form.getAttribute('data-form') === 'details') {
      submitDetails();
    }
  });

  // choosing dates in the calendar searches straight away
  root.addEventListener('dates:close', (e) => {
    const d = e.detail || {};
    if (!d.done || !isDate(d.checkIn) || !isDate(d.checkOut)) return;
    if (d.checkIn === S.checkIn && d.checkOut === S.checkOut && S.avail) return;
    S.checkIn = d.checkIn;
    S.checkOut = d.checkOut;
    search();
  });

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const action = btn.getAttribute('data-action');
    const id = btn.getAttribute('data-type');
    const idx = Number(btn.getAttribute('data-idx'));
    const tp = TYPES[id];
    S.error = '';
    if (action === 'add' || action === 'inc') {
      S.sel[id] = S.sel[id] || [];
      if (S.sel[id].length < (S.avail[id] || 0)) {
        const left = Math.max(1, S.guests - totalGuests());
        S.sel[id].push(tp.soldAs === 'bed' ? 1 : Math.min(left, tp.capacity));
      }
      render();
    } else if (action === 'dec') {
      (S.sel[id] || []).pop();
      render();
    } else if (action === 'remove') {
      S.sel[id].splice(idx, 1);
      render();
    } else if (action === 'to-details') {
      if (!lines().length || totalGuests() > C.maxGuests) return;
      S.step = 3;
      render();
      scrollToApp();
    } else if (action === 'back-rooms') {
      S.step = 2;
      render();
      scrollToApp();
    } else if (action === 'demo-pay') {
      demoPay();
    }
  });

  root.addEventListener('change', (e) => {
    const el = e.target;
    if (el.getAttribute('data-action') === 'guests') {
      S.sel[el.getAttribute('data-type')][Number(el.getAttribute('data-idx'))] = Number(el.value);
      render();
      return;
    }
    if (el.name === 'checkIn') S.checkIn = el.value;
    if (el.name === 'checkOut') S.checkOut = el.value;
    bind(el);
    if (el.getAttribute('data-bind') === 'pay') render();
    if (el.getAttribute('data-bind') === 'guests' && S.step === 2 && !S.loading) {
      const placed = root.querySelector('.placed');
      if (placed) placed.outerHTML = placedHtml();
    }
  });

  root.addEventListener('input', (e) => bind(e.target));

  function bind(el) {
    const b = el.getAttribute('data-bind');
    if (!b) return;
    const i = Number(el.getAttribute('data-idx'));
    if (b === 'name') S.contact.name = el.value;
    else if (b === 'email') S.contact.email = el.value;
    else if (b === 'phone') S.contact.phone = el.value;
    else if (b === 'country') S.contact.country = el.value;
    else if (b === 'tname') S.travelers[i].name = el.value;
    else if (b === 'tgender') S.travelers[i].gender = el.value;
    else if (b === 'notes') S.notes = el.value;
    else if (b === 'accept') S.accept = el.checked;
    else if (b === 'pay') S.payMethod = el.value;
    else if (b === 'guests') S.guests = Math.min(C.maxGuests, Math.max(1, Number(el.value) || 1));
    el.classList.remove('invalid');
    el.removeAttribute('aria-invalid');
    const seg = el.closest('.seg');
    if (seg) { seg.classList.remove('invalid'); seg.removeAttribute('aria-invalid'); }
    const acc = el.closest('[data-accept-wrap]');
    if (acc) { acc.classList.remove('invalid'); acc.removeAttribute('aria-invalid'); }
  }

  // Copy the contact name into traveller 1 when it is still empty
  root.addEventListener('focusout', (e) => {
    if (e.target.getAttribute('data-bind') === 'name' && S.travelers[0] && !S.travelers[0].name && S.contact.name.trim()) {
      S.travelers[0].name = S.contact.name.trim();
      const first = root.querySelector('[data-bind="tname"][data-idx="0"]');
      if (first) first.value = S.travelers[0].name;
    }
  });

  // ---------------------------------------------------------------- start
  if (MODE === 'resume') {
    S.booking = C.resume;
    render();
  } else if (S.checkIn && S.checkOut) {
    search();
  } else {
    render();
  }
})();
