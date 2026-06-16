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
- `/bookings/success` Stripe payment success landing page
- `/bookings/cancelled` Stripe payment cancellation landing page

## Booking Flow

The `/book` page loads active courts from `GET /api/courts`, loads hourly
availability from `GET /api/availability`, enforces one court plus consecutive
available slots on the client, and creates a ten-minute lock with
`POST /api/bookings/lock`.

The server remains the source of truth for availability, pricing, and conflict
prevention.

## Stripe Checkout Flow

After a temporary booking lock is created, `/book` calls
`POST /api/payments/checkout-session` with the locked booking ID. The frontend
does not calculate payment amounts and does not handle Stripe secrets. It uses
the Checkout URL returned by the backend and redirects the browser to Stripe.

Successful payments return to `/bookings/success`. Cancelled payments return to
`/bookings/cancelled`, where customers are reminded that temporary locks can
expire after 10 minutes.

## Validation

```powershell
npm run build
npm run lint
```

This frontend intentionally does not include admin pages, booking history,
cancellation UI, notifications, or calendar invites yet.
