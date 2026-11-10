-- Owner decision (2026-11-10): madalinanghel17@gmail.com (Madalin Anghel) is an admin.
-- No-op where the user does not exist (e.g. a fresh local database).
insert into public.admins (user_id)
select id from auth.users where email = 'madalinanghel17@gmail.com'
on conflict do nothing;
