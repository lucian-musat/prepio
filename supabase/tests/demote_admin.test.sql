begin;
select plan(10);

-- Fixtures: 91 is an admin to be turned into a student, 92 is the admin that stays (the replacement), 93 is a
-- student. Assertions are scoped to these ids so the suite also passes on a seeded DB.
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000091', 'dm-old-admin@test.local', 'authenticated', 'authenticated', '{}', '{}'),
  ('00000000-0000-0000-0000-000000000092', 'dm-new-admin@test.local', 'authenticated', 'authenticated', '{}', '{}'),
  ('00000000-0000-0000-0000-000000000093', 'dm-student@test.local', 'authenticated', 'authenticated', '{}', '{}');
-- The signup trigger created profiles and codes for all three. Admins got no code from the old backfill: drop the
-- code of the old admin to model an account that was an admin before referrals existed.
insert into public.admins (user_id) values
  ('00000000-0000-0000-0000-000000000091'), ('00000000-0000-0000-0000-000000000092');
delete from public.referral_codes where user_id = '00000000-0000-0000-0000-000000000091';

-- The function is private: no client role can run it.
select ok(not has_function_privilege('authenticated', 'private.demote_admin_to_student(text, text)', 'execute')
          and not has_function_privilege('service_role', 'private.demote_admin_to_student(text, text)', 'execute'),
  'no client role can execute demote_admin_to_student');

-- Guards: the replacement must be an existing admin, the account must exist.
select is(private.demote_admin_to_student('dm-old-admin@test.local', 'dm-student@test.local'), 'replacement_not_admin',
  'refuses when the replacement is not an admin');
select is(private.demote_admin_to_student('dm-old-admin@test.local', 'dm-nobody@test.local'), 'replacement_not_admin',
  'refuses when the replacement does not exist');
select ok(exists (select 1 from public.admins where user_id = '00000000-0000-0000-0000-000000000091'),
  'the old admin is still an admin after the refusals');
select is(private.demote_admin_to_student('dm-nobody@test.local', 'dm-new-admin@test.local'), 'user_not_found',
  'an unknown e-mail changes nothing');
select is(private.demote_admin_to_student('dm-old-admin@test.local', 'dm-old-admin@test.local'), 'replacement_not_admin',
  'an account cannot be its own replacement');

-- The demotion itself (case-insensitive e-mail).
select is(private.demote_admin_to_student('DM-Old-Admin@test.local', 'dm-new-admin@test.local'), 'demoted',
  'demotes the old admin');
select results_eq($$ select
    exists (select 1 from public.admins where user_id = '00000000-0000-0000-0000-000000000091'),
    exists (select 1 from public.admins where user_id = '00000000-0000-0000-0000-000000000092'),
    (select code ~ '^[A-HJKMNP-Z2-9]{8}$' from public.referral_codes where user_id = '00000000-0000-0000-0000-000000000091') $$,
  $$ values (false, true, true) $$,
  'the old admin is a student with a referral code; the replacement is still an admin');

-- As a student the old admin now sees a code in the referral summary.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000091","role":"authenticated"}';
select ok((select code is not null from my_referral_summary()), 'the demoted account gets a code from my_referral_summary');
reset role;

-- Idempotent.
select is(private.demote_admin_to_student('dm-old-admin@test.local', 'dm-new-admin@test.local'), 'not_admin',
  'running it again changes nothing');

select * from finish();
rollback;
