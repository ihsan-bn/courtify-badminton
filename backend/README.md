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
