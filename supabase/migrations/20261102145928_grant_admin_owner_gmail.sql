-- Owner decision (2026-11-02): lucian.m91@gmail.com is an admin alongside lucian@musat.dev.
-- No-op where the user does not exist (e.g. a fresh local database).
insert into public.admins (user_id)
select id from auth.users where email = 'lucian.m91@gmail.com'
on conflict do nothing;
