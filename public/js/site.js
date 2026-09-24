/* Bethel Hostel – shared site behaviour.
   Everything here is progressive enhancement: pages work without JavaScript. */
(function () {
  'use strict';

  var html = document.documentElement;
  var RTL = html.getAttribute('dir') === 'rtl';
  var DATA = {};
  try { DATA = JSON.parse(document.getElementById('site-data').textContent); } catch (_) { /* no data */ }
  var T = DATA.t || {};
  var LOCALE = DATA.locale || 'en-GB';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function t(key, vars) {
    var s = T[key] || key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ''; });
    return s;
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, htmlStr) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (htmlStr != null) e.innerHTML = htmlStr;
    return e;
  }
  var ICON = {
    close: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    left: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6"/></svg>',
    right: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg>',
  };

  // ------------------------------------------------------------------ dates (YYYY-MM-DD, UTC arithmetic)
  function parse(s) { return new Date(s + 'T00:00:00Z'); }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function addDays(s, n) { var d = parse(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
  function nightsBetween(a, b) { return Math.round((parse(b) - parse(a)) / 864e5); }
  function isDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(parse(s)); }
  function monthStart(s) { return s.slice(0, 8) + '01'; }
  function addMonths(s, n) { var d = parse(monthStart(s)); d.setUTCMonth(d.getUTCMonth() + n); return iso(d); }
  var fmtShort = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  var fmtLong = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  var fmtMonth = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  var fmtWd = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', timeZone: 'UTC' });
  function nightsText(n) { return n === 1 ? t('night_1') : t('nights_n', { n: n }); }

  // ------------------------------------------------------------------ focus trap helper
  function trapFocus(container, e) {
    if (e.key !== 'Tab') return;
    var f = $$('a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]', container).filter(function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0];
    var last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // ------------------------------------------------------------------ DatePicker (range)
  function DatePicker(opts) {
    this.o = opts;
    this.start = isDate(opts.checkIn) ? opts.checkIn : null;
    this.end = isDate(opts.checkOut) && this.start && opts.checkOut > this.start ? opts.checkOut : null;
    this.focusDay = this.start || opts.min;
    this.view = monthStart(this.start || opts.min);
  }
  DatePicker.prototype.months = function () { return window.innerWidth >= 760 ? 2 : 1; };
  DatePicker.prototype.open = function () {
    var self = this;
    this.returnFocus = document.activeElement;
    this.backdrop = el('div', 'dp-backdrop');
    this.dialog = el('div', 'dp');
    this.dialog.setAttribute('role', 'dialog');
    this.dialog.setAttribute('aria-modal', 'true');
    this.dialog.setAttribute('aria-label', t('dp_title'));
    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.dialog);
    document.body.classList.add('menu-open');
    this.backdrop.addEventListener('click', function () { self.close(); });
    this.dialog.addEventListener('click', function (e) { self.onClick(e); });
    this.dialog.addEventListener('keydown', function (e) { self.onKey(e); });
    this.dialog.addEventListener('mouseover', function (e) {
      var b = e.target.closest('.dp__day');
      if (b && self.start && !self.end) { self.hover = b.getAttribute('data-date'); self.paintRange(); }
    });
    this.onResize = function () { self.render(); };
    window.addEventListener('resize', this.onResize);
    this.render(true);
  };
  DatePicker.prototype.close = function (done) {
    if (!this.dialog) return;
    window.removeEventListener('resize', this.onResize);
    this.dialog.remove();
    this.backdrop.remove();
    this.dialog = null;
    document.body.classList.remove('menu-open');
    if (this.o.onClose) this.o.onClose(done);
    if (this.returnFocus && this.returnFocus.focus) this.returnFocus.focus();
  };
  DatePicker.prototype.isDisabled = function (d) {
    var o = this.o;
    if (d < o.min || d > o.max) return true;
    if (this.start && !this.end && d > this.start) {
      var n = nightsBetween(this.start, d);
      if (n > (o.maxNights || 365)) return true;
      if (n < (o.minNights || 1)) return true;
    }
    return false;
  };
  DatePicker.prototype.monthHtml = function (m) {
    var first = parse(m);
    var offset = (first.getUTCDay() + 6) % 7; // Monday first
    var days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    var wd = '';
    for (var i = 0; i < 7; i++) wd += '<span class="dp__wd" aria-hidden="true">' + fmtWd.format(parse(addDays('2024-01-01', i))) + '</span>';
    var cells = '';
    for (var k = 0; k < offset; k++) cells += '<span></span>';
    for (var dd = 1; dd <= days; dd++) {
      var d = m.slice(0, 8) + String(dd).padStart(2, '0');
      var dis = this.isDisabled(d);
      cells += '<button type="button" class="dp__day' + (d === DATA.today ? ' is-today' : '') + '" data-date="' + d + '" tabindex="-1"'
        + (dis ? ' disabled' : '') + ' aria-label="' + fmtLong.format(parse(d)) + '">' + dd + '</button>';
    }
    return '<div class="dp__month"><p class="dp__month-title">' + fmtMonth.format(first) + '</p><div class="dp__grid" role="group" aria-label="' + fmtMonth.format(first) + '">' + wd + cells + '</div></div>';
  };
  DatePicker.prototype.render = function (initial) {
    if (!this.dialog) return;
    var n = this.months();
    var months = '';
    for (var i = 0; i < n; i++) months += this.monthHtml(addMonths(this.view, i));
    var canPrev = this.view > monthStart(this.o.min);
    var canNext = addMonths(this.view, n) <= monthStart(this.o.max);
    var summary = '';
    if (this.start && this.end) summary = fmtShort.format(parse(this.start)) + ' – ' + fmtShort.format(parse(this.end)) + ' · ' + nightsText(nightsBetween(this.start, this.end));
    else if (this.start) summary = fmtShort.format(parse(this.start)) + ' – …';
    this.dialog.innerHTML =
      '<div class="dp__head"><h2 class="dp__title">' + t('dp_title') + '</h2><button type="button" class="dp__close" data-dp="close" aria-label="' + t('close') + '">' + ICON.close + '</button></div>'
      + '<p class="dp__hint" aria-live="polite">' + (this.start && !this.end ? t('dp_pick_out') : t('dp_pick_in')) + '</p>'
      + '<div class="dp__body"><div class="dp__nav"><button type="button" data-dp="prev" aria-label="' + t('dp_prev') + '"' + (canPrev ? '' : ' disabled') + '>' + ICON.left + '</button>'
      + '<button type="button" data-dp="next" aria-label="' + t('dp_next') + '"' + (canNext ? '' : ' disabled') + '>' + ICON.right + '</button></div>'
      + '<div class="dp__months">' + months + '</div></div>'
      + '<div class="dp__foot"><button type="button" class="dp__clear" data-dp="clear"' + (this.start ? '' : ' hidden') + '>' + t('dp_clear') + '</button>'
      + '<span class="dp__summary" aria-live="polite">' + summary + '</span>'
      + '<button type="button" class="btn btn-primary btn-sm" data-dp="done"' + (this.start && this.end ? '' : ' disabled') + '>' + t('dp_done') + '</button></div>';
    this.paintRange();
    this.setFocusable(initial);
  };
  DatePicker.prototype.paintRange = function () {
    var s = this.start;
    var e = this.end || (this.start && this.hover && this.hover > this.start && !this.isDisabled(this.hover) ? this.hover : null);
    $$('.dp__day', this.dialog).forEach(function (b) {
      var d = b.getAttribute('data-date');
      b.classList.toggle('is-start', d === s);
      b.classList.toggle('has-end', d === s && !!e);
      b.classList.toggle('is-end', !!e && d === e);
      b.classList.toggle('in-range', !!(s && e && d > s && d < e));
      b.setAttribute('aria-pressed', d === s || d === e ? 'true' : 'false');
    });
  };
  DatePicker.prototype.setFocusable = function (moveFocus) {
    var target = $('.dp__day[data-date="' + this.focusDay + '"]:not(:disabled)', this.dialog) || $('.dp__day:not(:disabled)', this.dialog);
    if (!target) { if (moveFocus) $('[data-dp="close"]', this.dialog).focus(); return; }
    this.focusDay = target.getAttribute('data-date');
    $$('.dp__day', this.dialog).forEach(function (b) { b.tabIndex = b === target ? 0 : -1; });
    if (moveFocus) target.focus();
  };
  DatePicker.prototype.moveFocus = function (days) {
    var d = addDays(this.focusDay, days);
    if (d < this.o.min || d > this.o.max) return;
    this.focusDay = d;
    var n = this.months();
    if (d < this.view || d >= addMonths(this.view, n)) { this.view = monthStart(d < this.view ? d : addMonths(d, 1 - n)); this.render(); }
    this.setFocusable(true);
  };
  DatePicker.prototype.pick = function (d) {
    var self = this;
    if (!this.start || this.end || d <= this.start) { this.start = d; this.end = null; this.hover = null; }
    else { this.end = d; }
    this.focusDay = d;
    this.render();
    this.setFocusable(true);
    if (this.o.onChange) this.o.onChange(this.start, this.end);
    if (this.start && this.end) setTimeout(function () { self.close(true); }, reduceMotion ? 0 : 260);
  };
  DatePicker.prototype.onClick = function (e) {
    var day = e.target.closest('.dp__day');
    if (day && !day.disabled) return this.pick(day.getAttribute('data-date'));
    var a = e.target.closest('[data-dp]');
    if (!a || a.disabled) return;
    var act = a.getAttribute('data-dp');
    if (act === 'close') this.close();
    else if (act === 'done') this.close(true);
    else if (act === 'prev') { this.view = addMonths(this.view, -1); this.render(); }
    else if (act === 'next') { this.view = addMonths(this.view, 1); this.render(); }
    else if (act === 'clear') { this.start = null; this.end = null; this.render(); if (this.o.onChange) this.o.onChange(null, null); this.setFocusable(true); }
  };
  DatePicker.prototype.onKey = function (e) {
    if (e.key === 'Escape') { e.preventDefault(); this.close(); return; }
    trapFocus(this.dialog, e);
    if (!e.target.classList.contains('dp__day')) return;
    var map = { ArrowLeft: RTL ? 1 : -1, ArrowRight: RTL ? -1 : 1, ArrowUp: -7, ArrowDown: 7 };
    if (map[e.key] != null) { e.preventDefault(); this.moveFocus(map[e.key]); }
    else if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault(); var d = parse(this.focusDay); d.setUTCMonth(d.getUTCMonth() + (e.key === 'PageUp' ? -1 : 1)); this.moveFocus(nightsBetween(this.focusDay, iso(d))); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); var wd = (parse(this.focusDay).getUTCDay() + 6) % 7; this.moveFocus(e.key === 'Home' ? -wd : 6 - wd); }
  };

  // Turns a [data-daterange] block (two native date inputs) into one trigger + picker
  function enhanceDates(root) {
    $$('[data-daterange]', root).forEach(function (box) {
      if (box.classList.contains('is-enhanced')) return;
      var inEl = $('[data-date-in]', box);
      var outEl = $('[data-date-out]', box);
      if (!inEl || !outEl) return;
      box.classList.add('is-enhanced');
      var trigger = el('button', 'date-trigger');
      trigger.type = 'button';
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-expanded', 'false');
      box.insertBefore(trigger, box.firstChild);
      var labelOf = function (input, fallback) { var l = input.id && box.querySelector('label[for="' + input.id + '"]'); return l ? l.textContent.trim() : fallback; };
      var inLabel = labelOf(inEl, t('check_in'));
      var outLabel = labelOf(outEl, t('check_out'));
      function half(label, value, active) {
        return '<span class="date-trigger__half' + (active ? ' is-active' : '') + '"><span class="search__label">' + label + '</span><span class="date-trigger__value' + (value ? '' : ' is-empty') + '">'
          + (value ? fmtShort.format(parse(value)) : t('search_add_dates')) + '</span></span>';
      }
      function paint(active) {
        trigger.innerHTML = half(inLabel, inEl.value, active !== 'out') + half(outLabel, outEl.value, active === 'out');
        trigger.setAttribute('aria-label', inLabel + ': ' + (inEl.value ? fmtLong.format(parse(inEl.value)) : t('search_add_dates')) + ', ' + outLabel + ': ' + (outEl.value ? fmtLong.format(parse(outEl.value)) : t('search_add_dates')));
      }
      function set(input, v) {
        if (input.value === (v || '')) return;
        input.value = v || '';
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      function openPicker() {
        trigger.setAttribute('aria-expanded', 'true');
        var dp = new DatePicker({
          min: box.getAttribute('data-min') || DATA.today,
          max: box.getAttribute('data-max') || addDays(DATA.today, 365),
          minNights: Number(box.getAttribute('data-min-nights')) || 1,
          maxNights: Number(box.getAttribute('data-max-nights')) || 365,
          checkIn: inEl.value,
          checkOut: outEl.value,
          onChange: function (a, b) { set(inEl, a); set(outEl, b); paint(a && !b ? 'out' : 'in'); },
          onClose: function (done) {
            trigger.setAttribute('aria-expanded', 'false');
            paint();
            box.dispatchEvent(new CustomEvent('dates:close', { bubbles: true, detail: { done: !!done, checkIn: inEl.value, checkOut: outEl.value } }));
          },
        });
        dp.open();
      }
      box.openPicker = openPicker;
      trigger.addEventListener('click', openPicker);
      inEl.addEventListener('change', function () { paint(); });
      outEl.addEventListener('change', function () { paint(); });
      paint();
      var form = box.closest('form');
      if (form && !form.hasAttribute('data-dates-optional') && !box.hasAttribute('data-dates-optional')) {
        form.addEventListener('submit', function (e) {
          if (!inEl.value || !outEl.value || outEl.value <= inEl.value) { e.preventDefault(); openPicker(); }
        });
      }
    });
  }

  // ------------------------------------------------------------------ steppers
  function enhanceSteppers(root) {
    $$('[data-stepper]', root).forEach(function (st) {
      if (st.getAttribute('data-ready')) return;
      st.setAttribute('data-ready', '1');
      var input = $('input', st);
      function bounds() { return [Number(input.min) || 0, Number(input.max) || 99]; }
      function sync() {
        var b = bounds();
        var v = Math.min(b[1], Math.max(b[0], Number(input.value) || b[0]));
        if (String(v) !== input.value) input.value = v;
        $('[data-step="-1"]', st).disabled = v <= b[0];
        $('[data-step="1"]', st).disabled = v >= b[1];
      }
      st.addEventListener('click', function (e) {
        var b = e.target.closest('[data-step]');
        if (!b || b.disabled) return;
        input.value = (Number(input.value) || 0) + Number(b.getAttribute('data-step'));
        sync();
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      input.addEventListener('change', sync);
      sync();
    });
  }

  // ------------------------------------------------------------------ header & menus
  var header = $('[data-header]');
  function onScroll() {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 12);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var sheet = $('[data-menu]');
  var openBtn = $('[data-menu-open]');
  function closeMenu() {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    document.body.classList.remove('menu-open');
    if (openBtn) { openBtn.setAttribute('aria-expanded', 'false'); openBtn.focus(); }
  }
  if (sheet && openBtn) {
    openBtn.addEventListener('click', function () {
      sheet.hidden = false;
      document.body.classList.add('menu-open');
      openBtn.setAttribute('aria-expanded', 'true');
      var first = $('.menu-sheet__nav a', sheet);
      if (first) first.focus();
    });
    sheet.addEventListener('click', function (e) {
      if (e.target.closest('[data-menu-close]') || e.target.closest('a')) closeMenu();
    });
    sheet.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
      trapFocus(sheet, e);
    });
  }

  var langMenu = $('[data-lang-menu]');
  if (langMenu) {
    document.addEventListener('click', function (e) { if (langMenu.open && !langMenu.contains(e.target)) langMenu.open = false; });
    langMenu.addEventListener('keydown', function (e) { if (e.key === 'Escape') { langMenu.open = false; $('summary', langMenu).focus(); } });
  }

  // ------------------------------------------------------------------ lightbox
  function openLightbox(items, index) {
    var lastFocus = document.activeElement;
    var i = index;
    var box = el('div', 'lightbox');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = '<div class="lightbox__bar"><span data-count aria-live="polite"></span><button type="button" data-lb="close" aria-label="' + t('close') + '">' + ICON.close + '</button></div>'
      + '<div class="lightbox__stage"><img alt=""><button type="button" class="lightbox__prev" data-lb="prev" aria-label="‹">' + ICON.left + '</button><button type="button" class="lightbox__next" data-lb="next" aria-label="›">' + ICON.right + '</button></div>'
      + '<p class="lightbox__cap"></p>';
    document.body.appendChild(box);
    document.body.classList.add('menu-open');
    var img = $('img', box);
    function show(n) {
      i = (n + items.length) % items.length;
      var a = items[i];
      img.src = a.getAttribute('href');
      img.alt = a.getAttribute('data-caption') || '';
      $('.lightbox__cap', box).textContent = a.getAttribute('data-caption') || '';
      $('[data-count]', box).textContent = (i + 1) + ' / ' + items.length;
      [i + 1, i - 1].forEach(function (k) { var p = items[(k + items.length) % items.length]; if (p) new Image().src = p.getAttribute('href'); });
    }
    function close() {
      box.remove();
      document.body.classList.remove('menu-open');
      document.removeEventListener('keydown', onKey);
      if (lastFocus) lastFocus.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') show(i + (RTL ? -1 : 1));
      else if (e.key === 'ArrowLeft') show(i + (RTL ? 1 : -1));
      else trapFocus(box, e);
    }
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lb]');
      if (b) {
        var a = b.getAttribute('data-lb');
        if (a === 'close') close();
        if (a === 'prev') show(i - 1);
        if (a === 'next') show(i + 1);
      } else if (e.target === box || e.target.classList.contains('lightbox__stage')) close();
    });
    var x0 = null;
    box.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (x0 == null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) show(i + ((dx < 0) !== RTL ? 1 : -1));
      x0 = null;
    });
    if (items.length < 2) $$('.lightbox__prev, .lightbox__next', box).forEach(function (b) { b.hidden = true; });
    document.addEventListener('keydown', onKey);
    show(i);
    $('[data-lb="close"]', box).focus();
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-lightbox]');
    var all = e.target.closest('[data-gallery-open]');
    if (!a && !all) return;
    var gallery = (a || all).closest('[data-gallery]') || document;
    var items = $$('[data-lightbox]', gallery);
    if (!items.length) return;
    e.preventDefault();
    openLightbox(items, a ? Math.max(0, items.indexOf(a)) : 0);
  });

  // ------------------------------------------------------------------ map on demand, print
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-show-map]');
    if (btn) {
      var wrap = btn.closest('.map');
      var frame = document.createElement('iframe');
      frame.src = wrap.getAttribute('data-map-src');
      frame.title = btn.textContent.trim();
      frame.loading = 'lazy';
      frame.referrerPolicy = 'no-referrer-when-downgrade';
      wrap.innerHTML = '';
      wrap.appendChild(frame);
    }
    if (e.target.closest('[data-print]')) window.print();
  });

  // ------------------------------------------------------------------ broken images
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG') return;
    var holder = img.closest('picture') ? img.closest('picture').parentElement : img.parentElement;
    if (holder && !holder.classList.contains('img-failed')) {
      holder.classList.add('img-failed');
      holder.setAttribute('data-missing', t('img_missing'));
    }
  }, true);

  // ------------------------------------------------------------------ availability for chosen dates
  function fetchAvailability(checkIn, checkOut) {
    return fetch('/api/public/availability?checkIn=' + encodeURIComponent(checkIn) + '&checkOut=' + encodeURIComponent(checkOut), { credentials: 'same-origin' })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) { var err = new Error(d.error || 'generic'); err.code = d.error; throw err; } return d; }); });
  }
  function availText(n) { return n <= 0 ? t('room_none') : n === 1 ? t('room_left_1') : t('room_left_n', { n: n }); }

  var scope = $('[data-avail-scope]');
  if (scope) {
    var params = new URLSearchParams(location.search);
    var qin = params.get('in');
    var qout = params.get('out');
    if (isDate(qin) && isDate(qout) && qout > qin) {
      var keep = new URLSearchParams();
      keep.set('in', qin); keep.set('out', qout);
      if (params.get('guests')) keep.set('guests', params.get('guests'));
      $$('[data-room-card] a.stretched', scope).forEach(function (a) { a.href = a.pathname + '?' + keep.toString(); });
      var hint = $('[data-avail-hint]');
      fetchAvailability(qin, qout).then(function (d) {
        $$('[data-room-card]', scope).forEach(function (card) {
          var n = d.available[card.getAttribute('data-type-id')] || 0;
          var chip = $('[data-avail]', card);
          chip.textContent = availText(n);
          chip.classList.toggle('chip--none', n <= 0);
          chip.hidden = false;
        });
        if (hint) { hint.textContent = fmtShort.format(parse(qin)) + ' – ' + fmtShort.format(parse(qout)) + ' · ' + nightsText(d.nights); hint.classList.add('is-result'); }
      }).catch(function (err) {
        if (hint) hint.textContent = err && err.code ? t('e_generic') : t('e_network');
      });
    }
  }

  var panelAvail = $('[data-panel-avail]');
  if (panelAvail) {
    var form = panelAvail.closest('.booking-panel__card');
    var pin = form && $('[data-date-in]', form);
    var pout = form && $('[data-date-out]', form);
    var check = function () {
      if (!pin || !isDate(pin.value) || !isDate(pout.value) || pout.value <= pin.value) { panelAvail.textContent = ''; return; }
      panelAvail.className = 'booking-panel__avail';
      panelAvail.innerHTML = '<span class="spinner"></span>';
      fetchAvailability(pin.value, pout.value).then(function (d) {
        var n = d.available[panelAvail.getAttribute('data-type-id')] || 0;
        panelAvail.textContent = availText(n) + ' · ' + nightsText(d.nights);
        panelAvail.classList.add(n > 0 ? 'is-ok' : 'is-none');
      }).catch(function (err) { panelAvail.textContent = err && err.code ? t('e_generic') : t('e_network'); });
    };
    if (pin) { pin.addEventListener('change', check); pout.addEventListener('change', check); check(); }
  }

  // ------------------------------------------------------------------ sticky mobile CTA
  var sticky = $('[data-sticky-cta]');
  if (sticky) {
    var link = $('[data-sticky-link]', sticky);
    var href = link.getAttribute('href') || '';
    var target = href.charAt(0) === '#' ? $(href) : null;
    var footer = $('.site-footer');
    var targetVisible = true;
    var footerVisible = false;
    var update = function () { sticky.hidden = false; sticky.classList.toggle('is-visible', !footerVisible && (target ? !targetVisible : window.scrollY > 520)); };
    if ('IntersectionObserver' in window) {
      if (target) new IntersectionObserver(function (en) { targetVisible = en[0].isIntersecting; update(); }, { threshold: 0 }).observe(target);
      if (footer) new IntersectionObserver(function (en) { footerVisible = en[0].isIntersecting; update(); }).observe(footer);
    }
    if (!target) window.addEventListener('scroll', update, { passive: true });
    update();
    if (target) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        var dr = $('[data-daterange]', target);
        var inEl = dr && $('[data-date-in]', dr);
        if (dr && dr.openPicker && inEl && !inEl.value) setTimeout(dr.openPicker, reduceMotion ? 0 : 450);
      });
    }
  }

  // ------------------------------------------------------------------ group form: keep it friendly
  var gform = $('[data-group-form]');
  if (gform) {
    gform.addEventListener('submit', function (e) {
      var bad = $$('[required]:not([data-date-in]):not([data-date-out])', gform).filter(function (x) { return !x.value.trim() || (x.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x.value.trim())); });
      var a = $('[name="arrival"]', gform);
      var d = $('[name="departure"]', gform);
      var datesBox = $('.form-dates', gform);
      var datesBad = !a.value || !d.value || d.value <= a.value;
      if (datesBox) datesBox.classList.toggle('has-error', datesBad);
      $$('[aria-invalid]', gform).forEach(function (x) { x.removeAttribute('aria-invalid'); });
      if (bad.length || datesBad) {
        e.preventDefault();
        bad.forEach(function (x) { x.setAttribute('aria-invalid', 'true'); });
        if (datesBad) { a.setAttribute('aria-invalid', 'true'); d.setAttribute('aria-invalid', 'true'); }
        var trig = datesBox && $('.date-trigger', datesBox);
        var box = $('.alert', gform);
        if (!box) { box = el('div', 'alert alert--error'); box.setAttribute('role', 'alert'); $('.form-grid', gform).before(box); }
        box.textContent = datesBad && !bad.length ? t('e_group_dates') : t('e_group_fields');
        var first = bad[0] || trig || a;
        first.focus();
        if (first.scrollIntoView) first.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
        return;
      }
      var btn = $('[type="submit"]', gform);
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> ' + btn.getAttribute('data-sending');
    });
    gform.addEventListener('input', function (e) { if (e.target.value) e.target.removeAttribute('aria-invalid'); });
    var arr = $('[name="arrival"]', gform);
    var dep = $('[name="departure"]', gform);
    gform.addEventListener('dates:close', function () {
      var box = $('.form-dates', gform);
      if (box && arr.value && dep.value && dep.value > arr.value) box.classList.remove('has-error');
    });
  }

  // ------------------------------------------------------------------ scroll reveal
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (r) { io.observe(r); });
  } else {
    reveals.forEach(function (r) { r.classList.add('is-in'); });
  }

  enhanceDates(document);
  enhanceSteppers(document);

  window.Bethel = { DatePicker: DatePicker, enhanceDates: enhanceDates, enhanceSteppers: enhanceSteppers, fetchAvailability: fetchAvailability };
})();
