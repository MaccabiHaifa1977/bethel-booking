# Requirements comparison – what we built vs. the second requirements summary

Simon pasted a requirements summary from a **different conversation** (saved verbatim in `docs/other-session-summary-he.md`). Nothing was built in that conversation. It looks like **newer business information from the hostel side**: new prices, a new room layout, a stricter refund policy.

**Rule for the next Claude:** do **not** apply the conflicting business facts below until Simon confirms which version is correct today.
*Status 2026-09-21: analysis only. No code has been changed because of this document.*

## A. Conflicts – business facts that differ (Simon must confirm)

| # | Topic | Built now (taken from the old website) | Second summary |
|---|---|---|---|
| 1 | Public languages | EN + HE + DE | EN + DE only ("no need for Hebrew or Arabic") |
| 2 | Room inventory | Private rooms 3 and 5; triple room 10; studio 9; family room 8; men's dorm room 4 (8 beds); women's dorm room 6 (6 beds) | **4 shared rooms × 6 beds = 24 beds** (2 women's rooms = 12, 2 men's rooms = 12, fixed split); **3 studio apartments**, each with private shower, WC and kitchenette. No private rooms or family room are mentioned. |
| 3 | Prices | ₪100 per bed; private room ₪250 / ₪300; studio ₪400 flat | **₪150 per bed** (children too); **studio ₪300 per paying guest aged 13+**. Children up to and including age 12, and infants, are free. One person pays ₪300, two adults ₪600, 2 adults + 2 children ₪600. |
| 4 | Occupancy rules | Price by number of guests; no concept of children | Studio holds at most **2 adults + 2 children**; an infant counts as one of the child places. **In shared rooms, a child may stay only with a parent of the same sex, in the same room.** |
| 5 | Check-in / check-out | 14:00 / 12:00 | **15:00 / 11:00** |
| 6 | Same-day booking | Allowed | **Not allowed. The earliest check-in is tomorrow.** Still undecided: calendar day vs. 24 hours before 15:00. |
| 7 | Cancellation | Free up to 24 hours before arrival, full refund | **Non-refundable.** Explicit checkbox; policy shown in the summary and in the email; acceptance stored as proof. Exceptional cancellations happen in the admin. |
| 8 | Groups | 15 or more people must contact the hostel (max 14 online) | **10 or more guests, or anyone needing meals or special care:** separate **"Group Stay"** inquiry form. No payment, no automatic blocking. |
| 9 | Invoicing provider | Morning (Green Invoice), Best plan, API implemented | **iCount** (Advanced plan needed for the API; Express has none; 45-day trial) |
| 10 | Private-room rule | "Private rooms for two are for married couples only" (from the old terms) | Not mentioned |
| 11 | Max nights | 30 online (a setting) | No maximum decided |

**Recommendation to Simon:** summary 2 looks like the current truth (new prices, a room layout confirmed by the hostel). If he confirms, restructure the rooms, prices and terms to match it.

## B. Already covered by what we built ✓

- A new design built from the old site's real photos and texts; EN/DE (and HE); mobile-friendly; a prominent availability search.
- Real-time availability, automatic price calculation, instant confirmation after server-side payment verification, PayPal only, ILS only, prices fixed all year.
- The guest picks only "women's bed / men's bed"; the system assigns a free bed.
- **Double-booking protection:**
  - holds during payment, auto-release, a re-check at capture
  - advisory lock plus a database exclusion constraint
  - never relies on the browser
  - checks the amount and currency (a mismatch is flagged in admin notes)
- An automatic accounting document after payment, e-mailed to the guest; its status is visible in the admin.
- **Admin:** dashboard, occupancy calendar, search, booking detail with payment, booking and receipt status plus the PayPal capture ID, manual bookings, blocks, date changes, unit moves, exceptional cancel with refund, internal notes, settings for times, prices and texts.
- **Security and privacy:** secrets in env vars, no card data stored, rate limits, per-booking audit log, privacy policy, accessibility statement (IS 5568), HTTPS redirect, CSP on admin.
- The old site stays live during development; the domain switch comes last (README checklist).

## C. Ideas from summary 2 worth copying (not built yet), in priority order

**Must (correctness, legal, operations):**
1. **Children and ages.**
   - Travellers get an age, or an adult/child flag. For the studio, ask adults, then children with ages.
   - Paying guests = adults + children older than `free_child_max_age` (setting, default 12).
   - Studio capacity: max 2 adults and 2 children, infants included.
   - Shared rooms: every child needs an adult of the same gender in the same booking. A child pays per bed.
   - Open questions: minimum age in shared rooms; whether a 13-year-old may stay alone; mixed-gender parent and child.
2. **Same-room allocation.**
   - Beds of one booking and one gender go into **one physical room**. This is mandatory when children are included.
   - Add `units.room_label`, e.g. "Women room A".
   - Allocation: for each gender group, pick the best-fitting physical room with enough free beds for the whole stay. If none fits and there are children: no availability. Without children, it may split across rooms.
3. **Non-refundable policy with proof.**
   - A separate mandatory checkbox with the exact text (EN/DE wording is given in summary 2).
   - Store on the booking: `terms_accepted_at`, `terms_ip`, `terms_user_agent`, and a snapshot or hash of the policy text and version.
   - Show it in the summary, on the booking page and in the confirmation email.
4. **No same-day booking:** setting `min_days_ahead` (default 1, by calendar date in Asia/Jerusalem). Enforce it on the server and set the date picker's minimum.
5. **Group Stay page and form** (EN/DE): the fields listed in summary 2, section 12.
   - New `group_requests` table; e-mail to the hostel plus an auto-reply to the contact.
   - Admin inbox with statuses new / contacted / closed and notes.
   - Honeypot and rate limit against spam. Online bookings capped at 9 guests (the setting already exists).
