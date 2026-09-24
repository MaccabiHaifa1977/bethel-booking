'use strict';
// E-mail through Resend's HTTPS API (Railway blocks SMTP on most plans).
// Optional: without RESEND_API_KEY + MAIL_FROM, e-mails are skipped and only logged.
const { esc, dmy, pickLang, nightsBetween, withTimeout } = require('./util');

function configured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

async function send({ to, subject, html, text, replyTo }) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!recipients.length) return { skipped: true };
  if (!configured()) {
    console.log(`[mail] not configured - skipped "${subject}" -> ${recipients.join(', ')}`);
    return { skipped: true };
  }
  const res = await withTimeout(fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: recipients, subject, html, text, reply_to: replyTo || undefined }),
  }), 15000, 'Resend');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend failed (${res.status}): ${data.message || data.name || 'error'}`);
  return data;
}

const T = {
  en: {
    confirmedSubject: (site, code) => `Booking confirmed – ${site} (${code})`,
    cancelledSubject: (site, code) => `Booking cancelled – ${site} (${code})`,
    hello: (n) => `Dear ${n},`,
    confirmedIntro: 'Thank you! Your booking is confirmed. Here are the details:',
    cancelledIntro: 'Your booking has been cancelled.',
    code: 'Booking number', checkIn: 'Check-in', checkOut: 'Check-out', from: 'from', until: 'until',
    rooms: 'Rooms', guests: 'Guests', total: 'Total', paid: 'Paid', due: 'To pay on arrival',
    view: 'View your booking', address: 'Address', contact: 'Questions? Contact us',
    refund: 'Any refund is returned to your original payment method.', bless: 'We look forward to welcoming you!',
    nights: (n) => (n === 1 ? '1 night' : `${n} nights`), bed: 'bed', guestsN: (n) => (n === 1 ? '1 guest' : `${n} guests`),
  },
  he: {
    confirmedSubject: (site, code) => `ההזמנה אושרה – ${site} (${code})`,
    cancelledSubject: (site, code) => `ההזמנה בוטלה – ${site} (${code})`,
    hello: (n) => `שלום ${n},`,
    confirmedIntro: 'תודה! ההזמנה שלכם אושרה. אלה הפרטים:',
    cancelledIntro: 'ההזמנה שלכם בוטלה.',
    code: 'מספר הזמנה', checkIn: 'צ׳ק-אין', checkOut: 'צ׳ק-אאוט', from: 'מהשעה', until: 'עד השעה',
    rooms: 'חדרים', guests: 'אורחים', total: 'סה״כ', paid: 'שולם', due: 'לתשלום בהגעה',
    view: 'לצפייה בהזמנה', address: 'כתובת', contact: 'שאלות? צרו קשר',
    refund: 'החזר כספי, אם יש, יוחזר לאמצעי התשלום המקורי.', bless: 'נשמח לארח אתכם!',
    nights: (n) => (n === 1 ? 'לילה אחד' : `${n} לילות`), bed: 'מיטה', guestsN: (n) => (n === 1 ? 'אורח אחד' : `${n} אורחים`),
  },
  de: {
    confirmedSubject: (site, code) => `Buchung bestätigt – ${site} (${code})`,
    cancelledSubject: (site, code) => `Buchung storniert – ${site} (${code})`,
    hello: (n) => `Liebe/r ${n},`,
    confirmedIntro: 'Vielen Dank! Ihre Buchung ist bestätigt. Hier sind die Details:',
    cancelledIntro: 'Ihre Buchung wurde storniert.',
    code: 'Buchungsnummer', checkIn: 'Check-in', checkOut: 'Check-out', from: 'ab', until: 'bis',
    rooms: 'Zimmer', guests: 'Gäste', total: 'Gesamt', paid: 'Bezahlt', due: 'Bei Ankunft zu zahlen',
    view: 'Buchung ansehen', address: 'Adresse', contact: 'Fragen? Kontaktieren Sie uns',
    refund: 'Eine eventuelle Erstattung erfolgt auf das ursprüngliche Zahlungsmittel.', bless: 'Wir freuen uns auf Ihren Besuch!',
    nights: (n) => (n === 1 ? '1 Nacht' : `${n} Nächte`), bed: 'Bett', guestsN: (n) => (n === 1 ? '1 Gast' : `${n} Gäste`),
  },
  ru: {
    confirmedSubject: (site, code) => `Бронирование подтверждено – ${site} (${code})`,
    cancelledSubject: (site, code) => `Бронирование отменено – ${site} (${code})`,
    hello: (n) => `Здравствуйте, ${n}!`,
    confirmedIntro: 'Спасибо! Ваше бронирование подтверждено. Вот подробности:',
    cancelledIntro: 'Ваше бронирование отменено.',
    code: 'Номер бронирования', checkIn: 'Заезд', checkOut: 'Выезд', from: 'с', until: 'до',
    rooms: 'Номера', guests: 'Гости', total: 'Итого', paid: 'Оплачено', due: 'Оплата при заезде',
    view: 'Посмотреть бронирование', address: 'Адрес', contact: 'Есть вопросы? Свяжитесь с нами',
    refund: 'Возврат, если он положен, поступит тем же способом, которым вы платили.', bless: 'Будем рады видеть вас!',
    nights: (n) => `${n} ${ruPlural(n, 'ночь', 'ночи', 'ночей')}`, bed: 'место', guestsN: (n) => `${n} ${ruPlural(n, 'гость', 'гостя', 'гостей')}`,
  },
};

function ruPlural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function fmtMoney(n, currency, lang) {
  const locale = lang === 'he' ? 'he-IL' : lang === 'de' ? 'de-DE' : lang === 'ru' ? 'ru-RU' : 'en-GB';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'ILS', maximumFractionDigits: Number(n) % 1 ? 2 : 0 }).format(Number(n));
}

function unitLines(lines, lang) {
  const t = T[lang];
  const groups = new Map();
  for (const l of lines) {
    const name = pickLang(l.typeName, lang);
    const key = `${name}|${l.soldAs}|${l.guests}`;
    const g = groups.get(key) || { name, soldAs: l.soldAs, guests: l.guests, count: 0 };
    g.count += 1;
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => (g.soldAs === 'bed' ? `${g.count} × ${g.name}` : `${g.count} × ${g.name} (${t.guestsN(g.guests)})`));
}

function layout(lang, inner) {
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const align = lang === 'he' ? 'right' : 'left';
  return `<!doctype html><html lang="${lang}" dir="${dir}"><body style="margin:0;background:#f4efe6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#2c2217">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;text-align:${align};direction:${dir}">${inner}</div></body></html>`;
}

