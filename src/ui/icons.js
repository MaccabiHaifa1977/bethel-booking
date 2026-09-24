'use strict';
// One consistent outline icon set (24px grid, 1.6 stroke). Icons are decorative: labels carry the meaning.
const P = {
  bed: '<path d="M3 19v-8.5A1.5 1.5 0 0 1 4.5 9h15a1.5 1.5 0 0 1 1.5 1.5V19M3 15h18M6.5 9V7.2c0-.7.5-1.2 1.2-1.2h3.1c.7 0 1.2.5 1.2 1.2V9"/>',
  bunk: '<path d="M5 3v18M19 3v18M5 7.5h14M5 16h14M8 7.5V5.8h4v1.7M8 16v-1.7h4V16"/>',
  bath: '<path d="M4 12h16v2.5a4.5 4.5 0 0 1-4.5 4.5h-7A4.5 4.5 0 0 1 4 14.5V12zM6 12V6a2 2 0 0 1 3.6-1.2M7.5 19l-1 2M16.5 19l1 2"/>',
  kitchen: '<path d="M7 3v8M4.5 3v4.5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 21V3c-2.2 1.3-3.3 3.7-3.3 6.5V13H17"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0M16 5.2a3 3 0 0 1 0 5.6M18 14.3A5.5 5.5 0 0 1 21 20"/>',
  wifi: '<path d="M2.8 9a13.5 13.5 0 0 1 18.4 0M5.8 12.4a9 9 0 0 1 12.4 0M8.8 15.8a4.6 4.6 0 0 1 6.4 0"/><circle cx="12" cy="19" r=".9" fill="currentColor"/>',
  towel: '<path d="M6 3h12v14H6zM6 17v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3M9 7h6M9 10.5h6"/>',
  safe: '<rect x="3.5" y="4" width="17" height="15" rx="2"/><circle cx="12" cy="11.5" r="3"/><path d="M12 8.5v1M15 11.5h-1M6.5 19v1.5M17.5 19v1.5"/>',
  parking: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M9.5 16.5v-9h3.3a2.7 2.7 0 0 1 0 5.4H9.5"/>',
  leaf: '<path d="M5 19c0-8 5.5-13.5 14-14 .3 8.3-5.3 14-13 14H5zM5 19c3-3.2 6-5.6 9-7.2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  sofa: '<path d="M4 11V8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5V11M3 12.5a1.5 1.5 0 0 1 3 0V14h12v-1.5a1.5 1.5 0 0 1 3 0V18H3zM5 18v2M19 18v2"/>',
  dining: '<path d="M4 3v6a2 2 0 0 0 4 0V3M6 11v10M16 3h1.5a2.5 2.5 0 0 1 2.5 2.5V13h-4zM17.5 13v8"/>',
  pin: '<path d="M12 21s7-6.1 7-11.5a7 7 0 0 0-14 0C5 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  phone: '<path d="M5.5 3.5h3l1.8 4.6-2.3 1.4a11 11 0 0 0 6.5 6.5l1.4-2.3 4.6 1.8v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3.5 5.7a2 2 0 0 1 2-2.2z"/>',
  chat: '<path d="M20.5 11.8a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1.3-4.4a8.5 8.5 0 1 1 15.7-4.3z"/><path d="M8.6 9.4c.3 2.6 3.3 5.6 6 6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.8 7 8.2 6 8.2-6"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  stairs: '<path d="M3 20h5v-4h4v-4h4V8h5M3 20V9"/>',
  nosmoke: '<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12M7.5 13.5h6"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  refund: '<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"/><path d="M12 8v4l2.5 1.5"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  door: '<path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5V21M3 21h18"/><circle cx="15" cy="12.5" r=".9" fill="currentColor"/>',
  waves: '<path d="M2.5 9c2.4 0 2.4-2 4.8-2s2.4 2 4.7 2 2.4-2 4.7-2 2.4 2 4.8 2M2.5 14c2.4 0 2.4-2 4.8-2s2.4 2 4.7 2 2.4-2 4.7-2 2.4 2 4.8 2M2.5 19c2.4 0 2.4-2 4.8-2s2.4 2 4.7 2 2.4-2 4.7-2 2.4 2 4.8 2"/>',
  train: '<rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10h14M9 13h.01M15 13h.01M8 16l-2.5 4.5M16 16l2.5 4.5"/>',
  city: '<path d="M3 21h18M5 21V9l5-3v15M10 21V4l6 3v14M16 21v-9h3v9"/>',
  map: '<path d="m3.5 6 5.5-2.5 6 2.5 5.5-2.5V18L15 20.5 9 18l-5.5 2.5zM9 3.5V18M15 6v14.5"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5s1.1-6.1 3.4-8.5z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="8.5"/><path d="m8.2 12.3 2.6 2.6 5-5.2"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  alert: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4M12 17h.01"/>',
  minus: '<path d="M6 12h12"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  chevronLeft: '<path d="m14.5 6-6 6 6 6"/>',
  chevronRight: '<path d="m9.5 6 6 6-6 6"/>',
  chevronDown: '<path d="m6 9.5 6 6 6-6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5-4.5 3.5 3 3-2.5L20 18"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  facebook: '<path d="M14 8.5h2.5V5H14a3.5 3.5 0 0 0-3.5 3.5V11H8v3.5h2.5V21H14v-6.5h2.5l.5-3.5h-3V9a.5.5 0 0 1 .5-.5z"/>',
  external: '<path d="M14 4h6v6M20 4l-8.5 8.5M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  printer: '<path d="M7 9V3.5h10V9M7 17.5H4.5v-7A1.5 1.5 0 0 1 6 9h12a1.5 1.5 0 0 1 1.5 1.5v7H17M7 14h10v6.5H7z"/>',
};

function icon(name, cls = '') {
  const p = P[name];
  if (!p) return '';
  return `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${p}</svg>`;
}

const LOGO = `<svg class="logo-mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><path d="M9 34V18.5a11 11 0 0 1 22 0V34" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 34h30" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20 13v12M15.5 17.5h9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

module.exports = { icon, LOGO, ICONS: P };
