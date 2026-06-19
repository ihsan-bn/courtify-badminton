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

Local transactional email configuration:

```text
EMAIL_PROVIDER=local
EMAIL_FROM=no-reply@courtify.local
```

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
  --events checkout.session.completed,checkout.session.expired,payment_intent.succeeded,payment_intent.payment_failed,refund.updated,charge.refunded \
  --forward-to localhost:3001/api/payments/webhook
```

Trigger a test Checkout completion:

```bash
stripe trigger checkout.session.completed
```

Trigger the recovery events:

```bash
stripe trigger checkout.session.expired
stripe trigger payment_intent.payment_failed
stripe trigger refund.updated
stripe trigger charge.refunded
```

The generated event validates forwarding, signature verification, and event
storage. To test booking confirmation end to end, create a real booking lock
and Checkout Session through the API, then complete that Checkout Session with
a Stripe test payment while `stripe listen` is running.

The webhook requires Stripe's raw request body and valid signature. Duplicate
event IDs return HTTP `200` without reprocessing. A valid completed Checkout
confirms only a still-locked booking after verifying payment mode, paid status,
BND currency, and the database-authoritative amount. It stores the PaymentIntent
ID, verifies every expected hourly slot was confirmed, and records the verified
event in `payment_events`.

Retry Checkout for an owned `locked` or `expired` booking:

```bash
curl -X POST http://localhost:3001/api/payments/retry-checkout-session \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"booking_id":"BOOKING_ID"}'
```

An unexpired lock receives a fresh Checkout Session. An expired booking is
re-locked for ten minutes only when all original consecutive court slots are
still available; otherwise the API returns HTTP `409`. Any previous open
Checkout Session is expired before its replacement is created so stale payment
links cannot remain payable. Apply the
`202606150001_allow_booking_relock.sql` migration before using this endpoint.

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

Cancel a confirmed booking:

```bash
curl -X POST http://localhost:3001/api/bookings/BOOKING_ID/cancel \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Unable to attend"}'
```

Customers can cancel only their own bookings. Administrators using an admin
access token can cancel any confirmed booking through the same endpoint.

Cancellation is accepted only when the reservation starts at least 24 hours
from the current time. Requests inside the 24-hour window return HTTP `409`;
the booking, refund state, and occupied slots remain unchanged.

For an eligible customer request, the server creates a cancellation request
and customer-safe timeline events, then changes the booking status to
`cancellation_requested`. Confirmed hourly slot rows remain attached and
reserved. No Stripe refund, refund record, final cancellation, or slot release
occurs until a future administrator approval workflow explicitly performs
those actions.

Local test bookings cancelled before this status fix may already be marked
`cancelled` with their slot rows removed. This release does not automatically
repair that legacy test data.

Courtify-Badminton refunds are tracked manually. The cancellation management
workflow does not call Stripe refund APIs and does not trust client-supplied
amounts. Apply `202606180001_create_cancellation_request_events.sql` before
using the cancellation timeline. `GET /api/bookings/me` returns each
customer's own cancellation request summary, chronological public timeline,
and completed refund method, reference, and date. Internal refund notes are
admin-only.

List legacy manual cancellation requests as an administrator:

```bash
curl http://localhost:3001/api/admin/cancellation-requests \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"
```

Get one cancellation request with booking, customer, court, slot, and timeline
details:

```bash
curl http://localhost:3001/api/admin/cancellation-requests/REQUEST_ID \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"
```

Record an administrator workflow action:

```bash
curl -X POST http://localhost:3001/api/admin/cancellation-requests/REQUEST_ID/events \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"admin_verifying_cancellation"}'
```

Supported actions are `admin_verifying_cancellation`, `customer_contacted`,
`cancellation_approved`, `cancellation_rejected`, `refund_in_progress`,
`refund_completed`, and `close_case`. Approval changes the booking to
`cancelled` and releases its slots. Rejection restores the booking to
`confirmed` and preserves its slots.

Start manual refund processing:

```bash
curl -X POST http://localhost:3001/api/admin/cancellation-requests/REQUEST_ID/events \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"refund_in_progress"}'
```

Complete a manual refund:

```bash
curl -X POST http://localhost:3001/api/admin/cancellation-requests/REQUEST_ID/events \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"refund_completed","refund_method":"BIBD Transfer","refund_reference":"TRX-20260618-001","refund_notes":"Refund transferred to customer account."}'
```

Close the completed case with `{"action":"close_case"}`. No Stripe refund API
is called by any cancellation management action.

Apply `202606180002_add_cancellation_approved_status.sql` and then
`202606180003_update_cancellation_review_constraint.sql` after the timeline
migration. Apply `202606180004_add_manual_refund_statuses.sql` and
`202606180005_add_manual_refund_fields.sql` before using manual refund
tracking.

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

## Executive Dashboard Summary

Get the administrator KPI summary:

```bash
curl http://localhost:3001/api/admin/dashboard/summary \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"
```

The endpoint returns booking, revenue, operations, and active-court totals.
Today and month boundaries use `Asia/Brunei`. Booking-period counts use
`bookings.created_at`. Revenue includes database-authoritative booking totals
for `confirmed` and `cancellation_requested` bookings and excludes cancelled,
expired, and unpaid locked bookings. Upcoming bookings are future confirmed
or cancellation-requested reservations. Pending cancellations include
`pending_admin_review`, `admin_verifying`, and `customer_contacted`; refunds in
progress include only `refund_in_progress`.

Get the live administrator operations dashboard:

```bash
curl http://localhost:3001/api/admin/dashboard/operations \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"
```

The operations endpoint uses `Asia/Brunei` for today's date and schedule
boundaries. Live occupancy, today's bookings, and the next 10 upcoming
bookings include active paid states: `confirmed` and
`cancellation_requested`. Active courts are marked `occupied` when a booking
contains the current instant, `upcoming_today` when the next active booking is
later today, and `available` otherwise. Pending cancellations include
`pending_admin_review`, `admin_verifying`, and `customer_contacted`. Manual
refund workload includes only `refund_in_progress`.

Get administrator analytics:

```bash
curl http://localhost:3001/api/admin/dashboard/analytics \
  -H "Authorization: Bearer ADMIN_ACCESS_TOKEN"
