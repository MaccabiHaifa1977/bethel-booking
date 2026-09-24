'use strict';
const db = require('./db');


// Every setting has a default. Admin changes are stored in the `settings` table.
const DEFAULTS = {
  site_name: { en: 'Bethel Hostel Haifa', he: 'אכסניית בית אל חיפה', de: 'Bethel Hostel Haifa', ru: 'Bethel Hostel Haifa' },
  site_subtitle: {
    en: 'Bible Community & Pilgrims Hospitality Home',
    he: 'קהילה מקראית ובית הארחה לצליינים',
    de: 'Bibelgemeinschaft & Pilgerherberge',
    ru: "Библейская община и дом гостеприимства для паломников",
  },
  hero_title: {
    en: "Stay. Connect. *Discover Haifa.*",
    he: "לינה. קהילה. *לגלות את חיפה.*",
    de: "Ankommen. Begegnen. *Haifa entdecken.*",
    ru: "Живите. Общайтесь. *Открывайте Хайфу.*",
  },
  hero_text: {
    en: "A Christian guesthouse and Bible community in an old stone house in Haifa’s German Colony – with a garden, a porch and a shared table, a few steps from cafés and not far from the sea.",
    he: "בית הארחה נוצרי וקהילה מקראית בבית אבן ישן במושבה הגרמנית בחיפה – עם גינה, מרפסת ושולחן משותף, צעדים מבתי הקפה ולא רחוק מהים.",
    de: "Ein christliches Gästehaus und eine Bibelgemeinschaft in einem alten Steinhaus in Haifas Deutscher Kolonie – mit Garten, Veranda und gemeinsamem Tisch, wenige Schritte von Cafés und nicht weit vom Meer.",
    ru: "Христианский гостевой дом и библейская община в старом каменном доме в Немецкой колонии Хайфы – с садом, верандой и общим столом, в двух шагах от кафе и недалеко от моря.",
  },
  hero_image: '/photos/garden-1440.jpg',
  about_text: {
    en: 'Bethel is a Bible community and a hospitality home for pilgrims. The house has a garden, a porch, a dining and recreation room and a fellowship room where guests meet. We offer separate dormitories for men and women, private rooms, a studio and a family room in the protected space.',
    he: 'בית אל היא קהילה מקראית ובית הארחה לצליינים. בבית יש גינה, מרפסת, חדר אוכל ופנאי וחדר שיתוף שבו האורחים נפגשים. יש לנו חדרי מעונות נפרדים לגברים ולנשים, חדרים פרטיים, סטודיו וחדר משפחה בממ״ד.',
    de: 'Bethel ist eine Bibelgemeinschaft und ein Gästehaus für Pilger. Zum Haus gehören ein Garten, eine Veranda, ein Speise- und Aufenthaltsraum sowie ein Gemeinschaftsraum, in dem sich die Gäste begegnen. Wir bieten nach Geschlechtern getrennte Mehrbettzimmer, Privatzimmer, ein Studio und ein Familienzimmer im Schutzraum.',
    ru: "Bethel – это библейская община и дом гостеприимства для паломников. В доме есть сад, веранда, столовая с зоной отдыха и комната общения, где встречаются гости. У нас есть отдельные общие комнаты для мужчин и женщин, отдельные комнаты, студия и семейный номер в защищённом помещении (мамад).",
  },
  location_text: {
    en: 'We are at 40 Hagefen Street in the German Colony, one of Haifa’s most beautiful neighbourhoods. Downtown cafés and restaurants are a 3-minute walk away, and the Bat Galim beach promenade is about 20 minutes on foot. Free street parking is available.',
    he: 'אנחנו ברחוב הגפן 40 במושבה הגרמנית, אחת השכונות היפות בחיפה. בתי קפה ומסעדות במרחק 3 דקות הליכה, וטיילת בת גלים במרחק כ-20 דקות הליכה. יש חניה חינם ברחוב.',
    de: 'Sie finden uns in der Hagefen-Straße 40 in der Deutschen Kolonie, einem der schönsten Viertel Haifas. Cafés und Restaurants in der Innenstadt sind 3 Gehminuten entfernt, die Strandpromenade von Bat Galim etwa 20 Minuten zu Fuß. Kostenlose Parkplätze an der Straße.',
    ru: "Мы находимся на улице Ха-Гефен, 40, в Немецкой колонии – одном из самых красивых районов Хайфы. До кафе и ресторанов центра – 3 минуты пешком, до набережной пляжа Бат-Галим – около 20 минут. На улице есть бесплатная парковка.",
  },
  address: {
    en: '40 Hagefen Street, Haifa, Israel',
    he: 'רחוב הגפן 40, חיפה',
    de: 'Hagefen-Straße 40, Haifa, Israel',
    ru: "ул. Ха-Гефен, 40, Хайфа, Израиль",
  },
  phones: '+972-50-7481789 / +972-50-3481780',
  whatsapp: '972503481780',
  email: 'bethel.hostel.reservation@gmail.com',
  facebook: 'https://www.facebook.com/BethelYouthHostel/',
  maps_query: '40 Hagefen St, Haifa, Israel',

  checkin_time: '14:00',
  checkout_time: '12:00',
  min_nights: 1,
  max_nights: 30,
  max_guests_online: 14,
  booking_window_days: 365,
  currency: 'ILS',
  payment_mode: 'paypal', // paypal | paypal_or_arrival | arrival
  hold_minutes: 20,
  cancel_hours: 24,
  doc_type: 400, // 400 = receipt (קבלה, non-profit), 320 = tax invoice-receipt, 0 = do not issue
  notify_email: 'bethel.hostel.reservation@gmail.com',

  terms: {
    en: [
      'We are an Israeli non-profit organization and welcome everyone as our guests, regardless of religion or lifestyle. We expect our guests to respect the house rules.',
      'Reservations can be made online, in person, by phone or by e-mail. Every reservation requires the full names and gender of all travellers. We reserve the right to decline a reservation, for example if the details are incomplete.',
      'Room configurations are limited, so rooms are assigned according to availability and capacity. Special requests (private rooms, floors, number of occupants) are considered if possible.',
      'The hostel can only be reached by many stairs. Please consider this if you have mobility issues – we cannot carry anyone.',
      'Individuals can stay in a dormitory or a private room. We have men-only and women-only dormitories. Private rooms for two and family rooms are for married couples only (family rooms with or without children).',
      'Groups: the reservation is made by the person responsible for the group and must include the number and gender of all travellers. Groups of 15 or more need a signed contract and a deposit – please contact us directly.',
      'Payment: online reservations are paid in full at the time of booking through PayPal (you can also pay by card through PayPal). A receipt is sent to you by e-mail.',
      'Cancellation: individual reservations can be cancelled free of charge up to 24 hours before arrival, and the payment is refunded in full. Please tell us as early as possible if you need to change your reservation.',
      'We are a no-smoking and alcohol-free hostel. Smoking and drinking alcohol are forbidden on the premises and in the rooms. In case of violation we may end the stay immediately.',
      'Using the free Wi-Fi for any illegal activity is prohibited.',
      'All accommodation and services are subject to availability. We reserve the right to make changes without prior notice.',
      'Check-in is from 2 pm, check-out until 12 noon. With prior permission you may stay on the premises after check-out.',
    ].join('\n'),
    he: [
      'אנחנו עמותה רשומה בישראל ומזמינים כל אדם להתארח אצלנו, ללא הבדל דת או אורח חיים. אנו מצפים מהאורחים לכבד את כללי הבית.',
      'אפשר להזמין באתר, פנים אל פנים, בטלפון או במייל. כל הזמנה מחייבת שם מלא ומגדר של כל המתארחים. אנו שומרים לעצמנו את הזכות לסרב להזמנה, למשל כשהפרטים חסרים.',
      'מספר החדרים והרכבם מוגבל, ולכן החדרים משובצים לפי זמינות ותפוסה. בקשות מיוחדות (חדר פרטי, קומה, מספר שוהים) ייענו ככל האפשר.',
      'הגישה לאכסניה היא דרך מדרגות רבות. אנא קחו זאת בחשבון אם יש לכם מגבלת ניידות – איננו יכולים לשאת אנשים.',
      'יחידים יכולים לשהות בחדר מעונות או בחדר פרטי. חדרי המעונות נפרדים לגברים ולנשים. חדרים פרטיים לזוג וחדרי משפחה מיועדים לזוגות נשואים בלבד (חדרי משפחה – עם או בלי ילדים).',
      'קבוצות: ההזמנה נעשית על ידי האחראי על הקבוצה וכוללת את מספר המתארחים ומגדרם. קבוצה של 15 איש ומעלה מחויבת בחוזה חתום ובמקדמה – נא לפנות אלינו ישירות.',
      'תשלום: הזמנה באתר משולמת במלואה בזמן ההזמנה דרך PayPal (אפשר לשלם גם בכרטיס אשראי דרך PayPal). קבלה נשלחת אליכם במייל.',
      'ביטול: הזמנה של יחידים אפשר לבטל ללא עלות עד 24 שעות לפני ההגעה, והתשלום מוחזר במלואו. אנא עדכנו אותנו מוקדם ככל האפשר על כל שינוי.',
      'האכסניה ללא עישון וללא אלכוהול. אסור לעשן ולשתות אלכוהול בשטח האכסניה ובחדרים. במקרה של הפרה אנו רשאים להפסיק את השהות מיד.',
      'אסור להשתמש ברשת ה-Wi-Fi החינמית לפעילות בלתי חוקית.',
      'כל השירותים כפופים לזמינות. אנו שומרים לעצמנו את הזכות לבצע שינויים ללא הודעה מוקדמת.',
      'צ׳ק-אין החל מהשעה 14:00, צ׳ק-אאוט עד השעה 12:00. באישור מראש אפשר להישאר בשטח גם אחרי הצ׳ק-אאוט.',
    ].join('\n'),
    de: [
      'Wir sind eine israelische gemeinnützige Organisation und heißen jeden Gast willkommen, unabhängig von Religion oder Lebensweise. Wir erwarten von unseren Gästen, dass sie die Hausordnung respektieren.',
      'Reservierungen sind online, persönlich, telefonisch oder per E-Mail möglich. Für jede Reservierung benötigen wir den vollständigen Namen und das Geschlecht aller Reisenden. Wir behalten uns vor, eine Reservierung abzulehnen, zum Beispiel bei unvollständigen Angaben.',
      'Anzahl und Kapazität unserer Räume sind begrenzt, daher erfolgt die Zimmerzuteilung nach Verfügbarkeit. Besondere Wünsche (Privatzimmer, Stockwerk, Anzahl der Gäste) werden nach Möglichkeit berücksichtigt.',
      'Die Herberge ist nur über viele Stufen erreichbar. Bitte beachten Sie dies bei eingeschränkter Mobilität – wir können leider keine Personen tragen.',
      'Einzelreisende können im Mehrbettzimmer oder im Privatzimmer übernachten. Unsere Mehrbettzimmer sind nach Geschlechtern getrennt. Doppelzimmer und Familienzimmer werden nur an verheiratete Paare vergeben (Familienzimmer mit oder ohne Kinder).',
      'Gruppen: Die Reservierung erfolgt durch die verantwortliche Person und muss die Anzahl und das Geschlecht aller Reisenden enthalten. Gruppen ab 15 Personen benötigen einen unterschriebenen Vertrag und eine Anzahlung – bitte kontaktieren Sie uns direkt.',
      'Bezahlung: Online-Reservierungen werden bei der Buchung vollständig über PayPal bezahlt (Kartenzahlung über PayPal möglich). Die Quittung erhalten Sie per E-Mail.',
      'Stornierung: Einzelreservierungen können bis 24 Stunden vor Ankunft kostenlos storniert werden; die Zahlung wird vollständig erstattet. Bitte teilen Sie uns Änderungen so früh wie möglich mit.',
      'Wir sind eine Nichtraucher- und alkoholfreie Herberge. Rauchen und Alkohol sind auf dem Gelände und in den Zimmern verboten. Bei Verstoß können wir den Aufenthalt sofort beenden.',
      'Die Nutzung des kostenlosen WLANs für illegale Zwecke ist verboten.',
      'Alle Angebote und Leistungen sind abhängig von der Verfügbarkeit. Änderungen ohne vorherige Ankündigung sind vorbehalten.',
      'Check-in ab 14 Uhr, Check-out bis 12 Uhr. Nach Absprache können Sie sich nach dem Check-out noch auf dem Gelände aufhalten.',
    ].join('\n'),
    ru: [
      "Мы – израильская некоммерческая организация и рады принять у себя любого гостя, независимо от религии и образа жизни. Мы ожидаем, что гости будут уважать правила дома.",
      "Забронировать можно онлайн, лично, по телефону или по e-mail. Для каждого бронирования нужны полные имена и пол всех гостей. Мы оставляем за собой право отказать в бронировании, например при неполных данных.",
      "Количество и вместимость комнат ограничены, поэтому номера распределяются по наличию мест. Особые пожелания (отдельная комната, этаж, число проживающих) учитываются по возможности.",
      "К хостелу ведёт много ступенек. Учтите это, если у вас ограничена подвижность – мы не можем никого переносить.",
      "Одиночные гости могут жить в общей или в отдельной комнате. Общие комнаты разделены для мужчин и для женщин. Отдельные комнаты для двоих и семейные номера предоставляются только супружеским парам (семейные номера – с детьми или без).",
      "Группы: бронирование делает ответственный за группу, указывая число и пол всех гостей. Для групп от 15 человек нужны подписанный договор и предоплата – пожалуйста, свяжитесь с нами напрямую.",
      "Оплата: онлайн-бронирование полностью оплачивается при бронировании через PayPal (через PayPal можно оплатить и картой). Квитанция приходит на e-mail.",
      "Отмена: индивидуальное бронирование можно бесплатно отменить не позднее чем за 24 часа до заезда, оплата возвращается полностью. Пожалуйста, сообщайте об изменениях как можно раньше.",
      "В хостеле запрещены курение и алкоголь – на территории и в комнатах. При нарушении мы вправе немедленно прекратить проживание.",
      "Запрещено использовать бесплатный Wi-Fi для любой незаконной деятельности.",
      "Все услуги предоставляются при наличии мест. Мы оставляем за собой право вносить изменения без предварительного уведомления.",
      "Заезд с 14:00, выезд до 12:00. С предварительного разрешения можно оставаться на территории и после выезда.",
    ].join('\n'),
  },

  gallery: [
    { src: '/photos/garden-1440.jpg', caption: { en: "The garden", he: "הגינה", de: "Der Garten", ru: "Сад" } },
    { src: '/photos/porch-1440.jpg', caption: { en: "The porch", he: "המרפסת", de: "Die Veranda", ru: "Веранда" } },
    { src: '/photos/fellowship-1440.jpg', caption: { en: "Fellowship room", he: "חדר השיתוף", de: "Gemeinschaftsraum", ru: "Комната общения" } },
    { src: '/photos/entrance-1440.jpg', caption: { en: "Our entrance on Hagefen Street", he: "הכניסה ברחוב הגפן", de: "Unser Eingang in der Hagefen-Straße", ru: "Вход с улицы Ха-Гефен" } },
    { src: '/photos/courtyard-1440.jpg', caption: { en: "Guest house courtyard", he: "החצר של בית ההארחה", de: "Innenhof des Gästehauses", ru: "Двор гостевого дома" } },
    { src: '/photos/staircase-1200.jpg', caption: { en: "Staircase of the guest house", he: "חדר המדרגות של בית ההארחה", de: "Treppenhaus des Gästehauses", ru: "Лестница гостевого дома" } },
    { src: '/photos/dorm-men-1440.jpg', caption: { en: "Shared room", he: "חדר משותף", de: "Mehrbettzimmer", ru: "Общая комната" } },
    { src: '/photos/studio-terrace-1440.jpg', caption: { en: "Terrace by the studios", he: "המרפסת ליד הסטודיו", de: "Terrasse vor den Studios", ru: "Терраса у студий" } },
  ],
  nearby: [
    { src: '/photos/haifa-view-1030.jpg', caption: { en: "Haifa from above – the German Colony and the port", he: "חיפה מלמעלה – המושבה הגרמנית והנמל", de: "Haifa von oben – Deutsche Kolonie und Hafen", ru: "Хайфа сверху – Немецкая колония и порт" } },
    { src: '/photos/bat-galim-1180.jpg', caption: { en: "Bat Galim beach promenade – 20 minutes on foot", he: "טיילת בת גלים – 20 דקות הליכה", de: "Strandpromenade Bat Galim – 20 Minuten zu Fuß", ru: "Набережная Бат-Галим – 20 минут пешком" } },
  ],
};

