'use strict';
const db = require('./db');

const WP = 'https://www.bethel-hostel.com/wp-content/uploads';

// Initial room setup. Everything here can be changed later in the admin panel (חדרים ומחירים).
// Layout and prices follow the hostel's current requirements (docs/other-session-summary-he.md):
//   4 shared rooms of 6 beds  = 24 beds (2 women's rooms, 2 men's rooms) at 150 NIS per bed
//   3 studio apartments at 300 NIS per adult; children up to 12 are free
// Note: the "children are free" rule is approximated here with the price-per-guest table,
// because the system does not track ages yet (see docs/requirements-comparison.md, C-1).
const bedUnits = (room, count) => Array.from({ length: count }, (_, i) => `${room} · מיטה ${i + 1}`);

const ROOM_TYPES = [
  {
    slug: 'dorm-women',
    name: { en: 'Bed in a women’s shared room', he: 'מיטה בחדר משותף לנשים', de: 'Bett im Frauen-Mehrbettzimmer' },
    description: {
      en: 'One bed in a shared room for women, six beds per room. Showers, toilets and the kitchen are shared. Bed linens and towels are included.',
      he: 'מיטה אחת בחדר משותף לנשים, שש מיטות בחדר. המקלחות, השירותים והמטבח משותפים. כולל מצעים ומגבות.',
      de: 'Ein Bett im Mehrbettzimmer für Frauen, sechs Betten pro Zimmer. Duschen, WC und Küche werden geteilt. Bettwäsche und Handtücher inklusive.',
    },
    note: {
      en: 'Women only. A child may stay in a shared room only together with a parent of the same gender.',
      he: 'לנשים בלבד. ילד יכול ללון בחדר משותף רק יחד עם הורה מאותו מין.',
      de: 'Nur für Frauen. Ein Kind kann im Mehrbettzimmer nur zusammen mit einem Elternteil gleichen Geschlechts übernachten.',
    },
    sold_as: 'bed', capacity: 1, prices: [150], gender: 'female',
    photos: [`${WP}/2020/06/Room-6-6-bed-dormatory-.jpeg`],
    units: [...bedUnits('חדר נשים א׳', 6), ...bedUnits('חדר נשים ב׳', 6)],
  },
  {
    slug: 'dorm-men',
    name: { en: 'Bed in a men’s shared room', he: 'מיטה בחדר משותף לגברים', de: 'Bett im Männer-Mehrbettzimmer' },
    description: {
      en: 'One bed in a shared room for men, six beds per room. Showers, toilets and the kitchen are shared. Bed linens and towels are included.',
      he: 'מיטה אחת בחדר משותף לגברים, שש מיטות בחדר. המקלחות, השירותים והמטבח משותפים. כולל מצעים ומגבות.',
      de: 'Ein Bett im Mehrbettzimmer für Männer, sechs Betten pro Zimmer. Duschen, WC und Küche werden geteilt. Bettwäsche und Handtücher inklusive.',
    },
    note: {
      en: 'Men only. A child may stay in a shared room only together with a parent of the same gender.',
      he: 'לגברים בלבד. ילד יכול ללון בחדר משותף רק יחד עם הורה מאותו מין.',
      de: 'Nur für Männer. Ein Kind kann im Mehrbettzimmer nur zusammen mit einem Elternteil gleichen Geschlechts übernachten.',
    },
    sold_as: 'bed', capacity: 1, prices: [150], gender: 'male',
    photos: [`${WP}/2025/06/Room-4--scaled-1200x900.jpeg`],
    units: [...bedUnits('חדר גברים א׳', 6), ...bedUnits('חדר גברים ב׳', 6)],
  },
  {
    slug: 'studio',
    name: { en: 'Studio apartment', he: 'דירת סטודיו', de: 'Studio-Apartment' },
    description: {
      en: 'A private studio apartment with its own shower, toilet and kitchenette. For up to 2 adults and 2 children.',
      he: 'דירת סטודיו פרטית עם מקלחת, שירותים ומטבחון פרטיים. עד 2 מבוגרים ו-2 ילדים.',
      de: 'Ein privates Studio-Apartment mit eigener Dusche, WC und Küchenzeile. Für bis zu 2 Erwachsene und 2 Kinder.',
    },
    note: {
      en: '₪300 per adult per night. Children up to age 12 and infants stay free.',
      he: '300 ₪ לכל מבוגר ללילה. ילדים עד גיל 12 ותינוקות ללא תשלום.',
      de: '300 ₪ pro Erwachsenem und Nacht. Kinder bis 12 Jahre und Babys übernachten kostenlos.',
    },
    sold_as: 'room', capacity: 4, prices: [300, 600, 600, 600], gender: 'any',
    photos: [`${WP}/2020/06/Bethel-Hostel-Room-9-Studio-1200x800.jpg`, `${WP}/2020/06/Bethel-Hostel-Room-9-Studio-2-1200x676.jpg`, `${WP}/2020/06/Promenade_Rooms_2_9_10-1536x674.jpg`],
    units: ['סטודיו 1', 'סטודיו 2', 'סטודיו 3'],
  },
];

async function seedIfEmpty() {
  const row = await db.one('SELECT count(*)::int AS n FROM room_types');
  if (row.n > 0) return false;
  await db.tx(async (c) => {
    let sort = 10;
    for (const t of ROOM_TYPES) {
      const r = await c.query(
        `INSERT INTO room_types (slug, name, description, note, sold_as, capacity, prices, gender, photos, sort)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [t.slug, t.name, t.description, t.note, t.sold_as, t.capacity, JSON.stringify(t.prices), t.gender, JSON.stringify(t.photos), sort]
      );
      let us = 1;
      for (const u of t.units) {
        await c.query('INSERT INTO units (room_type_id, name, sort) VALUES ($1,$2,$3)', [r.rows[0].id, u, us++]);
      }
      sort += 10;
    }
  });
  console.log('[seed] created initial room types and units');
  return true;
}

module.exports = { seedIfEmpty, ROOM_TYPES };
