# Courtify-Badminton

Database foundation for the Courtify-Badminton booking platform in Brunei.

## Database structure

```text
supabase/
|-- migrations/
|   `-- 202606120001_create_courtify_database.sql
`-- seed.sql
```

The migration creates the PostgreSQL schema, enum types, constraints, indexes,
updated timestamp triggers, row-level security defaults, and the deterministic
`get_slot_price_bnd` pricing function. The seed creates four active courts and
one fully onboarded administrator.

All reservation timestamps use `timestamptz`. Operating-hour checks interpret
them in `Asia/Brunei` and permit hourly starts from 08:00 through 21:00, with
the facility closing at 22:00.

## Run with the Supabase CLI

Install the Supabase CLI and authenticate:

```powershell
supabase init
supabase login
supabase link
supabase db push --include-seed
```

For a local Supabase environment, reset the database to apply all migrations
and the seed:

```powershell
supabase start
supabase db reset
```

## Run in the Supabase dashboard

1. Open the project's SQL Editor.
2. Run `supabase/migrations/202606120001_create_courtify_database.sql`.
3. Run `supabase/seed.sql`.

Row-level security is enabled on every application table without public client
policies. This is deny-by-default until authentication and authorization
policies are added with the backend integration.

The strict `booking_slots(court_id, slot_date, start_hour)` unique constraint
prevents double booking. A future cancellation or expired-lock transaction
must delete the affected slot rows while preserving the parent booking as the
audit record, which immediately makes those hours available again.

## Backend

The Phase 2 Express and TypeScript API is located in `backend/`. See
`backend/README.md` for environment setup, commands, security requirements,
and request examples.
