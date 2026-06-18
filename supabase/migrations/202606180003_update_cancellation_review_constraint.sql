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
      status in ('approved', 'refund_completed', 'rejected')
      and reviewed_at is not null
      and reviewed_by is not null
      and reviewed_at >= created_at
    )
  );
