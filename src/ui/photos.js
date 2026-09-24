'use strict';
// Responsive <picture> markup for the Bethel photo set in public/photos (built by scripts/photos.js).
// Any other image URL (admin uploads, external links) is rendered as a plain <img>.
const { esc } = require('../util');
const MANIFEST = require('../photos.json');

// Old WordPress URLs (still stored in the database and settings) -> local photo keys
const LEGACY = [
  ['Gardens-', 'garden'], ['Porch-', 'porch'], ['Entrance-', 'entrance'], ['Guest-House-Area', 'courtyard'],
  ['Fellowship-shared-Rooms', 'fellowship'], ['Second-floor-of-the-guest-house', 'staircase'], ['Room-4-', 'dorm-men'],
  ['Room-6-6-bed', 'dorm-women'], ['Room-9-Studio-2', 'studio'], ['Room-9-Studio', 'studio-kitchen'],
  ['Promenade_Rooms', 'studio-terrace'], ['German-Colony-location', 'haifa-view'], ['Bat-Galim-Beach', 'bat-galim'],
  ['Dinning-Room', 'dining-hall'], ['Front-of-Hostel-Garden', 'front-garden'],
];

function keyOf(src) {
  if (typeof src !== 'string' || !src) return null;
  const local = /^\/photos\/([a-z0-9-]+?)-\d+\.(?:jpg|webp)$/.exec(src);
  if (local && MANIFEST[local[1]]) return local[1];
  if (MANIFEST[src]) return src;
  if (!/bethel-hostel\.com\/wp-content\//.test(src)) return null;
  const hit = LEGACY.find(([frag]) => src.includes(frag));
  return hit ? hit[1] : null;
}

function url(src, want = 1440) {
  const key = keyOf(src);
  if (!key) return src || '';
  const m = MANIFEST[key];
  return `/photos/${key}-${m.fallback}.jpg`;
}

// sizes: CSS sizes attribute · ratio: optional forced aspect for width/height hints
function picture(src, { alt = '', sizes = '100vw', cls = '', loading = 'lazy', priority = false, width = 1200 } = {}) {
  const key = keyOf(src);
  const attrs = `${cls ? ` class="${esc(cls)}"` : ''} alt="${esc(alt)}" decoding="async"${priority ? ' fetchpriority="high"' : ` loading="${loading}"`}`;
  if (!key) {
    if (!src) return `<span class="img-missing" role="img" aria-label="${esc(alt)}"></span>`;
    return `<img src="${esc(src)}"${attrs}>`;
  }
  const m = MANIFEST[key];
  const w = width;
  const h = Math.round(w / m.ratio);
  const srcset = m.widths.map((x) => `/photos/${key}-${x}.webp ${x}w`).join(', ');
  return `<picture><source type="image/webp" srcset="${srcset}" sizes="${esc(sizes)}"><img src="/photos/${key}-${m.fallback}.jpg" width="${w}" height="${h}"${attrs}></picture>`;
}

function srcset(src) {
  const key = keyOf(src);
  if (!key) return null;
  return MANIFEST[key].widths.map((x) => `/photos/${key}-${x}.webp ${x}w`).join(', ');
}

module.exports = { picture, url, srcset, keyOf };
