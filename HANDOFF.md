# HANDOFF – Bethel Hostel booking system (session summary for the next Claude)

> **לשמעון:** מעבירים את הפרויקט ל-Claude במחשב אחר? פותחים את Claude Code בתיקייה הזאת וכותבים לו: **"קרא את HANDOFF.md ואת README.md והמשך משם. לא לעשות שום דבר אונליין בלי אישור שלי."**

Written 2026-09-21 at the end of the first build session (the session was on Simon's old PC and Claude account).

---

## 0. Read first – working with this user

- **Owner:** Simon Sabbah, Haifa. Non-technical but experienced at building with AI. **Talk to him in Hebrew.** He wants exact copy-paste commands, one step at a time. Label which window a command is for (🟦 PowerShell or 🟣 Claude Code).
- **He watches costs.** Say so before starting very long jobs. Don't use subagents or maximum effort for routine work. Suggest a new chat for unrelated topics.
- **Current instruction from Simon: DO NOTHING ONLINE until he explicitly approves.** That means:
  - no deploy (Railway), no GitHub push, no DNS changes
  - no creating accounts, no sending e-mails
  - no calls to the real PayPal or Morning APIs
- **His coding conventions (hard-won, always follow):**
  - Hebrew text inside JS strings uses the geresh ׳ (U+05F3) and gershayim ״ (U+05F4). Never put a straight `'` or `"` inside a Hebrew JS string, because that has broken pages in the browser before.
  - Dynamic event handlers use `data-*` attributes with event delegation. Never inline `onclick="fn('x')"`.
  - Before saying something is done, run `npm run check` (syntax of every JS file) and `npm test`.
  - Verify that files really saved. Add a timestamped line with the commit hash to `project-log.md` after each step.
  - PowerShell here-strings corrupt Hebrew. Write files with the editor tool, not `echo` or `@'…'@`.

## 1. What was asked and what was decided

- **Request (Hebrew, paraphrased):** build a website for his hostel with online booking paid through **PayPal**, management of the rooms, and **pick an Israeli company for online invoices/receipts**. The hostel is run by a **registered Israeli non-profit (עמותה)**.
- **Answers he gave:** site languages **Hebrew + English + German**. The hostel is **Bethel Hostel**, whose current site is https://www.bethel-hostel.com (WordPress on netcup hosting, EN + DE).
- **Decisions:**
  - **Invoicing: Morning (Green Invoice).** It has an official REST API with a sandbox, supports the עמותה business type, and has PayPal as a payment type. Its receipt is e-mailed to the client automatically.
    - The API needs the **Best plan (₪54 a month, 50 documents a month)**. The Extra plan is ₪89 a month for 200 documents.
    - Tell him **not** to enable Morning's own "PayPal connection", because every payment would then get two receipts.
  - **Document type:** default **400 = קבלה (receipt)** for a non-profit that is a מלכ"ר (VAT-exempt). It can be switched in the admin settings to 320 (tax invoice-receipt) or 0 (none). Suggest he confirms with the accountant.
  - The old site calls the price a "required donation". The new site says **"price per night"**, because payment for lodging is payment for a service: it gets a regular receipt, not a section 46 donation receipt. Simon was told this.
  - **Stack:** Node 22 + Express 5 + pg + PostgreSQL, vanilla JS, no build step (same as his other projects). Target hosting is **Railway** with its Postgres add-on.
  - **E-mail:** through **Resend** (an HTTPS API), because Railway blocks SMTP on non-Pro plans.
  - **Payment:** full payment through PayPal at booking time. A setting also allows "PayPal or pay on arrival", or "arrival only".
  - **URLs:**
    - English at `/`, Hebrew at `/he`, German at `/de`.
    - The old WordPress URLs redirect with 301 to the new pages.
    - The admin panel is at `/admin` and is in Hebrew.

## 2. Hostel facts (copied from bethel-hostel.com)

- **Name:** "Bethel Bible Community & Pilgrims Hospitality Home". In Hebrew the site uses "אכסניית בית אל חיפה".
- **Address:** 40 Hagefen Street, Haifa (German Colony).
- **Phone:** +972-50-7481789 / +972-50-3481780. **WhatsApp:** 972503481780.
- **E-mail:** bethel.hostel.reservation@gmail.com. **Facebook:** facebook.com/BethelYouthHostel.
- **Old prices** (called a "required donation"):
  - single private room ₪250 a night
  - double private room ₪300
  - studio ₪400
  - 3 or more people in a room: ₪100 per bed
  - The old site took cash only, paid at check-in.
- **House rules**, taken from the old Reservations page:
  - The full name **and gender of every traveller** is required.
  - There are separate men-only and women-only dorms.
  - Private rooms for two, and family rooms, are **for married couples only**.
  - The hostel is reached by many stairs.
  - No smoking, no alcohol.
  - Groups of 15 or more need a signed contract and a deposit.
  - Free cancellation up to 24 hours before arrival.
  - Check-in from 14:00, check-out by 12:00.
  - These rules are now in the Terms in all three languages. The German text was adapted from their own German page.
- **Rooms seeded into the new system** (6 room types, 19 units; photos hotlinked from the old site):

  | Room type | Units | Capacity | Price per night (₪) |
  |---|---|---|---|
  | private-room | Rooms 3 and 5 | 2 | 250 / 300 |
  | private-triple | Room 10 | 3 | 250 / 300 / 300 |
  | studio | Room 9 | 2 | 400 / 400 |
  | family-room | Room 8 (the building's shelter room, ממ"ד) | 4 | 250 / 300 / 300 / 400 |
  | dorm-men | Room 4, 8 beds | 1 bed | 100 per bed |
  | dorm-women | Room 6, 6 beds | 1 bed | 100 per bed |

## 3. ⚠ Assumptions Simon still has to confirm

1. Is room 4 the **men's** dorm and room 6 the **women's** dorm?
2. The capacities of the studio (set to 2) and the family room (set to 4).
3. **Room 2** is mentioned on the old site ("Promenade for Rooms 2, 9, 10"), but its details are unknown, so it isn't set up.
4. The refund policy: a full refund if cancelled up to 24 hours before arrival (this wording is in the Terms).
5. The VAT status: receipt (400) or tax invoice-receipt (320). This is for the accountant.

Everything above is editable in the admin panel (חדרים ומחירים / הגדרות האתר). The seed runs only when the `room_types` table is empty.

## 4. Status

- **Built and tested locally. Never deployed.** Local git repo, branch `main`, no remote. The last commits are in `project-log.md`.
- Runs on port 3470. `DEMO_MODE=true` shows a fake "demo payment" button while PayPal is not configured. That button is disabled whenever PayPal keys exist, and must never be on in production.
- **Tests that passed on 2026-09-21:**
  - API flows: availability, booking, demo payment, gender, terms and date validation.
  - 6 parallel bookings for the single studio: exactly 1 succeeded. A database-level overlapping insert was blocked by the exclusion constraint.
  - Every admin API action: login, overview, calendar, manual booking, cash payment, date change with repricing, block, move unit, move into a busy unit (409), cancel with refund.
  - `npm test`: PayPal capture with a Morning receipt; a payment the guest approved but abandoned, recovered by the sweeper; hold expiry; cancel with refund. **These used simulated PayPal and Morning servers.**
  - The browser UI in EN, HE and DE, desktop and mobile (375px, no horizontal overflow).
- **Never tested against the real sandboxes (no accounts yet):**
  - Whether PayPal accepts `application_context.shipping_preference=NO_SHIPPING` together with the JS SDK card button.
  - Whether Morning accepts the exact receipt payload, including `income` rows on a type-400 receipt. Morning's spec marks `income` as required.

## 5. Architecture and files

```
server.js            entry: loads .env (next to itself), security headers, static files, /admin shell (with CSP),
                     routes, error handler; on start: migrate + seed; sweepHolds() every 60 s
src/schema.sql       idempotent DDL. Tables: settings, images, room_types, units, bookings, booking_units, payments, audit_log.
                     booking_units has EXCLUDE USING gist (unit_id WITH =, stay WITH &&) WHERE (active)  -> the database
                     itself forbids double booking (needs btree_gist)
src/db.js            pg Pool, type parsers (DATE stays 'YYYY-MM-DD', numeric -> number), tx(), migrate(), audit()
src/seed.js          initial rooms/units (section 2)
src/settings.js      DEFAULTS for every site text in 3 languages, contacts, rules, terms, gallery. Stored as key->jsonb
                     rows merged over the defaults; saveSettings() validates
src/booking.js       CORE: availability, priceFor, createBooking (pg_advisory_xact_lock(4242) + auto-assign free units),
                     startPaypal, capturePaypal, finalizePaid (idempotent; unique paypal_order_id), sweepHolds,
                     issueReceipt (Morning), recordPayment, refundPayment, cancelBooking, moveUnit, changeDates, e-mails
src/paypal.js        Orders v2: token, createOrder, captureOrder, getOrder, refundCapture, captureInfo
src/morning.js       OAuth token + createDocument + buildDocument (receipt payload)
src/mailer.js        Resend API + guest/admin e-mail templates (skipped and logged if not configured)
src/auth.js          admin session = HMAC-signed HttpOnly cookie `bh_admin` (7 days); password = env ADMIN_PASSWORD
src/i18n.js          public UI strings en/he/de + privacy and accessibility page texts
src/render.js        server-rendered public pages (home, rooms, book, booking status, terms, privacy, accessibility, 404)
src/routes/public.js pages per language, old-URL 301s, robots.txt, sitemap.xml, /img/:id (images stored in the database),
                     /api/public/* (availability, bookings, paypal-order, paypal-capture, demo-pay)
src/routes/admin.js  /api/admin/* (login, overview, calendar, bookings CRUD/actions, free-units, room-types, units,
                     images upload, settings, integrations test, import-photos)
public/js/site.js    menu, lightbox, map loaded on click (no Google cookies before that), print
public/js/book.js    booking app: dates -> rooms -> details (travellers + gender) -> PayPal/demo; also "resume" mode
public/js/admin.js   Hebrew admin single-page app (hash router): dashboard, calendar, bookings, booking detail, new
                     booking/block, rooms editor (prices by occupancy, photos, units), settings, integrations
public/css/site.css, admin.css
scripts/check.js     node --check on every .js           ->  npm run check
test/flow.test.js    mocked PayPal+Morning end-to-end; uses the real DB with 2027 dates and deletes its rows  ->  npm test
README.md            Hebrew guide for Simon: running, PayPal/Morning/Resend setup, Railway deploy, go-live checklist
.env.example         every environment variable, explained
```

**Pricing model.** `room_types.prices` is an array of prices per night by number of guests: `[1 guest, 2 guests, …]`. When `sold_as = 'bed'` each unit is one bed and `prices[0]` is the price per bed. A booking holds one row in `booking_units` per room or bed.

**Payment flow:**
1. The details form is submitted. `createBooking` makes a `pending` hold for `hold_minutes` (20) with units already assigned.
2. The PayPal button calls `startPaypal`. It creates the order and extends the hold by 15 minutes.
3. `onApprove` calls `capturePaypal`, then `finalizePaid` (confirmed, payment row saved), then `issueReceipt` (Morning, 15-second timeout) and the e-mails.
4. The sweeper runs every minute. For each expired hold that has a PayPal order, it asks PayPal first: if the order is APPROVED it captures it, if COMPLETED it finalizes it. Only otherwise does it expire the hold.

**Refunds and receipts.** A PayPal refund writes a negative payment row. No Morning credit or cancellation document is created automatically: the admin sees a note to create it manually in Morning.

## 6. External APIs (verified 2026-09-21)

**Morning (Green Invoice):** new API infrastructure since June 2026. The old addresses are blocked after June 2026.
- Token: `POST https://api.morning.co/idp/v1/oauth/token`, body `{grant_type:"client_credentials", client_id, client_secret}`. The response has `{accessToken, tokenType, expiresAt}` and the token is valid for 1 hour.
- Sandbox token URL: `https://api.sandbox.morning.dev/idp/v1/oauth/token`.
- API base: `https://api.greeninvoice.co.il/api/v1`. Sandbox: `https://sandbox.d.greeninvoice.co.il/api/v1`.
- `POST /documents` requires `type, lang (he|en), currency, vatType, income[]`. Optional: `payment[]`, `client{name, emails, phone, country, add}`, `emailContent` (extra text in the e-mail to the client), `attachment`. The document link is e-mailed to `client.emails`.
- Codes:
  - Document types: 400 receipt, 405 donation receipt, 320 tax invoice-receipt, 305 tax invoice, 330 credit invoice.
  - Payment types: 1 cash, 2 cheque, 3 card, 4 transfer, 5 PayPal, 10 payment app (appType 1 = Bit), 11 other.
  - Business type 4 = עמותה.
  - Income row `vatType`: 0 default, 1 VAT included, 2 exempt.
- Full OpenAPI spec: https://developers.morning.co/docs/openapi.bundled.json. The docs page is rendered by JavaScript, so WebFetch returns a 404. Curl the JSON instead.

**PayPal (REST Orders v2 + JS SDK v5 buttons):**
- API base: `api-m.sandbox.paypal.com` or `api-m.paypal.com`.
- Orders are created with `intent: CAPTURE`, `custom_id` = booking id, `invoice_id` = `CODE-xxxx`, and `application_context{brand_name, locale, shipping_preference:'NO_SHIPPING', user_action:'PAY_NOW'}`.
- Capture and refund send a `PayPal-Request-Id` header for idempotency.
- SDK URL parameters: `currency=ILS&intent=capture&components=buttons&locale=he_IL|en_US|de_DE&disable-funding=paylater,venmo`.

## 7. Running it on a new PC (local only, nothing online)

1. Install **Node.js 22 LTS**, **PostgreSQL** (17 was used) and **Git**.
2. Unzip the project, e.g. to `C:\Users\<user>\bethel-booking`. The zip includes the `.git` history but **not** `node_modules` and **not** `.env`, which held this PC's local database password.
3. `npm install`
4. Create the database. With psql: `CREATE DATABASE bethel_booking;` (or `createdb -U postgres bethel_booking`).
5. Copy `.env.example` to `.env` and set:
   ```
   DATABASE_URL=postgres://postgres:<pg-password>@localhost:5432/bethel_booking
   PORT=3470
   PUBLIC_URL=http://localhost:3470
   ADMIN_PASSWORD=<choose one>
   SESSION_SECRET=<random string>
   DEMO_MODE=true
   ```
   Leave the PayPal, Morning and Resend keys empty for now.
6. `npm start`. The first start creates the tables and seeds the rooms. Open http://localhost:3470, `/he`, `/de` and `/admin`.
7. Run `npm run check` and `npm test` (both should pass).
8. For the Claude desktop app preview, add this configuration to the `.claude/launch.json` of the folder the session is opened in:
   `{ "name": "bethel-booking", "runtimeExecutable": "node", "runtimeArgs": ["<full path>\\server.js"], "port": 3470 }`

The test bookings from the old PC's database are not transferred. That's fine: they were only test data.

## 8. Next steps, in order. Each one needs Simon's explicit OK.

1. Simon answers the assumptions in section 3. Update rooms and terms in the admin (or in the seed, if the database is still fresh).
2. **PayPal sandbox.** Simon creates a REST app in developer.paypal.com with the non-profit's Business account (he creates the accounts himself; Claude doesn't). Put the keys in `.env` and run a real sandbox booking, both with a PayPal account and as a card guest. Check the NO_SHIPPING and locale behaviour.
3. **Morning sandbox.** Simon gets sandbox API keys. Test the receipt end to end, and adjust `buildDocument` if Morning rejects anything, for example `income` on type 400.
4. **Deploy (only after approval).**
   - Create a GitHub repo, then a Railway project with Postgres. Set `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `PUBLIC_URL`, `NODE_ENV=production` and the keys. **No `DEMO_MODE`.**
   - Deploy by `git push`. From his other projects: `railway up` is not durable once a service is GitHub-linked.
   - Node is pinned to `22.x` in package.json.
5. In admin → חיבורים, click "העתקת התמונות" to copy the photos from the old WordPress site into the database, before the old site is shut down.
6. **Domain:** replace the WordPress site at bethel-hostel.com, or start with book.bethel-hostel.com. Also verify the domain in Resend and set `RESEND_API_KEY` and `MAIL_FROM`.
7. Go-live checklist (in README): real small payment → refund → switch to `PAYPAL_ENV=live` and `MORNING_ENV=production`.

## 9. Not built yet (possible later work)

- Guest self-service cancellation (today the admin cancels and refunds in one click).
- Automatic Morning credit or cancellation document on refunds.
- Seasonal or weekend pricing.
- An English admin panel, or separate staff logins (today there is one shared password).
- PayPal webhooks (the sweeper covers the main case).
- A CSP on public pages (only /admin has one, to avoid breaking the PayPal SDK).
- Donations or section 46 receipts. Not requested.
