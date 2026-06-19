begin;

insert into public.courts (id, name, location, active)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'Court 1',
    'Courtify-Badminton, Brunei Darussalam',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'Court 2',
    'Courtify-Badminton, Brunei Darussalam',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'Court 3',
    'Courtify-Badminton, Brunei Darussalam',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'Court 4',
    'Courtify-Badminton, Brunei Darussalam',
    true
  )
on conflict (id) do update
set
  name = excluded.name,
  location = excluded.location,
  active = excluded.active;

insert into public.users (
  id,
  phone_number,
  name,
  email,
  role,
  onboarding_completed,
  password_hash,
  password_set_at,
  password_updated_at
)
values (
  '20000000-0000-4000-8000-000000000001',
  '+6732220000',
  'Courtify Administrator',
  'admin@courtify-badminton.com',
  'admin',
  true,
  '$2b$12$TEeBRv.4g9ozojqm090JyO0kzKaBQdFh5s/GCNeEhDpCNck.mV.HK',
  now(),
  now()
)
on conflict (id) do update
set
  phone_number = excluded.phone_number,
  name = excluded.name,
  email = excluded.email,
  role = excluded.role,
  onboarding_completed = excluded.onboarding_completed,
  password_hash = excluded.password_hash,
  password_set_at = coalesce(public.users.password_set_at, excluded.password_set_at),
  password_updated_at = excluded.password_updated_at;

commit;