function guestEmail(kind, { booking, lines, settings, link }) {
  const lang = T[booking.lang] ? booking.lang : 'en';
  const t = T[lang];
  const site = pickLang(settings.site_name, lang);
  const nights = nightsBetween(booking.check_in, booking.check_out);
  const due = Math.max(0, Number(booking.total) - Number(booking.paid));
  const rows = [
    [t.code, `<b>${esc(booking.code)}</b>`],
    [t.checkIn, `${esc(dmy(booking.check_in))} ${t.from} ${esc(settings.checkin_time)}`],
    [t.checkOut, `${esc(dmy(booking.check_out))} ${t.until} ${esc(settings.checkout_time)} (${t.nights(nights)})`],
    [t.rooms, unitLines(lines, lang).map(esc).join('<br>')],
    [t.guests, String(booking.guests_count)],
    [t.total, esc(fmtMoney(booking.total, booking.currency, lang))],
  ];
  if (kind === 'confirmed') {
    rows.push([t.paid, esc(fmtMoney(booking.paid, booking.currency, lang))]);
    if (due > 0) rows.push([t.due, `<b>${esc(fmtMoney(due, booking.currency, lang))}</b>`]);
  }
  const table = rows.map(([k, v]) => `<tr><td style="padding:6px 0;color:#6b5d4f;width:40%;vertical-align:top">${esc(k)}</td><td style="padding:6px 0">${v}</td></tr>`).join('');
  const inner = `
<h1 style="font-size:20px;margin:0 0 4px">${esc(site)}</h1>
<p style="margin:0 0 18px;color:#6b5d4f">${esc(pickLang(settings.site_subtitle, lang))}</p>
<p>${esc(t.hello(booking.guest_name || ''))}</p>
<p>${esc(kind === 'confirmed' ? t.confirmedIntro : t.cancelledIntro)}</p>
<table style="width:100%;border-collapse:collapse;font-size:15px">${table}</table>
${kind === 'cancelled' ? `<p style="color:#6b5d4f">${esc(t.refund)}</p>` : ''}
<p style="margin:22px 0"><a href="${esc(link)}" style="background:#8a4b24;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block">${esc(t.view)}</a></p>
<p style="font-size:14px;color:#6b5d4f">${esc(t.address)}: ${esc(pickLang(settings.address, lang))}<br>${esc(t.contact)}: ${esc(settings.phones)} · ${esc(settings.email)}</p>
${kind === 'confirmed' ? `<p>${esc(t.bless)}</p>` : ''}`;
  const subject = kind === 'confirmed' ? t.confirmedSubject(site, booking.code) : t.cancelledSubject(site, booking.code);
  const text = `${t.hello(booking.guest_name || '')}\n\n${kind === 'confirmed' ? t.confirmedIntro : t.cancelledIntro}\n${t.code}: ${booking.code}\n${t.checkIn}: ${dmy(booking.check_in)}\n${t.checkOut}: ${dmy(booking.check_out)}\n${t.view}: ${link}`;
  return { subject, html: layout(lang, inner), text };
}

