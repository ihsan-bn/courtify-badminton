begin;

create extension if not exists pgcrypto with schema extensions;

create type public.user_role as enum (
  'customer',
  'admin'
);

create type public.booking_status as enum (
  'locked',
  'confirmed',
  'cancellation_requested',
  'cancelled',
  'expired'
);

create type public.booking_slot_status as enum (
  'locked',
  'confirmed',
  'cancellation_requested',
  'cancelled'
);

create type public.cancellation_request_status as enum (
  'pending_admin_review',
  'refund_completed',
  'rejected'
);

create type public.notification_channel as enum (
  'email',
  'whatsapp',
  'sms',
  'telegram'
);

create type public.notification_status as enum (
  'pending',
  'sent',
  'failed'
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  name text,
  email text,
  role public.user_role not null default 'customer',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_phone_number_key unique (phone_number),
  constraint users_phone_number_e164_check
    check (phone_number ~ '^\+[1-9][0-9]{7,14}$'),
  constraint users_name_check
    check (name is null or length(btrim(name)) between 1 and 150),
  constraint users_email_check
    check (
      email is null
      or (
        email = lower(btrim(email))
        and length(email) <= 254
        and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
    ),
  constraint users_onboarding_profile_check
    check (
      onboarding_completed = false
      or (name is not null and email is not null)
    )
);

create unique index users_email_unique_idx
  on public.users (lower(email))
  where email is not null;

create table public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  otp_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint otp_codes_phone_number_e164_check
    check (phone_number ~ '^\+[1-9][0-9]{7,14}$'),
  constraint otp_codes_otp_hash_check
    check (length(btrim(otp_hash)) >= 32),
  constraint otp_codes_attempts_check
    check (attempts between 0 and 3),
  constraint otp_codes_expiry_check
    check (
      expires_at > created_at
      and expires_at <= created_at + interval '5 minutes'
    ),
  constraint otp_codes_consumed_at_check
    check (consumed_at is null or consumed_at >= created_at)
);

create index otp_codes_phone_lookup_idx
  on public.otp_codes (phone_number, created_at desc);

create index otp_codes_active_lookup_idx
  on public.otp_codes (phone_number, expires_at desc)
  where consumed_at is null and attempts < 3;

create table public.courts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courts_name_key unique (name),
  constraint courts_name_check
    check (length(btrim(name)) between 1 and 100),
  constraint courts_location_check
    check (length(btrim(location)) between 1 and 255)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete restrict,
  court_id uuid not null references public.courts (id) on delete restrict,
  status public.booking_status not null default 'locked',
  total_amount_bnd numeric(10, 2) not null,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  lock_expires_at timestamptz,
  reservation_start_at timestamptz not null,
  reservation_end_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_id_court_id_key unique (id, court_id),
  constraint bookings_id_user_id_key unique (id, user_id),
  constraint bookings_stripe_checkout_session_id_key
    unique (stripe_checkout_session_id),
  constraint bookings_total_amount_bnd_check
    check (total_amount_bnd > 0),
  constraint bookings_stripe_checkout_session_id_check
    check (
      stripe_checkout_session_id is null
      or length(btrim(stripe_checkout_session_id)) > 0
    ),
  constraint bookings_stripe_payment_intent_id_check
    check (
      stripe_payment_intent_id is null
      or length(btrim(stripe_payment_intent_id)) > 0
    ),
  constraint bookings_reservation_order_check
    check (reservation_end_at > reservation_start_at),
  constraint bookings_reservation_hour_boundaries_check
    check (
      date_trunc('hour', reservation_start_at at time zone 'Asia/Brunei')
        = reservation_start_at at time zone 'Asia/Brunei'
      and date_trunc('hour', reservation_end_at at time zone 'Asia/Brunei')
        = reservation_end_at at time zone 'Asia/Brunei'
    ),
  constraint bookings_reservation_same_day_check
    check (
      (reservation_start_at at time zone 'Asia/Brunei')::date
        = (reservation_end_at at time zone 'Asia/Brunei')::date
    ),
  constraint bookings_operating_hours_check
    check (
      extract(hour from reservation_start_at at time zone 'Asia/Brunei')
        between 8 and 21
      and extract(hour from reservation_end_at at time zone 'Asia/Brunei')
        between 9 and 22
    ),
  constraint bookings_whole_hour_duration_check
    check (
      extract(epoch from (reservation_end_at - reservation_start_at)) / 3600
        between 1 and 14
      and mod(
        extract(epoch from (reservation_end_at - reservation_start_at))::numeric,
        3600
      ) = 0
    ),
  constraint bookings_lock_state_check
    check (
      (
        status = 'locked'
        and lock_expires_at is not null
        and lock_expires_at > created_at
        and lock_expires_at <= created_at + interval '10 minutes'
      )
      or (
        status <> 'locked'
        and lock_expires_at is null
      )
    )
);

