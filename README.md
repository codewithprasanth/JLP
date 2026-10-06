# Jinisha Lovely Products (JLP) — online ordering app

Implements the *BRD & Solution Design* and *Developer Specification* PDFs in this folder,
with the design-review fixes listed below.

| Folder | What | Dev URL |
|---|---|---|
| `backend/` | Node.js + Express 5 modular monolith, Prisma 7, PostgreSQL, Redis | http://localhost:4000 |
| `customer-app/` | Angular 21 customer app (mobile-first) | http://localhost:4200 |
| `admin-app/` | Angular 21 admin panel | http://localhost:4300 |

## Stack versions (LTS / stable lines)

| | Version | Note |
|---|---|---|
| Node.js | **24 LTS** (Krypton) | `engines: >=24 <25` |
| Angular | **21 LTS** | Angular 22 is current but not yet LTS |
| TypeScript | 5.9 | required by Angular 21; used in backend too |
| Express | 5.x | Express's current LTS line |
| Prisma | 7.10 (pinned) | npm `latest` pointed at an 8.0 RC at time of writing |
| node-redis | 6.x | v4 is maintenance-only |
| PostgreSQL | 17 | local Docker; use 17 on RDS |
| Redis | Valkey 8 | matches Render Key Value |
| Leaflet | 1.9 | stable line (2.0 is alpha); OpenStreetMap tiles, no API key |

## Run locally

```bash
docker compose up -d                 # Postgres on :5433, Valkey on :6379

cd backend
cp .env.example .env                 # dev defaults work as-is
npm install
npx prisma migrate dev               # creates tables + partial unique index
npm run db:seed                      # settings row, admin user, starter menu
npm run dev                          # http://localhost:4000

cd ../customer-app && npm install && npx ng serve     # :4200
cd ../admin-app    && npm install && npx ng serve     # :4300
```

* **Customer login is email + OTP** (Addendum 1). With `BREVO_API_KEY` empty in development, every
  email is printed to the API console instead:
  `[notify:log] {"channel":"email","to":"you@example.com","kind":"otp","otp":"123456"}`.
* **In production without Brevo**, customer login returns 503 "Login is not available yet", order emails
  are skipped, and no OTP is ever logged. `NOTIFICATIONS_LOG_ONLY=true` deliberately logs OTPs, so you can
  test a deployment yourself before email is set up. The API prints its notification mode at startup.
* **Admin login:** `admin` / the `SEED_ADMIN_PASSWORD` in `backend/.env`.
* **Images:** without `CLOUDINARY_*` the app works, but photo upload returns a clear 503.
* Postgres is on **5433**, not 5432, to avoid clashing with other local projects.

### Smoke test (48 API checks)

```bash
cd backend && BREVO_API_KEY= npm run dev > ../.api-dev.log 2>&1 &   # log-only: never send real email in tests
node scripts/smoke.mjs ../.api-dev.log
```

The smoke test refuses to run if the API is sending real email, because it signs up `@example.com` addresses.

**Business details** (name, address, contact, FSSAI, grievance officer, legal "draft" flag) live in one file:
`customer-app/src/app/core/business.ts`. The legal pages (`/privacy`, `/terms`, `/refund-policy`,
`/delivery-policy`, `/contact`) are placeholder text in `features/legal/legal-content.ts`. Delivery radius and
minimum order in them are filled in live from admin Settings.

Covers email-OTP rules (case-insensitive email, phone login rejected), the profile phone requirement,
refresh rotation, role isolation both ways, radius checks, minimum order, quantity validation,
idempotent order placement, the 60s cancel window, status-transition rules, which status emails go out,
payment marking, reports, soft delete, and the accepting-orders toggle. Safe to re-run: it uses its own
throwaway dish for the soft-delete test. `scripts/cloudinary-lifecycle.mjs` checks image upload,
replace and delete against the real Cloudinary account.

## Design-review fixes vs. the original spec

**Would have broken the app**
1. Auth routers are mounted **before** the guarded `/api/customer` and `/api/admin` prefixes. In the spec's order, login returned 401.
2. `GET /api/settings/public` is mounted (the spec never mounted it).
3. Menu items and categories are **soft-deleted** (`archived_at`). A hard delete is blocked by the foreign key from past `order_items`.
4. `order_status_history.admin_id` is nullable and there's a new `actor` column (CUSTOMER/ADMIN/SYSTEM). The initial PLACED row and customer cancellations are now recorded, so the timeline is complete.
5. A seed script creates the settings singleton and the admin account.
6. The build compiles TypeScript (`npm run build` → `dist/server.js`). Render static sites get an SPA rewrite rule.

