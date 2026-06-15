# Courtify-Badminton Backend

Express and TypeScript backend foundation for Courtify-Badminton. This phase
contains authentication, user onboarding, court administration, security
middleware, and health checks only.

## Requirements

- Node.js 20 or newer
- PostgreSQL/Supabase database with the root migration and seed applied
- A trusted server-side PostgreSQL connection string

The database has row-level security enabled without client policies. Use the
Supabase direct or pooler PostgreSQL connection intended for trusted backend
services. Never expose `DATABASE_URL`, `JWT_SECRET`, or `OTP_PEPPER` to a
browser.

## Setup

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run dev
```

Replace every secret and database value in `.env`. Production requires
64-character or longer independent values for `JWT_SECRET` and `OTP_PEPPER`,
HTTPS-only CORS origins, and a numeric `TRUST_PROXY` hop count.
`LOCK_CLEANUP_INTERVAL_MS` is optional and defaults to `60000`.

## Commands

```powershell
npm run dev
npm run lint
npm run build
npm start
```

`npm start` runs the compiled `dist/server.js` output.

## API examples

The examples assume the API is running on `http://localhost:3001`.

Health:

```bash
curl http://localhost:3001/health
curl http://localhost:3001/health/db
```

Request an OTP:

```bash
curl -X POST http://localhost:3001/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"+6738123456"}'
```

Development and test environments include the OTP in this response. Production
never returns it.

Verify the OTP:

```bash
curl -X POST http://localhost:3001/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"+6738123456","otp":"123456"}'
```

Use the returned access token for protected routes:

```bash
curl http://localhost:3001/api/me \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

Complete onboarding:

```bash
curl -X POST http://localhost:3001/api/me/onboarding \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Customer Name","email":"customer@example.com"}'
```

List active courts:

```bash
curl http://localhost:3001/api/courts
```

Check court availability:

```bash
curl "http://localhost:3001/api/availability?court_id=10000000-0000-4000-8000-000000000001&date=2026-06-20"
```

The response contains one-hour slots from 08:00 through the final 21:00 start,
with BND pricing calculated for each slot. Confirmed slots and unexpired
checkout locks are unavailable; expired locks do not block availability.

Create a 10-minute booking lock as an authenticated customer:

```bash
curl -X POST http://localhost:3001/api/bookings/lock \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"court_id":"10000000-0000-4000-8000-000000000001","slot_date":"2026-06-20","start_hour":18,"duration_hours":2}'
```

The server calculates the BND total and atomically creates one locked booking
plus one locked row for each consecutive hourly slot. A conflicting active
lock or confirmed slot returns HTTP `409`.

Create a Stripe Checkout Session for an active booking lock:

```bash
curl -X POST http://localhost:3001/api/payments/checkout-session \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"booking_id":"BOOKING_ID"}'
```

The server reads the authoritative BND amount from the locked booking, creates
one Stripe Checkout line item, and stores the Checkout Session ID. Booking
confirmation is performed only by the verified Stripe webhook below.

### Stripe webhook

Set `STRIPE_WEBHOOK_SECRET` to the signing secret printed by Stripe CLI, then
forward supported events to the API:

```bash
stripe listen \
  --events checkout.session.completed,payment_intent.succeeded \
  --forward-to localhost:3001/api/payments/webhook
```

Trigger a test Checkout completion:

```bash
stripe trigger checkout.session.completed
```

The generated event validates forwarding, signature verification, and event
storage. To test booking confirmation end to end, create a real booking lock
and Checkout Session through the API, then complete that Checkout Session with
a Stripe test payment while `stripe listen` is running.

The webhook requires Stripe's raw request body and valid signature. Duplicate
event IDs return HTTP `200` without reprocessing. A valid completed Checkout
confirms only a still-locked booking, stores the payment intent ID, changes its
hourly slots to `confirmed`, and records the verified event in
`payment_events`.

List the authenticated customer's booking history:

```bash
curl http://localhost:3001/api/bookings/me \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

List all bookings as an administrator:

```bash
curl http://localhost:3001/api/admin/bookings \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"
```

Filter the administrator view by booking status, court, and slot date:

```bash
curl "http://localhost:3001/api/admin/bookings?status=confirmed&court_id=10000000-0000-4000-8000-000000000001&date=2026-06-20" \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"
```

Request cancellation of a confirmed booking:

```bash
curl -X POST http://localhost:3001/api/bookings/BOOKING_ID/cancel \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Unable to attend"}'
```

Cancellation is allowed only at least 24 hours before the reservation starts.
The booking remains as an audit record with status `cancellation_requested`,
while its hourly slot rows are deleted atomically so the court becomes
immediately available for another booking. Refund handling remains manual.

List cancellation requests as an administrator:

```bash
curl http://localhost:3001/api/admin/cancellation-requests \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"
```

List all courts as an administrator:

```bash
curl http://localhost:3001/api/admin/courts \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"
```

Create a court as an administrator:

```bash
curl -X POST http://localhost:3001/api/admin/courts \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Court 5","location":"Main Hall","active":true}'
```

The seeded administrator can request an OTP using the phone number in
`supabase/seed.sql`, then verify it to obtain an administrator token.

## Booking Engine Validation

Use a future date and an active court ID for this checklist:

1. Check availability before creating a lock:

```bash
curl "http://localhost:3001/api/availability?court_id=COURT_ID&date=YYYY-MM-DD"
```

2. Create a lock, then check availability again:

```bash
curl -X POST http://localhost:3001/api/bookings/lock \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"court_id":"COURT_ID","slot_date":"YYYY-MM-DD","start_hour":18,"duration_hours":2}'
```

3. Repeat the same lock request. It must return HTTP `409`.
4. After the 10-minute lock expires and cleanup runs, availability must show
   the slots as available and the parent booking must have status `expired`.
5. For a confirmed booking at least 24 hours away, request cancellation and
   verify the deleted slot rows make the hours immediately available again.

Expired locks are ignored by availability even before cleanup. Cleanup runs
once at startup and periodically thereafter, deleting only slots belonging to
elapsed `locked` bookings and preserving their parent rows as `expired`.
