begin;
select plan(35);

-- Existing profiles (before any fixture): every non-admin one got a code from the migration backfill.
select is((select count(*)::int from profiles p
            where not exists (select 1 from admins a where a.user_id = p.id)
              and not exists (select 1 from referral_codes c where c.user_id = p.id)),
          0, 'every pre-existing non-admin profile has a referral code');

-- Fixtures: r1 and r2 are students, r3 is an admin, r4 is an invitee who never paid, r5 an invitee who paid.
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'ref-student1@test.local', 'authenticated', 'authenticated', '{"full_name":"Ana Pop"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'ref-student2@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-0000000000c3', 'ref-admin@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-0000000000c4', 'ref-invitee4@test.local', 'authenticated', 'authenticated', '{"full_name":"Ion Ionescu Jr"}'),
  ('00000000-0000-0000-0000-0000000000c5', 'ref-invitee5@test.local', 'authenticated', 'authenticated', '{"full_name":"Maria Dan"}');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000c3');

-- ---------------------------------------------------------------- schema
select has_table('public', 'referral_settings', 'referral_settings exists');
select has_table('public', 'referral_codes', 'referral_codes exists');
select has_table('public', 'referrals', 'referrals exists');
select is((select relrowsecurity from pg_class where oid = 'public.referral_codes'::regclass)
      and (select relrowsecurity from pg_class where oid = 'public.referrals'::regclass)
      and (select relrowsecurity from pg_class where oid = 'public.referral_settings'::regclass),
  true, 'all three tables have RLS enabled');

-- ---------------------------------------------------------------- codes
select is((select count(*)::int from referral_codes
            where user_id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2',
                              '00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000c5')
              and code ~ '^[A-HJKMNP-Z2-9]{8}$'),
  4, 'every new profile gets a code in the 8-char alphabet');
select is((select count(*)::int from (select distinct code from referral_codes) d), (select count(*)::int from referral_codes),
  'codes are unique');
select matches(private.new_referral_code(), '^[A-HJKMNP-Z2-9]{8}$', 'new_referral_code returns a valid code');
select isnt(private.new_referral_code(), private.new_referral_code(), 'new_referral_code is random');

-- The backfill skips admins and fills in missing student codes.
delete from referral_codes where user_id in ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3');
select lives_ok($$ select private.backfill_referral_codes() $$, 'the backfill runs again safely');
select is((select count(*)::int from referral_codes where user_id = '00000000-0000-0000-0000-0000000000c2'), 1,
  'backfill gives an existing student a code');
select is((select count(*)::int from referral_codes where user_id = '00000000-0000-0000-0000-0000000000c3'), 0,
  'backfill skips an admin');

-- ---------------------------------------------------------------- settings
select results_eq($$ select enabled, threshold, credits_per_invitee, max_rewarded from referral_settings where id = 1 $$,
  $$ values (false, 5, 40, 100) $$, 'defaults: disabled, 5 invitees, 40 credits, cap 100');
select throws_ok($$ insert into referral_settings (id) values (2) $$, '23514', null, 'referral_settings is a singleton');

-- ---------------------------------------------------------------- referrals data (as postgres)
insert into referrals (inviter_id, invitee_id, invitee_first_name, state) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c4', 'Ion', 'registered');
insert into referrals (inviter_id, invitee_id, invitee_first_name, state, first_paid_at) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c5', 'Maria', 'pending', now());
select throws_ok($$ insert into referrals (inviter_id, invitee_id, invitee_first_name, state)
  values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c4', 'Ion', 'registered') $$,
  '23505', null, 'an invitee can be attached once');
select throws_ok($$ insert into referrals (inviter_id, invitee_id, invitee_first_name, state)
  values ('00000000-0000-0000-0000-0000000000c2', null, 'X', 'bogus') $$,
  '23514', null, 'state is constrained');

-- ---------------------------------------------------------------- RLS
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select results_eq($$ select user_id from referral_codes $$,
  $$ values ('00000000-0000-0000-0000-0000000000c1'::uuid) $$, 'a student reads only their own code');
select is((select count(*)::int from referrals), 2, 'the inviter reads their referrals');
select is((select count(*)::int from referral_settings), 0, 'a student cannot read the settings directly');
select throws_ok($$ insert into referral_codes (user_id, code) values ('00000000-0000-0000-0000-0000000000c1', 'AAAAAAAA') $$,
  '42501', null, 'a student cannot insert a code');
select throws_ok($$ update referral_codes set code = 'AAAAAAAA' $$, '42501', null, 'a student cannot update a code');
select throws_ok($$ delete from referral_codes $$, '42501', null, 'a student cannot delete a code');
select throws_ok($$ insert into referrals (inviter_id, invitee_first_name, state)
  values ('00000000-0000-0000-0000-0000000000c1', 'X', 'registered') $$, '42501', null, 'a student cannot insert a referral');
select throws_ok($$ update referrals set state = 'converted_credits' $$, '42501', null, 'a student cannot update a referral');
select throws_ok($$ delete from referrals $$, '42501', null, 'a student cannot delete a referral');
select throws_ok($$ select public.admin_save_referral_settings(true, 5, 40, 100) $$, '42501', null,
  'a student cannot save the settings');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';
select is((select count(*)::int from referrals), 0, 'another student sees none of those referrals');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
select cmp_ok((select count(*)::int from referral_codes), '>=', 3, 'an admin reads every code');
select is((select count(*)::int from referrals where inviter_id = '00000000-0000-0000-0000-0000000000c1'), 2,
  'an admin reads every referral');
select throws_ok($$ select public.admin_save_referral_settings(true, 0, 40, 100) $$, '23514', null,
  'threshold 0 is rejected');
select lives_ok($$ select public.admin_save_referral_settings(true, 3, 0, 50) $$, 'an admin saves the settings');
select results_eq($$ select enabled, threshold, credits_per_invitee, max_rewarded from referral_settings $$,
  $$ values (true, 3, 0, 50) $$, 'the settings are saved');
reset role;

-- ---------------------------------------------------------------- deleting accounts
delete from auth.users where id = '00000000-0000-0000-0000-0000000000c4';
select is((select count(*)::int from referrals where inviter_id = '00000000-0000-0000-0000-0000000000c1' and invitee_first_name = 'Ion'),
  0, 'deleting an unpaid invitee removes the referral');
delete from auth.users where id = '00000000-0000-0000-0000-0000000000c5';
select results_eq($$ select invitee_id, invitee_first_name from referrals where inviter_id = '00000000-0000-0000-0000-0000000000c1' $$,
  $$ values (null::uuid, 'Maria'::text) $$, 'deleting a paid invitee keeps the row with a null invitee and the name');
delete from auth.users where id = '00000000-0000-0000-0000-0000000000c1';
select is((select count(*)::int from referrals where inviter_id = '00000000-0000-0000-0000-0000000000c1'), 0,
  'deleting an inviter cascades their referrals');

select * from finish();
rollback;
