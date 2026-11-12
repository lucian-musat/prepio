begin;
select plan(41);

-- Fixtures. d1 is the inviter, d3 an admin (with a code row forced in), e1..e9 invitees.
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'att-inviter@test.local', 'authenticated', 'authenticated', '{"full_name":"Ana Pop"}'),
  ('00000000-0000-0000-0000-0000000000d3', 'att-admin@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-0000000000e1', 'att-i1@test.local', 'authenticated', 'authenticated', '{"full_name":"Ion Ionescu"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'att-i2@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-0000000000e3', 'att-i3@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-0000000000e4', 'att-i4@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-0000000000e5', 'att-i5@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-0000000000e6', 'att-i6@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-0000000000e7', 'att-i7@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-0000000000e8', 'att-i8@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-0000000000e9', 'att-i9@test.local', 'authenticated', 'authenticated', '{}');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000d3');
-- An inviter must be strictly older than the invitee; all fixtures above share now().
update profiles set created_at = now() - interval '1 hour' where id = '00000000-0000-0000-0000-0000000000d1';
update referral_codes set code = 'ADMNCDEF' where user_id = '00000000-0000-0000-0000-0000000000d3';
update referral_settings set enabled = true where id = 1;
create temp table t_code as select code from referral_codes where user_id = '00000000-0000-0000-0000-0000000000d1';
grant select on t_code to anon, authenticated;

insert into nodes (id, parent_id, title) values ('00000000-0000-0000-0000-0000000000f1', null, 'Root');
insert into lessons (id, node_id, title, status) values
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f1', 'L', 'published');
insert into consolidation_exercises (id, lesson_id, type, prompt) values
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2', 'facts', 'x');

-- e4: onboarding complete. e5: has an order. e6: lesson activity. e7: consolidation activity. e8: old profile.
update profiles set terms_version = '2026-11-10', age_confirmed_at = now(), learning_mode = 'guided',
  display_name = 'Complet' where id = '00000000-0000-0000-0000-0000000000e4';
insert into access_orders (user_id, price_bani, bonus_credits, duration_months, status)
  values ('00000000-0000-0000-0000-0000000000e5', 100, 0, 1, 'failed');
insert into lesson_progress (user_id, lesson_id) values
  ('00000000-0000-0000-0000-0000000000e6', '00000000-0000-0000-0000-0000000000f2');
insert into consolidation_runs (user_id, lesson_id, exercise_ids) values
  ('00000000-0000-0000-0000-0000000000e7', '00000000-0000-0000-0000-0000000000f2',
   array['00000000-0000-0000-0000-0000000000f3']::uuid[]);
update profiles set created_at = now() - interval '25 hours' where id = '00000000-0000-0000-0000-0000000000e8';

-- ---------------------------------------------------------------- anon: settings and lookup
set local role anon;
select results_eq($$ select enabled, threshold, credits_per_invitee, duration_months, max_rewarded
                       from referral_public_settings() $$,
  $$ values (true, 5, 40, 3, 100) $$, 'anon reads the public settings');
select results_eq($$ select valid, inviter_first_name from referral_lookup((select code from t_code)) $$,
  $$ values (true, 'Ana'::text) $$, 'anon lookup: a valid code returns the inviter first name');
select results_eq($$ select valid, inviter_first_name from referral_lookup(lower((select code from t_code))) $$,
  $$ values (true, 'Ana'::text) $$, 'lookup normalizes lowercase');
select results_eq($$ select valid, inviter_first_name from referral_lookup('ZZZZZZZZ') $$,
  $$ values (false, null::text) $$, 'lookup: an unknown code is invalid with no name');
select results_eq($$ select valid, inviter_first_name from referral_lookup('ADMNCDEF') $$,
  $$ values (false, null::text) $$, 'lookup: an admin code is invalid');
select results_eq($$ select valid, inviter_first_name from referral_lookup(null) $$,
  $$ values (false, null::text) $$, 'lookup: null is invalid');
select throws_ok($$ select referral_attach('ABCDEFGH') $$, '42501', null, 'anon cannot attach');
reset role;

-- The lookup reveals only valid and a first name.
select is((select proargnames::text from pg_proc where proname = 'referral_lookup' and pronamespace = 'public'::regnamespace),
  '{p_code,valid,inviter_first_name}', 'lookup has one input and returns only valid and inviter_first_name');

-- ---------------------------------------------------------------- attach
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';
select is(referral_attach((select code from t_code)), 'attached', 'a new account attaches with a valid code');
select is(referral_attach((select code from t_code)), 'not_allowed', 'a second call is not_allowed');
reset role;
select results_eq($$ select inviter_id, state, invitee_first_name from referrals
  where invitee_id = '00000000-0000-0000-0000-0000000000e1' $$,
  $$ values ('00000000-0000-0000-0000-0000000000d1'::uuid, 'registered'::text, 'Ion'::text) $$,
  'the referral row is registered with the first-name snapshot');
select is((select count(*)::int from referrals where invitee_id = '00000000-0000-0000-0000-0000000000e1'), 1,
  'the second call changed nothing');
select is((select count(*)::int from student_events where user_id = '00000000-0000-0000-0000-0000000000e1'
            and kind = 'referral_joined' and details ->> 'inviter_first_name' = 'Ana'), 1,
  'referral_joined is logged once for the invitee');

