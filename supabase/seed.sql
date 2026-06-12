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
  onboarding_completed
)
values (
  '20000000-0000-4000-8000-000000000001',
  '+6732220000',
  'Courtify Administrator',
  'admin@courtify-badminton.com',
  'admin',
  true
)
on conflict (id) do update
set
  phone_number = excluded.phone_number,
  name = excluded.name,
  email = excluded.email,
  role = excluded.role,
  onboarding_completed = excluded.onboarding_completed;

commit;
