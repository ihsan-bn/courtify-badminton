# Courtify-Badminton

Courtify-Badminton is a badminton court booking platform for Brunei venue
operators. It includes customer self-service booking, Stripe Checkout,
cancellation and manual refund workflows, admin operations dashboards,
transactional email, audit/reporting surfaces, PDF receipts, and account
security flows.

## Current Version

v0.9A.1 - Auth and Account Management Redesign

## Main Capabilities

- First-time customer registration with Brunei phone OTP, account setup, and
  automatic customer login.
- Existing customer/admin login with email, password, OTP delivery choice, and
  JWT sessions.
- Authenticated profile menu with initials/avatar, name, email, phone, role
  badge, update profile, change password, and logout.
- Forgot/reset password using short-lived one-time reset links.
- Customer court availability, booking locks, Stripe Checkout, booking
  history, cancellation requests, and PDF receipts.
- Administrator dashboards, cancellation management, manual refund tracking,
  reports, audit logs, and case-summary PDF downloads.

## Technology Stack

- Frontend: Next.js 15, React, TypeScript
- Backend: Node.js, Express 5, TypeScript
- Database: PostgreSQL/Supabase
- Payments: Stripe Checkout and Stripe webhooks
- Auth: bcrypt password hashes, OTP challenges, JWT access tokens
- Email: local development provider behind a provider interface

## Project Structure

```text
courtify-badminton/
|-- backend/
|   |-- src/
|   |-- package.json
|   `-- tsconfig.json
|-- frontend/
|   |-- app/
|   |-- components/
|   |-- lib/
|   `-- package.json
|-- supabase/
|   |-- migrations/
|   |   |-- 202606120001_create_courtify_database.sql
|   |   |-- 202606150001_allow_booking_relock.sql
|   |   |-- 202606150002_create_refund_records.sql
|   |   |-- 202606180001_create_cancellation_request_events.sql
|   |   |-- 202606180002_add_cancellation_approved_status.sql
|   |   |-- 202606180003_update_cancellation_review_constraint.sql
|   |   |-- 202606180004_add_manual_refund_statuses.sql
|   |   |-- 202606180005_add_manual_refund_fields.sql
|   |   |-- 202606190001_add_email_delivery_metadata.sql
|   |   |-- 202606190002_create_audit_logs.sql
|   |   |-- 202606190003_add_user_password_credentials.sql
|   |   `-- 202606260001_create_password_reset_tokens.sql
|   `-- seed.sql
|-- README.md
|-- FEstart.bat
`-- BEstart.bat
```

## Local Development

Backend:

```powershell
cd backend
npm install
npm run dev
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Default local URLs:

```text
Backend:  http://localhost:4000
Frontend: http://localhost:3000
```

Stripe webhook forwarding is still required for local payment testing:

```bash
stripe listen --forward-to localhost:4000/api/payments/webhook
```

## Local Auth Test Account

The seeded local administrator is for development only:

```text
Email: admin@courtify-badminton.com
Password: CourtifyAdmin123!
Phone: +6732220000
```

Do not reuse this password or run development seed credentials in production.

## Validation

```powershell
cd backend
npm run build
npm run lint

cd ../frontend
npm run build
npm run lint
```

## License

Private project. All rights reserved.