**Security & integrity**
- zod validation on every input: quantity must be an integer from 1 to 50, duplicate lines are merged, and request bodies are explicitly whitelisted (no `...req.body` into Prisma).
- Money is computed with `Prisma.Decimal`, never floats. Order placement runs in a single transaction.
- OTP limits: 3 sends per email per 10 min, a 30s resend cooldown, **per-IP limits** so the endpoint can't be used to mail-bomb, and an atomic attempt counter (`HINCRBY`). The OTP is stored as an HMAC.
- Refresh tokens are opaque and **rotated on every use**. Only their SHA-256 hash is stored, and reuse is rejected. Admin has a `/refresh` endpoint. Logout works without an access token.
- Cancellation is a single conditional UPDATE, so it can't race an admin confirming. Admin status changes follow an explicit state machine with an optimistic check. Rejecting requires a `cancel_reason`.
- Order emails are fire-and-forget, so an email-provider outage can't fail or duplicate an order. There's an optional `Idempotency-Key` header for "Place order". Email templates HTML-escape every user-supplied value.
- Images: the new one uploads first, then the old one is deleted. Failed creates clean up their upload.
- Reports and dashboard use IST day boundaries. Revenue means DELIVERED orders; "collected" means `is_paid`. Cancelled orders are excluded from counts.
- `isNewUser` means the profile is incomplete (no name or no phone), so a user who quit profile setup sees it again. Ordering is blocked (`PROFILE_INCOMPLETE`) until a contact phone is on file.

## Addendum 1 — email OTP instead of SMS

- **Login** is email + 6-digit OTP. Emails are lower-cased and unique. **Phone** is required at profile setup, but
  only as delivery contact: it isn't verified, isn't unique, and isn't used to log in. Email is read-only in the profile.
- **Notifications** go through one `NotificationChannel` interface (`backend/src/modules/notification/`).
  `EmailChannel` (Brevo) is live; `SmsChannel` (MSG91) is scaffolded for Phase 2.
- **Emails sent:** login code, order confirmation (items, total, address), cancellation (always), and the
  statuses in `ORDER_EMAIL_STATUSES` (default `CONFIRMED,OUT_FOR_DELIVERY,DELIVERED`).
- **Switching back to SMS is not just a flag:** an SMS can't verify an email login, so login must move back to
  phone numbers first. The API therefore refuses `NOTIFICATION_CHANNEL=sms` at startup with that explanation.
- **Migration** `20261006090000_email_login` backfills any pre-addendum phone-only accounts with an undeliverable
  `legacy-<id>@users.invalid` address. Their order history is kept; production started empty, so it isn't affected.

## Secrets

- **Never committed.** `backend/.env` is git-ignored. Production values live only in Render's environment settings.
- **JWT / OTP secrets** (production): Render generates them (`generateValue: true`). They never leave Render.
  The API **refuses to start** in production if either is shorter than 32 chars, a `change-me` placeholder, or reused for both.
- **Admin password:** a random 24-character password, bcrypt cost 12. The seed requires 16+ chars in production.
  Reset it, which also signs the admin out everywhere:
  `$env:NEW_ADMIN_PASSWORD='…'; npm run admin:set-password`.
  The password is read from an env var, not an argument, so it stays out of shell history.
- **Dev containers** are bound to `127.0.0.1` only, because the dev Redis has no password.
- **Rotate** a credential whenever it's been pasted anywhere shared (chat, tickets, email).

## Deploy (Render, Singapore)

`render.yaml` is a Render Blueprint that creates everything on the **free tier** in Singapore:
API (`jlp-api`), Key Value (`jlp-redis`), Postgres (`jlp-db`), and the two static sites (`jlp-order`, `jlp-admin`).

1. Render → New → Blueprint → pick this repo. When prompted, set `SEED_ADMIN_PASSWORD` (16+ chars), the Brevo and
   Cloudinary values, and `CORS_ORIGIN_CUSTOMER` / `CORS_ORIGIN_ADMIN` (the two static-site URLs).
   The database URL, Redis URL, secrets and the sites' API address are wired automatically.
2. Migrations and the idempotent seed run at API startup (the free plan has no pre-deploy step).
3. Free-tier limits: the API sleeps after 15 min idle, so ping `/health` every 5 min (e.g. UptimeRobot). The free
   database **expires 30 days after creation**, so upgrade it before real customers depend on it. One free
   database per account.

You can't run migrations from a corporate network that proxies traffic (e.g. Netskope): it resets
PostgreSQL's TLS handshake. That's why migrations run on Render instead.

**Brevo (email):** verify a sender, or better, authenticate your own domain (DKIM + DMARC) so codes don't land in
spam. A `@gmail.com` sender fails DMARC alignment. The free plan allows 300 emails/day; at ~200 orders/day with the
default statuses that's ~800/day, so plan for a paid tier or a shorter `ORDER_EMAIL_STATUSES` list.

**SMS (Phase 2):** after DLT approval, implement phone-based login, add `MSG91_*`, and set `NOTIFICATION_CHANNEL=sms`.
MSG91 template variables: OTP `##otp##`; order `##order_id##`, `##status##`.


## Still open (business / legal)

- Privacy policy (India's DPDP Act 2023): email addresses, phone numbers and locations are collected. Ship at least a basic notice in v1.
- FSSAI licence number display.
- Tokens are kept in `localStorage`, which is standard for this kind of SPA but readable by any XSS. Keep a strict CSP when hosting.
- OpenStreetMap's public tiles are fine at this traffic level. Switch to a tile provider if usage grows.
