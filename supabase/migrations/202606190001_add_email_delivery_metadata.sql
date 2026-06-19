alter table public.notification_events
  add column recipient_email text,
  add column subject text,
  add column provider_message_id text,
  add column idempotency_key text;

alter table public.notification_events
  add constraint notification_events_recipient_email_check
  check (
    recipient_email is null
    or (
      recipient_email = lower(btrim(recipient_email))
      and length(recipient_email) <= 254
      and recipient_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  ),
  add constraint notification_events_subject_check
  check (
    subject is null
    or length(btrim(subject)) between 1 and 255
  ),
  add constraint notification_events_provider_message_id_check
  check (
    provider_message_id is null
    or length(btrim(provider_message_id)) between 1 and 255
  ),
  add constraint notification_events_idempotency_key_check
  check (
    idempotency_key is null
    or length(btrim(idempotency_key)) between 1 and 255
  );

create unique index notification_events_idempotency_key_idx
  on public.notification_events (idempotency_key)
  where idempotency_key is not null;

create index notification_events_email_history_idx
  on public.notification_events (booking_id, channel, created_at desc);
