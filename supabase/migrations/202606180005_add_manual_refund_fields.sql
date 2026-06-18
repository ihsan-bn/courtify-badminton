alter table public.cancellation_requests
  add column refund_method text,
  add column refund_reference text,
  add column refund_notes text,
  add column refunded_at timestamptz,
  add column refunded_by uuid references public.users (id) on delete restrict;

update public.cancellation_requests as cancellation_request
set refund_method = 'Other',
    refund_reference = coalesce(
      (
        select refund_record.stripe_refund_id
        from public.refund_records as refund_record
        where refund_record.booking_id = cancellation_request.booking_id
      ),
      'LEGACY-' || upper(left(cancellation_request.id::text, 8))
    ),
    refund_notes =
      'Legacy refund completion imported before manual refund tracking.',
    refunded_at = coalesce(
      cancellation_request.reviewed_at,
      cancellation_request.created_at
    ),
    refunded_by = cancellation_request.reviewed_by
where cancellation_request.status = 'refund_completed';

alter table public.cancellation_requests
  drop constraint cancellation_requests_review_state_check;

alter table public.cancellation_requests
  add constraint cancellation_requests_review_state_check
  check (
    (
      status = 'pending_admin_review'
      and reviewed_at is null
      and reviewed_by is null
    )
    or (
      status in (
        'admin_verifying',
        'customer_contacted',
        'approved',
        'refund_in_progress',
        'refund_completed',
        'closed',
        'rejected'
      )
      and reviewed_at is not null
      and reviewed_by is not null
      and reviewed_at >= created_at
    )
  );

alter table public.cancellation_requests
  add constraint cancellation_requests_refund_method_check
  check (
    refund_method is null
    or refund_method in (
      'BIBD Transfer',
      'Baiduri Transfer',
      'Cash',
      'Bank Transfer',
      'Other'
    )
  ),
  add constraint cancellation_requests_refund_reference_check
  check (
    refund_reference is null
    or length(btrim(refund_reference)) between 1 and 200
  ),
  add constraint cancellation_requests_refund_notes_check
  check (
    refund_notes is null
    or length(btrim(refund_notes)) between 1 and 2000
  ),
  add constraint cancellation_requests_refund_state_check
  check (
    (
      status in ('refund_completed', 'closed')
      and refund_method is not null
      and refund_reference is not null
      and refund_notes is not null
      and refunded_at is not null
      and refunded_by is not null
      and refunded_at >= created_at
    )
    or (
      status not in ('refund_completed', 'closed')
      and refund_method is null
      and refund_reference is null
      and refund_notes is null
      and refunded_at is null
      and refunded_by is null
    )
  );

create index cancellation_requests_refund_status_idx
  on public.cancellation_requests (status, refunded_at desc)
  where status in ('refund_in_progress', 'refund_completed', 'closed');
