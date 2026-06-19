begin;

alter table public.users
  add column if not exists password_hash text,
  add column if not exists password_set_at timestamptz,
  add column if not exists password_updated_at timestamptz;

alter table public.users
  add constraint users_password_hash_check
    check (
      password_hash is null
      or (
        length(password_hash) between 50 and 100
        and password_hash ~ '^\$2[aby]\$'
      )
    ),
  add constraint users_password_timestamps_check
    check (
      (
        password_hash is null
        and password_set_at is null
        and password_updated_at is null
      )
      or (
        password_hash is not null
        and password_set_at is not null
        and password_updated_at is not null
        and password_updated_at >= password_set_at
      )
    );

comment on column public.users.password_hash is
  'Nullable bcrypt password hash. Never expose through API projections.';
comment on column public.users.password_set_at is
  'Timestamp when the current account first received password credentials.';
comment on column public.users.password_updated_at is
  'Timestamp of the most recent password hash update.';

commit;
