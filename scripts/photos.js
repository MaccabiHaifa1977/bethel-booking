'use strict';
// Builds the responsive photo set in public/photos from the original Bethel photographs.
// Every photo is a real picture of Bethel; the adjustments only correct exposure, colour and sharpness.
// Run once after changing the list:  npm i --no-save sharp && node scripts/photos.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const WP = 'https://www.bethel-hostel.com/wp-content/uploads';
const OUT = path.join(__dirname, '..', 'public', 'photos');
const MANIFEST = path.join(__dirname, '..', 'src', 'photos.json');
const CACHE = path.join(require('os').tmpdir(), 'bethel-photo-originals');

// key: local name · src: best original · widths: generated sizes · fix: tone and white-balance correction · crop: [left, top, width, height] as fractions
const PHOTOS = [
  { key: 'garden', src: '2025/06/Gardens--scaled.jpeg', widths: [640, 960, 1440, 1920, 2560], fix: { gamma: 1.05, saturation: 1.04 } },
  { key: 'porch', src: '2025/06/Porch-scaled.jpeg', widths: [640, 960, 1440, 1920], fix: { gamma: 1.08, saturation: 1.02 } },
  { key: 'entrance', src: '2025/06/Entrance--scaled.jpeg', widths: [640, 960, 1440, 1920], fix: { gamma: 1.04 } },
  { key: 'courtyard', src: '2025/06/Guest-House-Area-scaled.jpeg', widths: [640, 960, 1440, 1920], fix: { gamma: 1.1, saturation: 1.03 } },
  { key: 'fellowship', src: '2025/06/Fellowship-shared-Rooms-scaled.jpeg', widths: [640, 960, 1440, 1920], fix: { gamma: 1.06 } },
  { key: 'staircase', src: '2025/06/Second-floor-of-the-guest-house-scaled.jpeg', widths: [480, 800, 1200], fix: { gamma: 1.04 } },
  { key: 'dorm-men', src: '2025/06/Room-4--scaled.jpeg', widths: [640, 960, 1440, 1920], fix: { gamma: 1.1, saturation: 1.02 } },
  { key: 'dorm-women', src: '2020/06/Room-6-6-bed-dormatory-.jpeg', widths: [640, 960], fix: { normalise: true, gamma: 1.22, brightness: 1.04, saturation: 0.88, balance: [0.93, 0.97, 1.12] } },
  { key: 'studio', src: '2020/06/Bethel-Hostel-Room-9-Studio-2.jpg', widths: [640, 960, 1440, 1800], fix: { normalise: true, gamma: 1.2, brightness: 1.04, saturation: 0.92, balance: [0.95, 0.98, 1.07] } },
  { key: 'studio-kitchen', src: '2020/06/Bethel-Hostel-Room-9-Studio.jpg', widths: [640, 960, 1440, 1800], fix: { normalise: true, gamma: 1.2, brightness: 1.04, saturation: 0.92, balance: [0.95, 0.98, 1.07] } },
  { key: 'studio-terrace', src: '2020/06/Promenade_Rooms_2_9_10.jpg', widths: [640, 960, 1440, 1800], fix: { gamma: 1.05 } },
  { key: 'haifa-view', src: '2020/06/German-Colony-location-of-Bethel-Hostel.jpeg', widths: [640, 1030], fix: { gamma: 1.02, saturation: 1.03 } },
  { key: 'bat-galim', src: '2020/06/Bat-Galim-Beach-Promenade-20-minute-walk-from-Hostel.png', widths: [640, 1180], fix: { normalise: true, saturation: 1.06 } },
  { key: 'dining-hall', src: '2020/06/Dinning-Room-and-Recreational-area.jpeg', widths: [640, 1030], fix: { gamma: 1.25, brightness: 1.08 } },
  { key: 'front-garden', src: '2020/06/Front-of-Hostel-Garden.jpeg', widths: [640, 900], crop: [0.14, 0, 0.86, 1], fix: { gamma: 1.05 } },
];

async function original(p) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, path.basename(p.src));
  if (!fs.existsSync(file)) {
    const res = await fetch(`${WP}/${p.src}`);
    if (!res.ok) throw new Error(`${p.src}: HTTP ${res.status}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return file;
}

async function build(p) {
  const file = await original(p);
  let base = sharp(file).rotate();
  const meta = await base.metadata();
  if (p.crop) {
    const [l, t, w, h] = p.crop;
    base = base.extract({ left: Math.round(l * meta.width), top: Math.round(t * meta.height), width: Math.round(w * meta.width), height: Math.round(h * meta.height) });
  }
  const f = p.fix || {};
  if (f.normalise) base = base.normalise({ lower: 1, upper: 99.5 });
  if (f.gamma) base = base.gamma(f.gamma);
  if (f.brightness || f.saturation) base = base.modulate({ brightness: f.brightness || 1, saturation: f.saturation || 1 });
  if (f.balance) base = base.linear(f.balance, [0, 0, 0]);
  const corrected = await base.sharpen({ sigma: 0.6 }).toBuffer();
  const info = await sharp(corrected).metadata();
  const widths = p.widths.filter((w) => w <= info.width);
  if (!widths.length || widths[widths.length - 1] < Math.min(info.width, p.widths[p.widths.length - 1])) widths.push(info.width);
  for (const w of widths) {
    const img = sharp(corrected).resize({ width: w, withoutEnlargement: true });
    await img.clone().webp({ quality: 78, effort: 5 }).toFile(path.join(OUT, `${p.key}-${w}.webp`));
  }
  const fallback = widths.find((w) => w >= 1200) || widths[widths.length - 1];
  await sharp(corrected).resize({ width: fallback }).jpeg({ quality: 80, progressive: true, mozjpeg: true }).toFile(path.join(OUT, `${p.key}-${fallback}.jpg`));
  return { key: p.key, width: info.width, height: info.height, widths, fallback };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const manifest = {};
  for (const p of PHOTOS) {
    const m = await build(p);
    manifest[m.key] = { ratio: +(m.width / m.height).toFixed(4), widths: m.widths, fallback: m.fallback, original: p.src };
    console.log(m.key.padEnd(15), `${m.width}x${m.height}`, 'webp:', m.widths.join(','), 'jpg:', m.fallback);
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log('wrote', path.relative(process.cwd(), MANIFEST));
})().catch((e) => { console.error(e); process.exit(1); });
