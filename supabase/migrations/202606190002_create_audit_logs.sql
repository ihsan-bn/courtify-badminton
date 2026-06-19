begin;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users (id) on delete set null,
  actor_role text not null,
  actor_name text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint audit_logs_actor_role_check
    check (actor_role in ('customer', 'admin', 'system')),
  constraint audit_logs_action_check
    check (length(btrim(action)) between 1 and 100),
  constraint audit_logs_entity_type_check
    check (length(btrim(entity_type)) between 1 and 100),
  constraint audit_logs_summary_check
    check (length(btrim(summary)) between 1 and 1000),
  constraint audit_logs_actor_name_check
    check (actor_name is null or length(btrim(actor_name)) between 1 and 200),
  constraint audit_logs_ip_address_check
    check (ip_address is null or length(ip_address) <= 200),
  constraint audit_logs_user_agent_check
    check (user_agent is null or length(user_agent) <= 1000),
  constraint audit_logs_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create index audit_logs_created_at_idx
  on public.audit_logs (created_at desc, id desc);

create index audit_logs_action_idx
  on public.audit_logs (action, created_at desc);

create index audit_logs_actor_idx
  on public.audit_logs (actor_user_id, created_at desc)
  where actor_user_id is not null;

create index audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id, created_at desc);

alter table public.audit_logs enable row level security;

comment on table public.audit_logs is
  'Administrative, customer, and system accountability events. Application access is restricted to authenticated administrators.';

commit;