const LANG_OBJECT_KEYS = ['site_name', 'site_subtitle', 'hero_title', 'hero_text', 'about_text', 'location_text', 'address', 'terms'];
const STRING_KEYS = ['hero_image', 'phones', 'whatsapp', 'email', 'facebook', 'maps_query', 'checkin_time', 'checkout_time', 'currency', 'payment_mode', 'notify_email'];
const NUMBER_KEYS = { min_nights: [1, 60], max_nights: [1, 365], max_guests_online: [1, 60], booking_window_days: [7, 1000], hold_minutes: [5, 120], cancel_hours: [0, 720], doc_type: [0, 400] };
const LIST_KEYS = ['gallery', 'nearby'];

let cache = null;
let cacheAt = 0;

async function getSettings() {
  if (cache && Date.now() - cacheAt < 5000) return cache;
  const rows = await db.many('SELECT key, value FROM settings');
  const merged = JSON.parse(JSON.stringify(DEFAULTS));
  for (const r of rows) {
    if (!(r.key in DEFAULTS)) continue;
    if (LANG_OBJECT_KEYS.includes(r.key) && r.value && typeof r.value === 'object') merged[r.key] = { ...merged[r.key], ...r.value };
    else merged[r.key] = r.value;
  }
  cache = merged;
  cacheAt = Date.now();
  return merged;
}