function adminEmail({ booking, lines, adminLink }) {
  const nights = nightsBetween(booking.check_in, booking.check_out);
  const pay = booking.pay_method === 'arrival' ? 'תשלום בהגעה' : booking.pay_method === 'paypal' ? 'שולם ב-PayPal' : booking.pay_method || '';
  const travelers = (booking.travelers || []).map((x) => `${esc(x.name)} (${x.gender === 'female' ? 'אישה' : 'גבר'})`).join('<br>');
  const inner = `
<h1 style="font-size:20px;margin:0 0 12px">הזמנה חדשה ${esc(booking.code)}</h1>
<p><b>${esc(booking.guest_name)}</b> · ${esc(booking.email || '')} · ${esc(booking.phone || '')}</p>
<p>${esc(dmy(booking.check_in))} – ${esc(dmy(booking.check_out))} (${nights} לילות) · ${booking.guests_count} אורחים</p>
<p>${unitLines(lines, 'he').map(esc).join('<br>')}</p>
<p>סה״כ: <b>${esc(fmtMoney(booking.total, booking.currency, 'he'))}</b> · ${esc(pay)}</p>
${travelers ? `<p style="color:#6b5d4f">${travelers}</p>` : ''}
${booking.notes ? `<p>בקשות: ${esc(booking.notes)}</p>` : ''}
<p><a href="${esc(adminLink)}">פתיחה בפאנל הניהול</a></p>`;
  return {
    subject: `הזמנה חדשה ${booking.code} – ${booking.guest_name} (${dmy(booking.check_in)})`,
    html: layout('he', inner),
    text: `הזמנה חדשה ${booking.code} – ${booking.guest_name}\n${dmy(booking.check_in)} - ${dmy(booking.check_out)}\n${adminLink}`,
  };
}

const GROUP_ACK = {
  en: { subject: (site, code) => `We received your group inquiry – ${site} (${code})`, body: 'Thank you for your group inquiry. The Bethel team will get back to you with availability and a price.' },
  de: { subject: (site, code) => `Ihre Gruppenanfrage ist angekommen – ${site} (${code})`, body: 'Vielen Dank für Ihre Gruppenanfrage. Das Bethel-Team meldet sich mit Verfügbarkeit und Preis bei Ihnen.' },
  ru: { subject: (site, code) => `Мы получили ваш запрос для группы – ${site} (${code})`, body: 'Спасибо за ваш запрос. Команда Bethel свяжется с вами и сообщит о наличии мест и цене.' },
};

// Notification to the hostel (Hebrew) and an acknowledgement to the contact person (their language)
async function groupRequestEmails(r, settings) {
  const rows = [
    ['קבוצה', r.group], ['איש קשר', r.contact], ['מייל', r.email], ['טלפון', r.phone],
    ['תאריכים', `${dmy(r.arrival)} – ${dmy(r.departure)}`], ['גודל הקבוצה', String(r.size)],
    ['מבוגרים', r.adults == null ? '' : String(r.adults)], ['ילדים', r.children == null ? '' : String(r.children)],
    ['בקשות מיוחדות', r.needs], ['הודעה', r.message], ['שפה', r.lang],
  ].filter(([, v]) => v);
  const table = rows.map(([k, v]) => `<tr><td style="padding:6px 0;color:#6b5d4f;width:35%;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;white-space:pre-wrap">${esc(v)}</td></tr>`).join('');
  const out = [];
  if (settings.notify_email) {
    out.push({
      to: settings.notify_email,
      replyTo: r.email,
      subject: `בקשת קבוצה ${r.code} – ${r.group} (${dmy(r.arrival)})`,
      html: layout('he', `<h1 style="font-size:20px;margin:0 0 12px">בקשת קבוצה חדשה ${esc(r.code)}</h1><table style="width:100%;border-collapse:collapse;font-size:15px">${table}</table>`),
      text: rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
    });
  }
  const ack = GROUP_ACK[r.lang] || GROUP_ACK.en;
  const site = pickLang(settings.site_name, r.lang);
  out.push({
    to: r.email,
    replyTo: settings.email,
    subject: ack.subject(site, r.code),
    html: layout(r.lang, `<h1 style="font-size:20px;margin:0 0 12px">${esc(site)}</h1><p>${esc(ack.body)}</p><p><b>${esc(r.code)}</b> · ${esc(dmy(r.arrival))} – ${esc(dmy(r.departure))} · ${esc(String(r.size))}</p><p style="font-size:14px;color:#6b5d4f">${esc(settings.phones)} · ${esc(settings.email)}</p>`),
    text: `${ack.body}\n${r.code} · ${dmy(r.arrival)} – ${dmy(r.departure)}`,
  });
  return out;
}

module.exports = { configured, send, guestEmail, adminEmail, groupRequestEmails };
