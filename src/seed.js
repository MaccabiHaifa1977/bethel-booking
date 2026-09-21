'use strict';
const db = require('./db');

const WP = 'https://www.bethel-hostel.com/wp-content/uploads';

// Initial room setup, taken from the current bethel-hostel.com site.
// Everything here can be changed later in the admin panel (חדרים).
const ROOM_TYPES = [
  {
    slug: 'private-room',
    name: { en: 'Private room', he: 'חדר פרטי', de: 'Privatzimmer' },
    description: {
      en: 'A quiet private room for one or two guests. Bed linens and towels are included.',
      he: 'חדר פרטי ושקט לאורח אחד או לשניים. כולל מצעים ומגבות.',
      de: 'Ein ruhiges Privatzimmer für ein oder zwei Gäste. Bettwäsche und Handtücher inklusive.',
    },
    note: {
      en: 'A private room for two is for married couples only.',
      he: 'חדר פרטי לזוג מיועד לזוגות נשואים בלבד.',
      de: 'Doppelzimmer werden nur an verheiratete Paare vergeben.',
    },
    sold_as: 'room', capacity: 2, prices: [250, 300], gender: 'any',
    photos: [`${WP}/2020/06/Room-3-Private-Double-1.jpeg`, `${WP}/2025/06/Room-5_-scaled-1200x675.jpeg`, `${WP}/2020/06/Room-3-Private-Double-2.jpeg`],
    units: ['חדר 3', 'חדר 5'],
  },
  {
    slug: 'private-triple',
    name: { en: 'Private room for three', he: 'חדר פרטי לשלושה', de: 'Privatzimmer für drei' },
    description: {
      en: 'A private room with three beds, next to the promenade of rooms 2, 9 and 10.',
      he: 'חדר פרטי עם שלוש מיטות, ליד הטיילת של חדרים 2, 9 ו-10.',
      de: 'Ein Privatzimmer mit drei Betten an der Promenade der Zimmer 2, 9 und 10.',
    },
    note: {
      en: 'A private room for two is for married couples only.',
      he: 'חדר פרטי לזוג מיועד לזוגות נשואים בלבד.',
      de: 'Doppelzimmer werden nur an verheiratete Paare vergeben.',
    },
    sold_as: 'room', capacity: 3, prices: [250, 300, 300], gender: 'any',
    photos: [`${WP}/2020/06/Room-10-Private-3-beds-1200x676.jpg`, `${WP}/2020/06/Promenade_Rooms_2_9_10-1536x674.jpg`],
    units: ['חדר 10'],
  },
  {
    slug: 'studio',
    name: { en: 'Studio', he: 'סטודיו', de: 'Studio' },
    description: {
      en: 'A spacious private studio on the promenade of rooms 2, 9 and 10.',
      he: 'סטודיו פרטי ומרווח על הטיילת של חדרים 2, 9 ו-10.',
      de: 'Ein geräumiges privates Studio an der Promenade der Zimmer 2, 9 und 10.',
    },
    note: {
      en: 'For married couples only.',
      he: 'לזוגות נשואים בלבד.',
      de: 'Nur für verheiratete Paare.',
    },
    sold_as: 'room', capacity: 2, prices: [400, 400], gender: 'any',
    photos: [`${WP}/2020/06/Bethel-Hostel-Room-9-Studio-1200x800.jpg`, `${WP}/2020/06/Bethel-Hostel-Room-9-Studio-2-1200x676.jpg`],
    units: ['חדר 9'],
  },
  {
    slug: 'family-room',
    name: { en: 'Family room', he: 'חדר משפחה', de: 'Familienzimmer' },
    description: {
      en: 'A family room in the protected space (bomb shelter) of the house, with its own WC.',
      he: 'חדר משפחה בממ״ד של הבית, עם שירותים צמודים.',
      de: 'Ein Familienzimmer im Schutzraum des Hauses mit eigenem WC.',
    },
    note: {
      en: 'Family rooms are for married couples, with or without children.',
      he: 'חדרי משפחה מיועדים לזוגות נשואים, עם או בלי ילדים.',
      de: 'Familienzimmer sind für verheiratete Paare mit oder ohne Kinder.',
    },
    sold_as: 'room', capacity: 4, prices: [250, 300, 300, 400], gender: 'any',
    photos: [
      `${WP}/2026/02/Room8-Family-Room-Bomb-Shelter-Main-Bedroom-1200x675.jpg`,
      `${WP}/2026/02/Room8-Bomb-Shelter-Familiy-Room-scaled-1200x2133.jpg`,
      `${WP}/2026/02/Room8-Bomb-Shelter-Family-Room-WC-scaled-1200x2133.jpg`,
      `${WP}/2026/02/Room8-Family-Room-2nd-BathRoom-scaled-1200x2133.jpg`,
    ],
    units: ['חדר 8 (ממ״ד)'],
  },
  {
    slug: 'dorm-men',
    name: { en: 'Bed in men’s dormitory', he: 'מיטה בחדר מעונות לגברים', de: 'Bett im Männer-Mehrbettzimmer' },
    description: {
      en: 'A bed in a shared men-only dormitory with 8 beds. Bed linens and towels are included.',
      he: 'מיטה בחדר מעונות משותף לגברים בלבד, 8 מיטות. כולל מצעים ומגבות.',
      de: 'Ein Bett im Mehrbettzimmer nur für Männer (8 Betten). Bettwäsche und Handtücher inklusive.',
    },
    note: { en: 'Men only.', he: 'לגברים בלבד.', de: 'Nur für Männer.' },
    sold_as: 'bed', capacity: 1, prices: [100], gender: 'male',
    photos: [`${WP}/2025/06/Room-4--scaled-1200x900.jpeg`],
    units: Array.from({ length: 8 }, (_, i) => `חדר 4 · מיטה ${i + 1}`),
  },
  {
    slug: 'dorm-women',
    name: { en: 'Bed in women’s dormitory', he: 'מיטה בחדר מעונות לנשים', de: 'Bett im Frauen-Mehrbettzimmer' },
    description: {
      en: 'A bed in a shared women-only dormitory with 6 beds. Bed linens and towels are included.',
      he: 'מיטה בחדר מעונות משותף לנשים בלבד, 6 מיטות. כולל מצעים ומגבות.',
      de: 'Ein Bett im Mehrbettzimmer nur für Frauen (6 Betten). Bettwäsche und Handtücher inklusive.',
    },
    note: { en: 'Women only.', he: 'לנשים בלבד.', de: 'Nur für Frauen.' },
    sold_as: 'bed', capacity: 1, prices: [100], gender: 'female',
    photos: [`${WP}/2020/06/Room-6-6-bed-dormatory-.jpeg`],
    units: Array.from({ length: 6 }, (_, i) => `חדר 6 · מיטה ${i + 1}`),
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
