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

## Validation

```powershell
npm run build
npm run lint
```

Phase 5A intentionally does not include court availability, booking locks,
Stripe checkout UI, admin pages, or notifications.
