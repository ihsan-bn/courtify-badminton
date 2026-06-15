alter table public.bookings
  drop constraint bookings_lock_state_check;

alter table public.bookings
  add constraint bookings_lock_state_check
  check (
    (
      status = 'locked'
      and lock_expires_at is not null
      and lock_expires_at > updated_at
      and lock_expires_at <= updated_at + interval '10 minutes'
    )
    or (
      status <> 'locked'
      and lock_expires_at is null
    )
  );