-- Normalization: lowercase, spaces and dashes.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}';
select is(referral_attach((select lower(substr(code, 1, 2) || '-' || substr(code, 3, 2) || ' ' || substr(code, 5)) from t_code)),
  'attached', 'lowercase input with a dash and a space attaches');
reset role;
select is((select invitee_first_name from referrals where invitee_id = '00000000-0000-0000-0000-0000000000e2'), 'Coleg',
  'a missing name falls back to Coleg');

-- Self, invalid.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select is(referral_attach((select code from t_code)), 'self', 'own code returns self');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}';
select is(referral_attach('ZZZZZZZZ'), 'invalid', 'an unknown code is invalid');
select is(referral_attach(null), 'invalid', 'a null code is invalid');
select is(referral_attach('  - '), 'invalid', 'a code empty after normalization is invalid');
select is(referral_attach('ADMNCDEF'), 'invalid', 'an admin code is invalid');

-- Not new accounts.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e4","role":"authenticated"}';
select is(referral_attach((select code from t_code)), 'not_allowed', 'completed onboarding is not_allowed');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e5","role":"authenticated"}';
select is(referral_attach((select code from t_code)), 'not_allowed', 'an account with an order is not_allowed');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e6","role":"authenticated"}';
select is(referral_attach((select code from t_code)), 'not_allowed', 'lesson activity is not_allowed');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e7","role":"authenticated"}';
select is(referral_attach((select code from t_code)), 'not_allowed', 'consolidation activity is not_allowed');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e8","role":"authenticated"}';
select is(referral_attach((select code from t_code)), 'not_allowed', 'an account older than 24 hours is not_allowed');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}';
select is(referral_attach((select code from t_code)), 'not_allowed', 'an admin cannot be invited');
reset role;
select is((select count(*)::int from referrals where invitee_id in
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000e5',
   '00000000-0000-0000-0000-0000000000e6', '00000000-0000-0000-0000-0000000000e7', '00000000-0000-0000-0000-0000000000e8',
   '00000000-0000-0000-0000-0000000000d3')), 0, 'rejected attaches create no rows');

-- Onboarding half done (name set from Google, terms not accepted) still counts as new.
update profiles set display_name = 'Doar Nume' where id = '00000000-0000-0000-0000-0000000000e9';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e9","role":"authenticated"}';
select is(referral_attach((select code from t_code)), 'attached', 'a half-done onboarding still attaches');
reset role;
select is((select invitee_first_name from referrals where invitee_id = '00000000-0000-0000-0000-0000000000e9'), 'Doar',
  'the snapshot is the first word of the name');

-- Disabled flag (e3 is still unattached and eligible).
update referral_settings set enabled = false where id = 1;
set local role anon;
select results_eq($$ select valid, inviter_first_name from referral_lookup((select code from t_code)) $$,
  $$ values (false, null::text) $$, 'disabled: lookup is invalid');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}';
select is(referral_attach((select code from t_code)), 'disabled', 'disabled: attach returns disabled');
select is(referral_attach('ZZZZZZZZ'), 'disabled', 'disabled takes precedence over invalid');
reset role;
select is((select count(*)::int from referrals where invitee_id = '00000000-0000-0000-0000-0000000000e3'), 0,
  'disabled: no row created');
set local role anon;
select results_eq($$ select enabled from referral_public_settings() $$, $$ values (false) $$,
  'the public settings show the flag off');
reset role;

-- Re-enabled: e3 can attach now (proves it was only the flag).
update referral_settings set enabled = true where id = 1;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}';
select is(referral_attach((select code from t_code)), 'attached', 're-enabled: the same account attaches');
reset role;

-- ---------------------------------------------------------------- acyclic: the inviter must be older
-- g1 (older), g2 (younger), g3 (same age as g2). All new accounts.
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'att-g1@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'att-g2@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'att-g3@test.local', 'authenticated', 'authenticated', '{}');
update profiles set created_at = now() - interval '2 hours' where id = '00000000-0000-0000-0000-0000000000a1';
update profiles set created_at = now() - interval '1 hour'
 where id in ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3');
create temp table t_codes as select user_id, code from referral_codes
 where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');
grant select on t_codes to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is(referral_attach((select code from t_codes where user_id = '00000000-0000-0000-0000-0000000000a2')), 'not_allowed',
  'a younger inviter is not_allowed');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select is(referral_attach((select code from t_codes where user_id = '00000000-0000-0000-0000-0000000000a1')), 'attached',
  'an older inviter attaches');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is(referral_attach((select code from t_codes where user_id = '00000000-0000-0000-0000-0000000000a2')), 'not_allowed',
  'the mutual attach (back to the younger invitee) is not_allowed');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select is(referral_attach((select code from t_codes where user_id = '00000000-0000-0000-0000-0000000000a2')), 'not_allowed',
  'an inviter of exactly the same age is not_allowed');
reset role;
select is((select count(*)::int from referrals where invitee_id in
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a3')), 0,
  'no row for the rejected attaches, so no cycle');
select is((select count(*)::int from referrals r join profiles i on i.id = r.inviter_id join profiles e on e.id = r.invitee_id
            where i.created_at >= e.created_at), 0, 'every referral points from an older inviter to a younger invitee');

select * from finish();
rollback;