6. **The non-profit has no credit card.** Railway (card only?), iCount/Morning subscriptions and possibly Resend need a payment solution **before** committing:
   - an organisational debit card
   - an authorised signatory pays and gets reimbursed
   - a hosting provider that invoices by bank transfer
   - Also set a Railway spending limit.

**Should:**

7. **Admin users and permissions.**
   - `admin_users` table (username, name, e-mail, scrypt password hash, role admin/staff, active).
   - Record who did what in `audit_log.actor`.
   - A user-management screen. 2FA later.
   - Today there is a single shared password.
8. **Check-in / check-out marking** (`checked_in_at` / `checked_out_at`) and a **printable daily arrivals list**.
9. **Confirmation e-mail:**
   - add the non-refundable policy and a map/directions link
   - log send status per booking (`email_log` table, shown in the admin)
   - an admin-editable extra message per language
10. **PayPal webhook** (`PAYMENT.CAPTURE.COMPLETED`), verified with `POST /v1/notifications/verify-webhook-signature` and `PAYPAL_WEBHOOK_ID`, plus an idempotent `finalizePaid`. This is extra safety on top of the existing minute job.
11. **Pages:**
    - About Bethel (story, community, vision – needs content)
    - Policies (dorm rules, children, payment, non-refund, check-in/out)
    - Gallery with categories (rooms, studio, common areas, garden, surroundings)
    - Terms of use
    - A link to the group page from the home page
12. **Export** bookings to CSV/Excel, plus a monthly report.
13. **Backups:** scheduled `pg_dump` or Railway backups, and a **restore test**.
14. **Data minimisation:** anonymise guest personal data after the retention period the accountant or lawyer sets.
15. **Go-live:** a full backup of the old WordPress site, kept as a fallback; get the **full-quality original photos** (the import currently copies the 1200px versions) and permission to use them.

**Decide:**

16. **iCount vs Morning.** Both are Israeli providers with an API. The decision depends on the accountant and on which one the non-profit can pay for without a credit card.
    - The integration is isolated in `src/morning.js` and `issueReceipt()` in `src/booking.js`.
    - Switching means adding `src/icount.js` with the same `buildDocument` / `createDocument` interface.
    - **Verify iCount's current API documentation before coding; nothing about it has been checked yet.**
17. **Hebrew public site:** keep it (it costs nothing now) or hide it with a setting. The admin panel stays in Hebrew.
18. **Analytics:** none now. If wanted, use a cookie-less tool or add consent.
19. Design decisions still open: final logo, brand colours, fonts, hero image, and whether to show a Bible verse or faith message on the home page.

## D. Things our build has that summary 2 didn't think of (keep them)

- 301 redirects from the old WordPress URLs (keeps Google ranking).
- The minute job recovers PayPal payments that were approved but never captured (the guest closed the browser).
- A database-level exclusion constraint: double booking is impossible even with a bug in the code.
- An occupancy calendar with click-to-book, a demo mode for testing without accounts, photo import from the old site, a Hebrew admin, and a map loaded only on click (no Google cookies before that).

## E. Legal note to verify (from memory – a lawyer must confirm)

Israel's Consumer Protection Law gives consumers a right to cancel **remote** transactions. As remembered: for accommodation or holiday services, the right may apply within 14 days of booking **if the cancellation is at least 7 days (not counting rest days) before the stay starts**, with a cancellation fee capped at 5% or ₪100, whichever is lower. If that is correct, a blanket "non-refundable" may not hold for such cases, at least for Israeli consumers. Summary 2 already says to check this with a lawyer.

## F. Information still missing (merged list)

- **Organisation:** legal name (EN + HE), registration number, official address, authorised signatory, bank details in English.
- **Materials:** logo file; original photos and permission to use them; access to the old site and to the domain's DNS.
- **Accounting:** the accountant's decision on the document type and on VAT.
- **Policies:** final wording of the terms, the non-refundable text (with legal check) and the privacy policy.
- **Rules:**
  - child rules: minimum age, age 13+ alone, mixed-gender parent and child
  - maximum nights
  - how long a room is held during payment (20 minutes now)
  - meals for groups; allergies and what staff need to know
  - accessibility
  - smoking, pets, alcohol, quiet hours
  - whether linens, towels, Wi-Fi and parking are still included
  - any deposit or cleaning fee
- **Admin:** admin names and e-mails; permissions per admin; reports and export.
- **Analytics:** whether he wants any.
- **Payment:** how to pay for Railway / iCount / Morning without a credit card.

## G. Suggested implementation order (after Simon answers A and C-6)

1. Room restructure and pricing: 24 beds in 4 physical rooms plus 3 studios; per-adult studio pricing with free children; `room_label`; same-room allocation; child rules; times 15:00 / 11:00; `min_days_ahead`.
   - **Files:** `schema.sql`, `seed.js`, `booking.js` (`createBooking`, `priceFor`), `book.js` (studio adults/children UI, traveller age), `admin.js` (room editor fields, new-booking form), `i18n.js`, `test/flow.test.js`.
2. Non-refundable checkbox and proof storage; terms and e-mail texts.
3. Group Stay page, form and admin inbox.
4. Admin users and roles; check-in/out; arrivals print; CSV export.
5. PayPal webhook; e-mail log.
6. Pages: About, Policies, gallery categories. Hebrew public on/off setting.
7. The invoicing provider decision, and iCount if chosen.

Every step: run `npm run check` and `npm test`; add a new test case for child pricing and same-room allocation; log the step in `project-log.md`.