function cleanLangObject(v, max) {
  const out = {};
  for (const l of ['en', 'he', 'de']) out[l] = typeof v?.[l] === 'string' ? v[l].slice(0, max) : '';
  return out;
}

function cleanList(v) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 60).filter((x) => x && typeof x.src === 'string' && x.src.length < 500).map((x) => ({
    src: x.src.trim(),
    caption: cleanLangObject(x.caption || {}, 200),
  }));
}

async function saveSettings(partial) {
  const clean = {};
  for (const [k, v] of Object.entries(partial || {})) {
    if (LANG_OBJECT_KEYS.includes(k)) clean[k] = cleanLangObject(v, k === 'terms' ? 20000 : 3000);
    else if (STRING_KEYS.includes(k)) clean[k] = typeof v === 'string' ? v.trim().slice(0, 500) : String(DEFAULTS[k]);
    else if (k in NUMBER_KEYS) {
      const [min, max] = NUMBER_KEYS[k];
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      clean[k] = Math.min(max, Math.max(min, Math.round(n)));
    } else if (LIST_KEYS.includes(k)) clean[k] = cleanList(v);
  }
  if (clean.payment_mode && !['paypal', 'paypal_or_arrival', 'arrival'].includes(clean.payment_mode)) delete clean.payment_mode;
  if ('doc_type' in clean && ![0, 320, 400].includes(clean.doc_type)) delete clean.doc_type;
  if (clean.checkin_time && !/^\d{2}:\d{2}$/.test(clean.checkin_time)) delete clean.checkin_time;
  if (clean.checkout_time && !/^\d{2}:\d{2}$/.test(clean.checkout_time)) delete clean.checkout_time;
  if (clean.currency && !['ILS', 'USD', 'EUR'].includes(clean.currency)) delete clean.currency;

  for (const [k, v] of Object.entries(clean)) {
    await db.q(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [k, JSON.stringify(v)]
    );
  }
  cache = null;
  return getSettings();
}

function invalidate() { cache = null; }

module.exports = { DEFAULTS, getSettings, saveSettings, invalidate };
