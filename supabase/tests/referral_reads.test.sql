begin;
select plan(28);

update access_settings set price_bani = 15000, bonus_credits = 100, duration_months = 3 where id = 1;
update referral_settings set enabled = true, threshold = 2, credits_per_invitee = 40, max_rewarded = 100 where id = 1;

-- a1, a2 inviters, b1..b4 invitees (b4 invited by a2), a3 a student nobody invited, ad an admin.
insert into auth.users (id, email, aud, role, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000000' || x)::uuid, 'rd-' || x || '@test.local', 'authenticated', 'authenticated', '{}'
  from unnest(array['a1','a2','a3','b1','b2','b3','b4','ad']) x;
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000ad');
create function pg_temp.uid(p text) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-0000000000' || p)::uuid;
$$;
create function pg_temp.buy(p_user text) returns void language sql as $$
  select null from public.purchase_access(pg_temp.uid(p_user), 15000, 100, 3);
$$;
grant execute on function pg_temp.uid(text) to anon, authenticated;

insert into referrals (inviter_id, invitee_id, created_at) values
  (pg_temp.uid('a1'), pg_temp.uid('b1'), now() - interval '3 minutes'),
  (pg_temp.uid('a1'), pg_temp.uid('b2'), now() - interval '2 minutes'),
  (pg_temp.uid('a1'), pg_temp.uid('b3'), now() - interval '1 minutes'),
  (pg_temp.uid('a2'), pg_temp.uid('b4'), now());
update profiles set display_name = 'Maria Ionescu' where id = pg_temp.uid('b1');

-- ---------------------------------------------------------------- summary, trial student
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select results_eq($$ select code, enabled, threshold, credits_per_invitee, duration_months, has_access,
                            pending_count, invitee_count, credits_earned, free_periods_earned
                       from my_referral_summary() $$,
  $$ select (select code from referral_codes where user_id = '00000000-0000-0000-0000-0000000000a1'),
            true, 2, 40, 3, false, 0, 3, 0, 0 $$,
  'summary for a trial student: code, settings, no access, three registered invitees');
select results_eq($$ select first_name, email, state, reward_credits, account_deleted, first_paid_at is null
                       from my_referrals() order by created_at $$,
  $$ values ('Maria'::text, 'rd-b1@test.local'::text, 'registered'::text, null::int, false, true),
            ('Coleg', 'rd-b2@test.local', 'registered', null, false, true),
            ('Coleg', 'rd-b3@test.local', 'registered', null, false, true) $$,
  'my_referrals lists own invitees with live first name and email');
select results_eq($$ select email from my_referrals() $$,
  $$ values ('rd-b3@test.local'::text), ('rd-b2@test.local'), ('rd-b1@test.local') $$,
  'my_referrals is newest first');

-- ---------------------------------------------------------------- after payments
reset role;
select pg_temp.buy('b1');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select results_eq($$ select has_access, pending_count, invitee_count, credits_earned, free_periods_earned from my_referral_summary() $$,
  $$ values (false, 1, 3, 0, 0) $$, 'one paying invitee below the threshold: pending');
reset role;
select pg_temp.buy('b2');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select results_eq($$ select has_access, pending_count, invitee_count, credits_earned, free_periods_earned from my_referral_summary() $$,
  $$ values (true, 0, 3, 0, 1) $$, 'threshold reached: access granted, one free period, nothing pending');
select is((select state from my_referrals() where first_name = 'Maria'), 'consumed_access', 'rewarded rows show consumed_access');
reset role;
select pg_temp.buy('b3');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select results_eq($$ select has_access, pending_count, free_periods_earned from my_referral_summary() $$,
  $$ values (true, 0, 1) $$, 'active student: the next paying invitee is converted to credits, not pending');
select results_eq($$ select credits_earned, pending_count from my_referral_summary() $$, $$ values (40, 0) $$,
  'credits_earned sums converted rows');
select is((select reward_credits from my_referrals() where email = 'rd-b3@test.local'), 40, 'reward_credits shown for converted rows');
select is((select reward_credits from my_referrals() where email = 'rd-b1@test.local'), null, 'reward_credits null otherwise');

-- ---------------------------------------------------------------- own rows only
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select results_eq($$ select email from my_referrals() $$, $$ values ('rd-b4@test.local'::text) $$,
  'another student sees only their own list');
select is((select invitee_count from my_referral_summary()), 1, 'another student summary counts only their own');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select is((select count(*)::int from my_referrals()), 0, 'a student with no invitees sees nothing');
select results_eq($$ select invitee_count, pending_count, credits_earned, free_periods_earned, has_access from my_referral_summary() $$,
  $$ values (0, 0, 0, 0, false) $$, 'zero summary for a student with no invitees');
reset role;
set local role anon;
select throws_ok($$ select * from my_referrals() $$, '42501', null, 'anon cannot call my_referrals');
select throws_ok($$ select * from my_referral_summary() $$, '42501', null, 'anon cannot call my_referral_summary');
reset role;

-- admin sees no code and nothing breaks (an admin added after signup may still hold a code row; drop it)
delete from referral_codes where user_id = pg_temp.uid('ad');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}';
select results_eq($$ select code, invitee_count, has_access from my_referral_summary() $$, $$ values (null::text, 0, false) $$,
  'an admin has no code and an empty summary');

-- ---------------------------------------------------------------- admin functions
select is((select count(*)::int from admin_referrals(pg_temp.uid('a1'))), 3, 'admin reads any student referrals');
select results_eq($$ select first_name, email from admin_referrals(pg_temp.uid('a2')) $$,
  $$ values ('Coleg'::text, 'rd-b4@test.local'::text) $$, 'admin_referrals has the same columns');
select results_eq($$ select code, inviter_id, inviter_name from admin_referral_context(pg_temp.uid('b1')) $$,
  $$ select (select code from referral_codes where user_id = '00000000-0000-0000-0000-0000000000a1'),
            '00000000-0000-0000-0000-0000000000a1'::uuid, 'Coleg' $$,
  'admin_referral_context names the inviter of an invited student');
select is((select count(*)::int from admin_referral_context(pg_temp.uid('a3'))), 0, 'no inviter: no context row');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select throws_ok($$ select * from admin_referrals(pg_temp.uid('a1')) $$, '42501', null, 'students cannot call admin_referrals');
select throws_ok($$ select * from admin_referral_context(pg_temp.uid('b1')) $$, '42501', null, 'students cannot call admin_referral_context');
reset role;
set local role anon;
select throws_ok($$ select * from admin_referrals('00000000-0000-0000-0000-0000000000a1') $$, '42501', null, 'anon cannot call admin_referrals');
select throws_ok($$ select * from admin_referral_context('00000000-0000-0000-0000-0000000000b1') $$, '42501', null, 'anon cannot call admin_referral_context');
reset role;

-- ---------------------------------------------------------------- deleted invitee (paid row survives)
delete from auth.users where id = pg_temp.uid('b1');
delete from auth.users where id = pg_temp.uid('b2');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select results_eq($$ select first_name, email, account_deleted, state from my_referrals() where account_deleted order by first_name desc $$,
  $$ values ('Maria'::text, null::text, true, 'consumed_access'::text), ('Coleg', null, true, 'consumed_access') $$,
  'deleted paid invitees stay: snapshot name, no email, account_deleted');
select is((select free_periods_earned from my_referral_summary()), 1, 'the summary still counts the earned period');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}';
select results_eq($$ select email, account_deleted from admin_referrals(pg_temp.uid('a1')) where account_deleted $$,
  $$ values (null::text, true), (null, true) $$, 'admin view also hides the email of deleted accounts');

select * from finish();
rollback;
