begin;

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint password_reset_tokens_token_hash_check
    check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint password_reset_tokens_expiry_check
    check (
      expires_at > created_at
      and expires_at <= created_at + interval '30 minutes'
    ),
  constraint password_reset_tokens_used_at_check
    check (used_at is null or used_at >= created_at)
);

create unique index if not exists password_reset_tokens_token_hash_idx
  on public.password_reset_tokens (token_hash);

create index if not exists password_reset_tokens_user_idx
  on public.password_reset_tokens (user_id, created_at desc);

create index if not exists password_reset_tokens_active_idx
  on public.password_reset_tokens (expires_at)
  where used_at is null;

alter table public.password_reset_tokens enable row level security;

comment on table public.password_reset_tokens is
  'One-time hashed password reset tokens. Raw tokens are only sent through reset links and never stored.';

commit;
