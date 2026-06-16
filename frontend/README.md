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

## Available Routes

- `/` landing page
- `/login` phone number and OTP login
- `/onboarding` first-time customer name and email setup
- `/dashboard` authenticated customer profile and placeholder action cards
- `/book` authenticated court availability and temporary booking lock flow

## Booking Flow

The `/book` page loads active courts from `GET /api/courts`, loads hourly
availability from `GET /api/availability`, enforces one court plus consecutive
available slots on the client, and creates a ten-minute lock with
`POST /api/bookings/lock`.

The server remains the source of truth for availability, pricing, and conflict
prevention. Stripe checkout is intentionally not wired in Phase 5B; the
payment button is disabled with a Phase 5C notice.

## Validation

```powershell
npm run build
npm run lint
```

Phase 5A intentionally does not include court availability, booking locks,
Stripe checkout UI, admin pages, or notifications.
