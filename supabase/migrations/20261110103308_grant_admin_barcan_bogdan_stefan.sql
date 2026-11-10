-- Owner decision (2026-11-10): barcanbogdanstefan@gmail.com is an admin. The owner creates the account (with its
-- password) in the Supabase dashboard before this migration is pushed.
-- No-op where the user does not exist (e.g. a fresh local database).
insert into public.admins (user_id)
select id from auth.users where lower(email) = 'barcanbogdanstefan@gmail.com'
on conflict do nothing;
