/* Bethel Hostel – booking app: dates -> rooms -> details -> PayPal payment */
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
  const nf0 = new Intl.NumberFormat(C.locale, { style: 'currency', currency: C.currency, maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat(C.locale, { style: 'currency', currency: C.currency });
  function money(n) {
    n = Number(n) || 0;
    return (n % 1 ? nf2 : nf0).format(n);
  }
  const df = new Intl.DateTimeFormat(C.locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  function fdate(s) { return df.format(new Date(s + 'T00:00:00Z')); }
  function addDays(s, n) {
    const d = new Date(s + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function nightsBetween(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5); }
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
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    let data = {};
    try { data = await res.json(); } catch (_) { /* empty */ }
    if (!res.ok) {
      const err = new Error(data.error || 'generic');
      err.code = data.error || 'generic';
      throw err;
    }
    return data;
  }

  // ---------------------------------------------------------------- state
  const init = C.initial || {};
  const S = {
    step: 1,
    checkIn: isDate(init.checkIn) ? init.checkIn : '',
    checkOut: isDate(init.checkOut) ? init.checkOut : '',
    nights: 0,
    avail: null,
    sel: {}, // typeId -> [guests, guests, ...] (one entry per room or bed)
    highlight: init.typeId || null,
    contact: { name: '', email: '', phone: '', country: C.lang === 'he' ? 'IL' : '' },
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
  function stepsHtml() {
    const names = [t('s_dates'), t('s_rooms'), t('s_details'), t('s_payment')];
    const cur = S.step === 1 ? 1 : S.step;
    return '<ol class="steps">' + names.map((n, i) => {
      const k = i + 1;
      const cls = k === cur ? 'on' : k < cur ? 'done' : '';
      return `<li class="${cls}"${k === cur ? ' aria-current="step"' : ''}>${esc(n)}</li>`;
    }).join('') + '</ol>';
  }

  function datesHtml() {
    return `<form class="panel date-bar" data-form="dates">
      <label class="field"><span>${esc(t('check_in'))}</span><input type="date" name="checkIn" required min="${C.today}" max="${C.maxDate}" value="${esc(S.checkIn)}" data-key="in"></label>
      <label class="field"><span>${esc(t('check_out'))}</span><input type="date" name="checkOut" required min="${esc(S.checkIn ? addDays(S.checkIn, 1) : addDays(C.today, 1))}" max="${esc(addDays(C.maxDate, C.maxNights))}" value="${esc(S.checkOut)}" data-key="out"></label>
      <button class="btn btn-accent" type="submit">${esc(t('search'))}</button>
    </form>`;
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
      const label = g.tp.soldAs === 'bed' ? `${g.count} × ${g.tp.name}` : `${g.count} × ${g.tp.name} (${guestsText(g.guests)})`;
      return `<li><span>${esc(label)}</span><span>${esc(money(priceFor(g.tp, g.guests) * S.nights * g.count))}</span></li>`;
    }).join('');
    const n = totalGuests();
    const over = n > C.maxGuests;
    return `<aside class="panel summary" aria-live="polite">
      <h3>${esc(t('your_stay'))}</h3>
      <p class="sum-dates">${esc(fdate(S.checkIn))} → ${esc(fdate(S.checkOut))}<br>${esc(nightsText(S.nights))}${n ? ' · ' + esc(guestsText(n)) : ''}</p>
      ${items ? `<ul class="sum-lines">${items}</ul>` : `<p class="muted small">${esc(t('empty_sel'))}</p>`}
      <div class="sum-total"><span>${esc(t('total'))}</span><b>${esc(money(totalPrice()))}</b></div>
      ${over ? `<p class="msg alert alert-error small">${esc(t('max_guests_note', { n: C.maxGuests }))}</p>` : ''}
      ${withButton ? `<p style="margin-top:14px"><button class="btn btn-accent" type="button" data-action="to-details" style="width:100%"${!items || over ? ' disabled' : ''}>${esc(t('continue'))}</button></p>` : ''}
    </aside>`;
  }

  function typeCardHtml(tp) {
    const avail = S.avail ? S.avail[tp.id] || 0 : 0;
    const chosen = S.sel[tp.id] || [];
    const meta = [];
    meta.push(avail > 0 ? `<span class="avail">${esc(t('available_n', { n: avail }))}</span>` : `<span class="avail none">${esc(t('sold_out'))}</span>`);
    if (tp.soldAs === 'room') meta.push(`<span>${esc(t('up_to', { n: tp.capacity }))}</span>`);
    if (tp.gender === 'male') meta.push(`<span>${esc(t('men_only'))}</span>`);
    if (tp.gender === 'female') meta.push(`<span>${esc(t('women_only'))}</span>`);

    let prices;
    if (tp.soldAs === 'bed') prices = `${esc(money(tp.prices[0]))} ${esc(t('per_bed_night'))}`;
    else {
      prices = tp.prices.slice(0, tp.capacity).map((p, i) => `${esc(guestsText(i + 1))}: ${esc(money(p))}`).join(' · ') + ` <span class="muted">(${esc(t('per_night'))})</span>`;
    }

    let controls = '';
    if (avail > 0 || chosen.length) {
      if (tp.soldAs === 'bed') {
        controls = `<div class="type-actions">
          <span>${esc(t('beds'))}</span>
          <span class="stepper">
            <button type="button" data-action="dec" data-type="${tp.id}" aria-label="−"${chosen.length ? '' : ' disabled'} data-key="dec-${tp.id}">−</button>
            <output aria-live="polite">${chosen.length}</output>
            <button type="button" data-action="inc" data-type="${tp.id}" aria-label="+"${chosen.length < avail ? '' : ' disabled'} data-key="inc-${tp.id}">+</button>
          </span>
          ${chosen.length ? `<b>${esc(money(tp.prices[0] * chosen.length * S.nights))}</b>` : ''}
        </div>`;
      } else {
        const opts = (sel) => Array.from({ length: tp.capacity }, (_, i) => `<option value="${i + 1}"${i + 1 === sel ? ' selected' : ''}>${i + 1}</option>`).join('');
        controls = (chosen.length ? `<div class="unit-lines">${chosen.map((g, i) => `
          <div class="unit-line">
            <b>${esc(tp.name)} ${chosen.length > 1 ? i + 1 : ''}</b>
            <label>${esc(t('guests_in_room'))}
              <select data-action="guests" data-type="${tp.id}" data-idx="${i}" data-key="g-${tp.id}-${i}">${opts(g)}</select></label>
            <span class="amt">${esc(money(priceFor(tp, g) * S.nights))}</span>
            <button type="button" class="link-btn" data-action="remove" data-type="${tp.id}" data-idx="${i}">${esc(t('remove'))}</button>
          </div>`).join('')}</div>` : '')
          + `<div class="type-actions"><button type="button" class="btn btn-ghost btn-sm" data-action="add" data-type="${tp.id}" data-key="add-${tp.id}"${chosen.length < avail ? '' : ' disabled'}>+ ${esc(t('add_room'))}</button></div>`;
      }
    }

    return `<article class="type-card${avail > 0 || chosen.length ? '' : ' disabled'}${S.highlight === tp.id ? ' highlight' : ''}" id="type-${tp.id}">
      <div class="type-photo">${tp.photo ? `<img src="${esc(tp.photo)}" alt="" loading="lazy">` : ''}</div>
      <div>
        <h3>${esc(tp.name)}</h3>
        <div class="type-meta">${meta.join('<span aria-hidden="true">·</span>')}</div>
        ${tp.description ? `<p class="muted small" style="margin-bottom:6px">${esc(tp.description)}</p>` : ''}
        ${tp.note ? `<span class="type-note">${esc(tp.note)}</span>` : ''}
        <div class="type-prices">${prices}</div>
        ${controls}
      </div>
    </article>`;
  }

  function roomsHtml() {
    const anyAvail = C.types.some((tp) => (S.avail[tp.id] || 0) > 0);
    const list = anyAvail
      ? C.types.map(typeCardHtml).join('')
      : `<div class="alert">${esc(t('none_available'))} <span dir="ltr">${esc(C.contact.phones)}</span></div>`;
    const n = totalGuests();
    const mobileBar = lines().length
      ? `<div class="mobile-bar"><span><b>${esc(money(totalPrice()))}</b> · ${esc(nightsText(S.nights))} · ${esc(guestsText(n))}</span>
          <button class="btn btn-accent btn-sm" type="button" data-action="to-details"${n > C.maxGuests ? ' disabled' : ''}>${esc(t('continue'))}</button></div>`
      : '';
    return `<div class="book-layout"><div>${S.error ? `<div class="alert alert-error" role="alert">${esc(S.error)}</div>` : ''}${list}${mobileBar}</div>${summaryHtml(true)}</div>`;
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
        <label class="field"><span>${esc(t('traveler_n', { n: i + 1 }))} – ${esc(t('full_name'))}</span>
          <input type="text" autocomplete="off" maxlength="100" value="${esc(tr.name)}" data-bind="tname" data-idx="${i}" required></label>
        <div class="field"><span id="gl-${i}">${esc(t('gender'))}</span>
          <div class="seg" role="radiogroup" aria-labelledby="gl-${i}" data-gender-idx="${i}">
            <label><input type="radio" name="g${i}" value="male" data-bind="tgender" data-idx="${i}"${tr.gender === 'male' ? ' checked' : ''}><span>${esc(t('male'))}</span></label>
            <label><input type="radio" name="g${i}" value="female" data-bind="tgender" data-idx="${i}"${tr.gender === 'female' ? ' checked' : ''}><span>${esc(t('female'))}</span></label>
          </div>
        </div>
      </div>`).join('');

    const showChoice = C.paymentMode === 'paypal_or_arrival' && C.onlineAvailable;
    const payChoice = showChoice ? `
      <fieldset class="field" style="border:0;padding:0;margin:14px 0">
        <legend style="font-weight:600;margin-bottom:8px">${esc(t('pay_how'))}</legend>
        <div class="radio-list">
          <label class="radio-card"><input type="radio" name="pay" value="paypal" data-bind="pay"${S.payMethod === 'paypal' ? ' checked' : ''}><span>${esc(t('pay_paypal'))}</span></label>
          <label class="radio-card"><input type="radio" name="pay" value="arrival" data-bind="pay"${S.payMethod === 'arrival' ? ' checked' : ''}><span>${esc(t('pay_arrival'))}</span></label>
        </div>
      </fieldset>` : '';
    const submitLabel = S.payMethod === 'arrival' ? t('confirm_booking') : t('to_payment');

    return `<div class="book-layout">
      <form class="panel" data-form="details" novalidate>
        <h2 style="font-size:1.5rem">${esc(t('details_title'))}</h2>
        <div class="grid-2">
          <label class="field"><span>${esc(t('full_name'))}</span><input type="text" autocomplete="name" maxlength="100" required value="${esc(S.contact.name)}" data-bind="name"></label>
          <label class="field"><span>${esc(t('email_l'))}</span><input type="email" autocomplete="email" maxlength="200" required value="${esc(S.contact.email)}" data-bind="email" dir="ltr"></label>
          <label class="field"><span>${esc(t('phone'))}</span><input type="tel" autocomplete="tel" maxlength="40" required value="${esc(S.contact.phone)}" data-bind="phone" dir="ltr"></label>
          <label class="field"><span>${esc(t('country'))}</span><select autocomplete="country" data-bind="country">${countryOptions()}</select></label>
        </div>
        <h3 style="margin-top:10px">${esc(t('travelers_title'))}</h3>
        <p class="help">${esc(t('travelers_help'))}</p>
        ${hints.length ? `<p class="type-note">${hints.map(esc).join('<br>')}</p>` : ''}
        ${travelers}
        <label class="field" style="margin-top:14px"><span>${esc(t('notes'))}</span><textarea maxlength="2000" data-bind="notes">${esc(S.notes)}</textarea></label>
        ${payChoice}
        <label class="check"><input type="checkbox" data-bind="accept"${S.accept ? ' checked' : ''}><span>${esc(t('accept_terms'))} <a href="${esc(C.termsUrl)}" target="_blank" rel="noopener">${esc(t('terms_link'))}</a></span></label>
        <div class="msg" role="alert">${S.error ? `<div class="alert alert-error">${esc(S.error)}</div>` : ''}</div>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" data-action="back-rooms">${esc(t('back'))}</button>
          <button type="submit" class="btn btn-accent" data-submit${S.busy ? ' disabled' : ''}>${S.busy ? '<span class="spinner"></span>' : ''} ${esc(submitLabel)}</button>
        </div>
      </form>
      ${summaryHtml(false)}
    </div>`;
  }

  function paymentHtml() {
    const b = S.booking;
    let body;
    if (C.demo) {
      body = `<div class="demo-banner">${esc(t('demo_notice'))}</div>
        <button type="button" class="btn btn-accent" data-action="demo-pay"${S.busy ? ' disabled' : ''}>${S.busy ? '<span class="spinner"></span> ' : ''}${esc(t('demo_pay'))}</button>`;
    } else if (C.paypal) {
      body = `<p class="muted small">${esc(t('pay_secure'))}</p><div id="paypal-buttons"><span class="spinner"></span></div>`;
    } else {
      body = `<div class="alert">${esc(t('e_payment_unavailable'))}</div>`;
    }
    return `<div class="panel pay-box">
      <h2 style="font-size:1.5rem">${esc(t('pay_title'))}</h2>
      <p class="muted" style="margin:0">${esc(t('bk_code'))}: <b>${esc(b.code)}</b></p>
      <p class="muted" style="margin:10px 0 0">${esc(t('pay_amount'))}</p>
      <p class="pay-amount">${esc(money(b.total))}</p>
      <p class="hold" data-hold>${esc(t('hold_notice', { t: '' }))}</p>
      <div data-pay-area>${body}</div>
      <div class="msg" role="alert" data-pay-msg></div>
    </div>`;
  }

  function render() {
    const active = document.activeElement;
    const key = active && root.contains(active) ? active.getAttribute('data-key') : null;
    let html = '';
    if (MODE === 'resume') {
      html = paymentHtml();
    } else {
      html = stepsHtml();
      if (S.step <= 2) html += datesHtml() + (S.step === 2 && S.avail ? roomsHtml() : '');
      else if (S.step === 3) html += detailsHtml();
      else html += paymentHtml();
    }
    root.innerHTML = html;
    if (key) {
      const el = root.querySelector(`[data-key="${key}"]`);
      if (el && !el.disabled) el.focus();
    }
    if (MODE === 'resume' || S.step === 4) afterPaymentRender();
  }

  // ---------------------------------------------------------------- step 1-2: search & select
  async function search() {
    S.error = '';
    if (!isDate(S.checkIn) || !isDate(S.checkOut) || S.checkOut <= S.checkIn) {
      S.error = errText('dates_invalid');
      S.step = 1;
      render();
      showDatesError();
      return;
    }
    try {
      const d = await api('GET', `/api/public/availability?checkIn=${S.checkIn}&checkOut=${S.checkOut}`);
      S.nights = d.nights;
      S.avail = d.available;
      // drop selections that no longer fit
      Object.keys(S.sel).forEach((id) => {
        const max = S.avail[id] || 0;
        if (S.sel[id].length > max) S.sel[id] = S.sel[id].slice(0, max);
      });
      // preselect a room type coming from a "Book" button
      if (S.highlight && TYPES[S.highlight] && !lines().length && (S.avail[S.highlight] || 0) > 0) {
        const tp = TYPES[S.highlight];
        S.sel[tp.id] = [tp.soldAs === 'bed' ? 1 : Math.min(2, tp.capacity)];
      }
      S.step = 2;
      render();
      if (S.highlight) {
        const card = document.getElementById('type-' + S.highlight);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (e) {
      S.error = errText(e.code);
      S.step = 1;
      render();
      showDatesError();
    }
  }

  function showDatesError() {
    const form = root.querySelector('[data-form="dates"]');
    if (form && S.error) form.insertAdjacentHTML('afterend', `<div class="alert alert-error" role="alert">${esc(S.error)}</div>`);
  }

  // ---------------------------------------------------------------- step 3: details
  function validateDetails() {
    const form = root.querySelector('[data-form="details"]');
    form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
    const bad = [];
    const mark = (sel) => {
      const el = form.querySelector(sel);
      if (el) { el.classList.add('invalid'); bad.push(el); }
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
    if (!msg && !S.accept) { mark('[data-bind="accept"]'); msg = errText('terms_required'); }
    return { msg, first: bad[0] };
  }

  async function submitDetails() {
    const v = validateDetails();
    const msgBox = root.querySelector('[data-form="details"] .msg');
    if (v.msg) {
      msgBox.innerHTML = `<div class="alert alert-error">${esc(v.msg)}</div>`;
      if (v.first) v.first.focus ? v.first.focus() : null;
      return;
    }
    S.busy = true;
    S.error = '';
    const btn = root.querySelector('[data-submit]');
    if (btn) { btn.disabled = true; btn.insertAdjacentHTML('afterbegin', '<span class="spinner"></span> '); }
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
      window.scrollTo({ top: root.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
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
    const holdEl = root.querySelector('[data-hold]');
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
    box.innerHTML = `<div class="alert alert-error">${esc(errText(code))}${link}</div>`;
  }

  function setProcessing(on) {
    const area = root.querySelector('[data-pay-area]');
    if (!area) return;
    area.style.display = on ? 'none' : '';
    let p = root.querySelector('[data-processing]');
    if (on && !p) area.insertAdjacentHTML('afterend', `<p data-processing><span class="spinner"></span> ${esc(t('processing'))}</p>`);
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
        style: { layout: 'vertical', shape: 'pill', label: 'pay', height: 48 },
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
      search();
    } else if (form.getAttribute('data-form') === 'details') {
      submitDetails();
    }
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
      if (S.sel[id].length < (S.avail[id] || 0)) S.sel[id].push(tp.soldAs === 'bed' ? 1 : Math.min(2, tp.capacity));
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
      window.scrollTo({ top: root.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
    } else if (action === 'back-rooms') {
      S.step = 2;
      render();
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
    if (el.name === 'checkIn') {
      S.checkIn = el.value;
      const out = root.querySelector('input[name="checkOut"]');
      if (out && el.value) {
        out.min = addDays(el.value, 1);
        if (!out.value || out.value <= el.value) out.value = addDays(el.value, 1);
        S.checkOut = out.value;
      }
    }
    if (el.name === 'checkOut') S.checkOut = el.value;
    bind(el);
    if (el.getAttribute('data-bind') === 'pay') render();
  });

  root.addEventListener('input', (e) => bind(e.target));

  function bind(el) {
    const b = el.getAttribute('data-bind');
    if (!b) return;
    const i = Number(el.getAttribute('data-idx'));
    if (b === 'name') {
      S.contact.name = el.value;
    } else if (b === 'email') S.contact.email = el.value;
    else if (b === 'phone') S.contact.phone = el.value;
    else if (b === 'country') S.contact.country = el.value;
    else if (b === 'tname') S.travelers[i].name = el.value;
    else if (b === 'tgender') S.travelers[i].gender = el.value;
    else if (b === 'notes') S.notes = el.value;
    else if (b === 'accept') S.accept = el.checked;
    else if (b === 'pay') S.payMethod = el.value;
    el.classList.remove('invalid');
    const seg = el.closest('.seg');
    if (seg) seg.classList.remove('invalid');
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
    render();
    search();
  } else {
    if (!S.checkIn) {
      S.checkIn = '';
      S.checkOut = '';
    }
    render();
  }
})();
