-- Optional seed after creating an admin auth user.
-- Replace the UUID below with the auth.users id of your admin account.
-- Then run this file in Supabase SQL Editor.

-- update public.profiles set role='admin' where id='YOUR-ADMIN-USER-UUID';

insert into public.subjects(code,name) values
('ENG','English'),('NEP','Nepali'),('MAT','Mathematics'),('SCI','Science'),('SOC','Social Studies'),('COM','Computer Science')
on conflict(code) do nothing;
