begin;

create table public.cancellation_request_events (
  id uuid primary key default gen_random_uuid(),
  cancellation_request_id uuid not null
    references public.cancellation_requests (id) on delete cascade,
  booking_id uuid not null
    references public.bookings (id) on delete cascade,
  event_type text not null,
  message text not null,
  actor_type text not null,
  actor_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint cancellation_request_events_event_type_check
    check (length(btrim(event_type)) between 1 and 100),
  constraint cancellation_request_events_message_check
    check (length(btrim(message)) between 1 and 1000),
  constraint cancellation_request_events_actor_type_check
    check (actor_type in ('customer', 'admin', 'system')),
  constraint cancellation_request_events_actor_user_check
    check (
      (actor_type = 'system' and actor_user_id is null)
      or (actor_type in ('customer', 'admin') and actor_user_id is not null)
    )
);

create index cancellation_request_events_request_idx
  on public.cancellation_request_events (
    cancellation_request_id,
    created_at,
    id
  );

create index cancellation_request_events_booking_idx
  on public.cancellation_request_events (booking_id, created_at, id);

alter table public.cancellation_request_events enable row level security;

comment on table public.cancellation_request_events is
  'Customer-safe cancellation workflow events. Internal admin notes must not be stored in this table.';

commit;