create index bookings_user_history_idx
  on public.bookings (user_id, created_at desc);

create index bookings_court_reservation_idx
  on public.bookings (court_id, reservation_start_at, reservation_end_at);

create index bookings_status_idx
  on public.bookings (status, reservation_start_at);

create index bookings_expiring_locks_idx
  on public.bookings (lock_expires_at)
  where status = 'locked';

create index bookings_stripe_payment_intent_idx
  on public.bookings (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create table public.booking_slots (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  court_id uuid not null references public.courts (id) on delete restrict,
  slot_date date not null,
  start_hour integer not null,
  status public.booking_slot_status not null default 'locked',
  created_at timestamptz not null default now(),
  constraint booking_slots_booking_court_fkey
    foreign key (booking_id, court_id)
    references public.bookings (id, court_id)
    on delete cascade,
  constraint booking_slots_court_date_hour_key
    unique (court_id, slot_date, start_hour),
  constraint booking_slots_start_hour_check
    check (start_hour between 8 and 21)
);

create index booking_slots_booking_idx
  on public.booking_slots (booking_id);

create index booking_slots_availability_idx
  on public.booking_slots (slot_date, court_id, status, start_hour);

create table public.cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null,
  user_id uuid not null references public.users (id) on delete restrict,
  reason text,
  status public.cancellation_request_status not null
    default 'pending_admin_review',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users (id) on delete restrict,
  constraint cancellation_requests_booking_user_fkey
    foreign key (booking_id, user_id)
    references public.bookings (id, user_id)
    on delete restrict,
  constraint cancellation_requests_reason_check
    check (reason is null or length(btrim(reason)) between 1 and 1000),
  constraint cancellation_requests_review_state_check
    check (
      (
        status = 'pending_admin_review'
        and reviewed_at is null
        and reviewed_by is null
      )
      or (
        status in ('refund_completed', 'rejected')
        and reviewed_at is not null
        and reviewed_by is not null
        and reviewed_at >= created_at
      )
    )
);

create unique index cancellation_requests_pending_booking_idx
  on public.cancellation_requests (booking_id)
  where status = 'pending_admin_review';

create index cancellation_requests_user_idx
  on public.cancellation_requests (user_id, created_at desc);

create index cancellation_requests_admin_queue_idx
  on public.cancellation_requests (status, created_at);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete set null,
  stripe_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  verified_signature boolean not null default false,
  created_at timestamptz not null default now(),
  constraint payment_events_stripe_event_id_key unique (stripe_event_id),
  constraint payment_events_stripe_event_id_check
    check (length(btrim(stripe_event_id)) > 0),
  constraint payment_events_event_type_check
    check (length(btrim(event_type)) > 0),
  constraint payment_events_payload_check
    check (jsonb_typeof(payload) = 'object')
);

create index payment_events_booking_idx
  on public.payment_events (booking_id, created_at desc);

