create table public.refund_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  requested_by uuid not null references public.users (id) on delete restrict,
  stripe_payment_intent_id text not null,
  stripe_refund_id text,
  amount_bnd numeric(10, 2) not null,
  currency text not null default 'BND',
  status text not null default 'pending',
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint refund_records_booking_id_key unique (booking_id),
  constraint refund_records_stripe_refund_id_key unique (stripe_refund_id),
  constraint refund_records_amount_bnd_check check (amount_bnd > 0),
  constraint refund_records_currency_check check (currency = 'BND'),
  constraint refund_records_status_check check (
    status in (
      'pending',
      'requires_action',
      'succeeded',
      'failed',
      'cancelled'
    )
  ),
  constraint refund_records_payment_intent_check
    check (length(btrim(stripe_payment_intent_id)) > 0),
  constraint refund_records_refund_id_check
    check (
      stripe_refund_id is null
      or length(btrim(stripe_refund_id)) > 0
    )
);

create index refund_records_payment_intent_idx
  on public.refund_records (stripe_payment_intent_id);

create index refund_records_status_idx
  on public.refund_records (status, created_at);

create trigger refund_records_set_updated_at
before update on public.refund_records
for each row
execute function public.set_updated_at();

alter table public.refund_records enable row level security;
