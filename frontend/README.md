# Courtify-Badminton Frontend

Customer-facing Next.js App Router frontend for Courtify-Badminton.

## Setup

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

The frontend expects the backend API at:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

Stripe redirect URLs configured in the backend should point to:

```text
STRIPE_SUCCESS_URL=http://localhost:3000/bookings/success
STRIPE_CANCEL_URL=http://localhost:3000/bookings/cancelled
```

## Available Routes

- `/` landing page
- `/login` phone number and OTP login
- `/onboarding` first-time customer name and email setup
- `/dashboard` authenticated customer profile and placeholder action cards
- `/book` authenticated court availability and temporary booking lock flow
- `/bookings` authenticated customer booking history
- `/bookings/success` Stripe payment success landing page
- `/bookings/cancelled` Stripe payment cancellation landing page

## Booking Flow

The `/book` page loads active courts from `GET /api/courts`, loads hourly
availability from `GET /api/availability`, enforces one court plus consecutive
available slots on the client, and creates a ten-minute lock with
`POST /api/bookings/lock`.

The server remains the source of truth for availability, pricing, and conflict
prevention. Duration options are capped by the court closing time and by the
first unavailable slot after the selected start hour.

## My Bookings

The `/bookings` page calls `GET /api/bookings/me` and groups customer bookings
by status: confirmed, locked, expired, cancellation requested, and cancelled.
It is read-only in v0.6A; cancellation actions are intentionally not included.

## Stripe Checkout Flow

After a temporary booking lock is created, `/book` calls
`POST /api/payments/checkout-session` with the locked booking ID. The frontend
does not calculate payment amounts and does not handle Stripe secrets. It uses
the Checkout URL returned by the backend and redirects the browser to Stripe.

Successful payments return to `/bookings/success`, where customers are told the
payment webhook is finalizing confirmation. Cancelled payments return to
`/bookings/cancelled`, where customers are reminded that temporary locks can
expire after 10 minutes.

## Validation

```powershell
npm run build
npm run lint
```

This frontend intentionally does not include admin pages, cancellation UI,
notifications, or calendar invites yet.