```

The 30-day revenue and booking series use booking creation dates in
`Asia/Brunei` and include `confirmed`, `cancellation_requested`, and
`cancelled` records. Revenue additionally requires a stored Stripe
PaymentIntent ID as the paid signal; locked and expired bookings are excluded.
Revenue is gross paid booking value, so paid cancelled bookings remain in the
historical revenue series. Day-of-week, popular-court, and peak-hour analytics
use reservation timing. Peak hours expand multi-hour reservations into their
individual occupied hours. Top-customer results expose only user ID, display
name, booking count, and aggregate revenue; phone numbers and emails are never
returned.

## Transactional Email

Apply `202606190001_add_email_delivery_metadata.sql` before enabling email
delivery. The initial `local` provider writes a development email preview to
the backend log. Provider access is isolated behind an email provider
interface so SMTP or Resend can be added later without changing booking or
cancellation workflows.

Transactional emails are sent for booking confirmation, cancellation request
receipt, cancellation approval, manual refund completion, and case closure.
Each template includes responsive Courtify HTML and a plain-text fallback.

`notification_events` stores idempotent delivery history using one key per
booking and email type. Dispatch happens only after the related database
transaction commits. Provider or history-write failures are logged
server-side and never roll back booking confirmation, cancellation, refund, or
case-closure operations.

The administrator cancellation detail response exposes only email type,
delivery status, attempt timestamp, and sent timestamp. Email bodies and
provider errors are not included in the delivery-history response.

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
   verify the booking becomes `cancellation_requested`, the request and
   timeline are created, no refund record is created, and confirmed slot rows
   remain reserved.
6. Attempt to cancel a confirmed booking less than 24 hours away and verify
   HTTP `409`, no refund, no cancellation request, and no slot release.
7. Replay a processed Stripe event ID and verify HTTP `200` without duplicate
   booking, slot, payment event, or refund changes.
8. Send a signed `checkout.session.completed` fixture with an unpaid status,
   non-BND currency, or mismatched amount and verify the booking stays locked.
9. Retry Checkout and verify the previous open Session becomes expired before
   the new Session URL is returned.
10. Verify `GET /health` returns HTTP `200`; verify `GET /health/db` returns
    HTTP `200` with an online database and HTTP `503` when it is unavailable.

Expired locks are ignored by availability even before cleanup. Cleanup runs
once at startup and periodically thereafter, deleting only slots belonging to
elapsed `locked` bookings and preserving their parent rows as `expired`.