create index payment_events_webhook_processing_idx
  on public.payment_events (verified_signature, created_at);

create index payment_events_event_type_idx
  on public.payment_events (event_type, created_at desc);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  event_type text not null,
  channel public.notification_channel not null,
  status public.notification_status not null default 'pending',
  payload jsonb not null,
  error_message text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint notification_events_event_type_check
    check (length(btrim(event_type)) > 0),
  constraint notification_events_payload_check
    check (jsonb_typeof(payload) = 'object'),
  constraint notification_events_error_message_check
    check (
      error_message is null
      or length(btrim(error_message)) between 1 and 2000
    ),
  constraint notification_events_processing_state_check
    check (
      (
        status = 'pending'
        and processed_at is null
        and error_message is null
      )
      or (
        status = 'sent'
        and processed_at is not null
        and error_message is null
      )
      or (
        status = 'failed'
        and processed_at is not null
        and error_message is not null
      )
    )
);

create index notification_events_processing_queue_idx
  on public.notification_events (status, created_at)
  where status in ('pending', 'failed');

create index notification_events_booking_idx
  on public.notification_events (booking_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

create trigger courts_set_updated_at
before update on public.courts
for each row
execute function public.set_updated_at();

create trigger bookings_set_updated_at
before update on public.bookings
for each row
execute function public.set_updated_at();

create or replace function public.validate_cancellation_request()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  booking_record public.bookings%rowtype;
begin
  select *
  into booking_record
  from public.bookings
  where id = new.booking_id
  for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'booking does not exist';
  end if;

  if booking_record.status <> 'confirmed' then
    raise exception using
      errcode = '23514',
      message = 'only confirmed bookings can be cancelled';
  end if;

  if booking_record.reservation_start_at < now() + interval '24 hours' then
    raise exception using
      errcode = '23514',
      message = 'cancellation requires at least 24 hours notice';
  end if;

  return new;
end;
$$;

create trigger cancellation_requests_validate
before insert on public.cancellation_requests
for each row
execute function public.validate_cancellation_request();

create or replace function public.validate_cancellation_reviewer()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.reviewed_by is not null and not exists (
    select 1
    from public.users
    where id = new.reviewed_by
      and role = 'admin'
  ) then
    raise exception using
      errcode = '23514',
      message = 'cancellation reviewer must be an admin';
  end if;

  return new;
end;
$$;

create trigger cancellation_requests_validate_reviewer
before insert or update on public.cancellation_requests
for each row
execute function public.validate_cancellation_reviewer();

create or replace function public.get_slot_price_bnd(
  requested_slot_date date,
  requested_start_hour integer
)
returns numeric(10, 2)
language plpgsql
immutable
strict
set search_path = pg_catalog
as $$
declare
  day_of_week integer;
begin
  if requested_start_hour < 8 or requested_start_hour > 21 then
    raise exception using
      errcode = '22023',
      message = 'start hour must be between 8 and 21';
  end if;

  day_of_week := extract(isodow from requested_slot_date);

  if day_of_week between 1 and 5 then
    return 10.00;
  end if;

  if requested_start_hour < 18 then
    return 11.00;
  end if;

  return 12.00;
end;
$$;

comment on function public.get_slot_price_bnd(date, integer) is
  'Returns the Courtify-Badminton hourly price in BND for one valid slot.';

comment on table public.booking_slots is
  'One row represents one occupied one-hour court slot. Delete rows atomically when a cancellation or expired lock releases availability.';

alter table public.users enable row level security;
alter table public.otp_codes enable row level security;
alter table public.courts enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_slots enable row level security;
alter table public.cancellation_requests enable row level security;
alter table public.payment_events enable row level security;
alter table public.notification_events enable row level security;

comment on schema public is
  'Courtify-Badminton database. RLS is enabled with no client policies; access is denied by default until authenticated API policies are designed.';

commit;
