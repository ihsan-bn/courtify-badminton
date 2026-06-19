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

## Authentication Session

The JWT access token is stored in browser `localStorage` so the authenticated
session survives the external Stripe Checkout redirect and return navigation.
Existing tokens previously stored in `sessionStorage` are migrated
automatically on first access. Logout clears the token from both storage
locations and redirects to `/login`. Tokens are never placed in URLs.

The public `/login` page clearly separates:

- First Time User: links to `/register`, where the customer verifies a Brunei
  phone OTP and then sets full name, email, and password.
- Existing Member: email and password login followed by a mandatory OTP sent
  by the selected channel, email or SMS.

The password exists only in the login form's in-memory state and is cleared
after the OTP challenge is created. It is never stored by the frontend.

Authenticated pages share a global Courtify-Badminton header. It displays
initials, the user's name or contact fallback, email or phone identity, and an
explicit administrator/customer badge. The account menu includes Update
Profile, Change Password, and Logout. Logout clears browser storage and
redirects to `/login`. The profile chip is not displayed on public auth pages.
Customer and administrator guards validate the JWT against `GET /api/me`;
missing, expired, or invalid sessions are cleared and redirected to `/login`.

Forgot password is available from the existing member login form. It always
shows the generic success message from the backend. `/reset-password?token=...`
lets the user set a new password and then redirects back to login without
auto-login.

## Available Routes

- `/` landing page
- `/login` existing member/admin email and password plus OTP login
- `/register` first-time customer phone OTP and account setup
- `/forgot-password` generic password reset request
- `/reset-password` reset-token password update
- `/onboarding` legacy first-time customer name and email setup
- `/profile` authenticated self-service profile update
- `/change-password` authenticated password change
- `/dashboard` authenticated customer profile and placeholder action cards
- `/admin/dashboard` administrator console with sidebar navigation and
  dashboard anchor sections
- `/book` authenticated court availability and temporary booking lock flow
- `/bookings` authenticated customer booking history
- `/bookings/[bookingId]` authenticated customer booking detail view
- `/bookings/success` Stripe payment success landing page
- `/bookings/cancelled` Stripe payment cancellation landing page
- `/admin/cancellations` administrator cancellation request queue
- `/admin/cancellations/[id]` administrator cancellation review and actions
- `/admin/analytics` administrator booking and revenue analytics

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
Each card links to `/bookings/[bookingId]`, which loads the same customer-only
booking history response and displays the matching booking details without
calling admin endpoints. In v0.6C, confirmed bookings that start at least 24
hours from the current time show a customer cancellation action. The frontend
shows the Courtify cancellation policy, then requires a second confirmation
with the exact case-sensitive phrase `CANCEL BOOKING` before calling
`POST /api/bookings/:bookingId/cancel`. After cancellation, the details page
shows the booking as `cancellation_requested`, displays the pending admin
review status and chronological customer-safe timeline, and hides the cancel
button. Slots remain reserved until administrator approval. The backend
remains the authority for ownership, booking status, refund eligibility, and
the 24-hour rule.

Local test bookings cancelled before this status fix may already show as
`cancelled` with removed slot rows. The frontend does not attempt to repair
that legacy data automatically.

## Administrator Cancellation Management

Administrator pages verify the authenticated profile through `GET /api/me`.
The queue lists cancellation cases and the detail page displays booking,
customer, court, slot, timeline, and manual refund information. Administrators
can record verification and customer-contact progress, approve or reject a
cancellation, mark a refund in progress, complete it with method, reference,
and internal notes, then close the case. Customers see refund date, method,
and reference but never see internal admin notes. Stripe automated refunds are
not used.

The cancellation detail page also displays transactional email delivery
history for the booking, including email type, delivery status, and sent or
attempted timestamp. Advanced delivery tracking and email content previews are
not exposed in the frontend.

## PDF Documents

Customer booking details provide authenticated downloads for booking,
cancellation, and completed refund receipts when the underlying data is
available. The administrator cancellation detail page provides a complete
case-summary download. PDFs are generated by the backend from authoritative
database records and returned directly; the frontend never assembles receipt
content or payment amounts.

## Administrator Reports

The admin-only `/admin/reports` page provides independent date selectors and
authenticated CSV downloads for revenue, bookings, cancellations, manual
refunds, and court utilization. Each report defaults to the current Brunei
calendar month and limits exports to 366 inclusive days. Files are generated
by the backend from authoritative database records; the frontend only sends
the selected date range and downloads the returned CSV blob.

## Administrator Audit Logs

The admin-only `/admin/audit-logs` page displays paginated customer,
administrator, and system accountability events. Administrators can filter by
action, actor user ID, entity type, entity ID, and Brunei-local date range,
reset all filters, and expand sanitized metadata for troubleshooting. The page
does not expose authentication tokens, Stripe secrets, OTP values, passwords,
or raw authorization headers.

## Executive KPI Dashboard

Administrator accounts use `/dashboard` as an executive summary. It calls
`/admin/dashboard` as an executive summary. It calls
`GET /api/admin/dashboard/summary` and displays responsive KPI cards for
bookings, active paid booking revenue, upcoming reservations, cancellation
review workload, manual refunds in progress, and active courts. Admin login
and direct visits to `/dashboard` route administrators to `/admin/dashboard`.

The same page calls `GET /api/admin/dashboard/operations` for live active-court
occupancy, today's active paid bookings, the next 10 upcoming bookings,
pending cancellation reviews, and manual refunds in progress. Cancellation
and refund rows link to their administrator case detail page. Booking rows show
their database booking reference until a dedicated admin booking-detail route
is introduced.

All `/admin` pages share a reusable admin layout with a left sidebar on
desktop and a collapsible admin menu on smaller screens. Sidebar items either
navigate to existing admin modules or jump to dashboard anchor sections for
operations, live occupancy, today's bookings, upcoming bookings, refunds, and
court capacity. The global profile menu remains in the top header and logout is
not duplicated inside the sidebar.

The `/admin/analytics` page calls `GET /api/admin/dashboard/analytics` and uses
CSS-only bars, responsive tables, and stat lists for 30-day revenue and booking
trends, weekday performance, popular courts, peak hours, top customers,
cancellation workflow totals, and manual refund totals. No customer phone or
email data is displayed.

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

This frontend intentionally does not include notification delivery, calendar
invites, exports, or deployment configuration.
