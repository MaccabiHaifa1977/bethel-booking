/* Bethel Hostel – shared site behaviour: menu, quick date form, photo lightbox, map on demand */
(function () {
  'use strict';

  var html = document.documentElement;
  var rtl = html.getAttribute('dir') === 'rtl';

  // ---- mobile menu
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ---- quick booking form on the home page
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function addDays(s, n) {
    var d = new Date(s + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return iso(d);
  }
  var inEl = document.querySelector('[data-date="in"]');
  var outEl = document.querySelector('[data-date="out"]');
  if (inEl && outEl) {
    var today = iso(new Date());
    inEl.min = today;
    outEl.min = addDays(today, 1);
    inEl.addEventListener('change', function () {
      if (!inEl.value) return;
      outEl.min = addDays(inEl.value, 1);
      if (!outEl.value || outEl.value <= inEl.value) outEl.value = addDays(inEl.value, 1);
    });
  }

  // ---- lightbox
  var items = [].slice.call(document.querySelectorAll('[data-lightbox]'));
  var box = null;
  var index = 0;
  var lastFocus = null;

  function show(i) {
    index = (i + items.length) % items.length;
    var a = items[index];
    box.querySelector('img').src = a.getAttribute('href');
    box.querySelector('img').alt = a.getAttribute('data-caption') || '';
    box.querySelector('p').textContent = a.getAttribute('data-caption') || '';
  }
  function close() {
    if (!box) return;
    box.remove();
    box = null;
    document.removeEventListener('keydown', onKey);
    if (lastFocus) lastFocus.focus();
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') show(index + (rtl ? -1 : 1));
    if (e.key === 'ArrowLeft') show(index + (rtl ? 1 : -1));
  }
  function open(i) {
    lastFocus = document.activeElement;
    box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = '<button type="button" class="lb-close" aria-label="Close">×</button>' +
      '<button type="button" class="lb-prev" aria-label="Previous">' + (rtl ? '›' : '‹') + '</button>' +
      '<img alt=""><p></p>' +
      '<button type="button" class="lb-next" aria-label="Next">' + (rtl ? '‹' : '›') + '</button>';
    document.body.appendChild(box);
    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.classList.contains('lb-close')) close();
      else if (e.target.classList.contains('lb-prev')) show(index - 1);
      else if (e.target.classList.contains('lb-next')) show(index + 1);
    });
    if (items.length < 2) {
      box.querySelector('.lb-prev').hidden = true;
      box.querySelector('.lb-next').hidden = true;
    }
    document.addEventListener('keydown', onKey);
    show(i);
    box.querySelector('.lb-close').focus();
  }
  items.forEach(function (a, i) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      open(i);
    });
  });

  // ---- map loads only when asked (no Google cookies before that), print button
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
      wrap.classList.add('loaded');
    }
    if (e.target.closest('[data-print]')) window.print();
  });
})();
