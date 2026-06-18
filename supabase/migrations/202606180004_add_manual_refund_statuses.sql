alter type public.cancellation_request_status
  add value if not exists 'admin_verifying';

alter type public.cancellation_request_status
  add value if not exists 'customer_contacted';

alter type public.cancellation_request_status
  add value if not exists 'refund_in_progress';

alter type public.cancellation_request_status
  add value if not exists 'closed';
