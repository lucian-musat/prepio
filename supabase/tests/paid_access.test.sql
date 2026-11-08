begin;
select plan(81);

-- Fixtures (as postgres). f1, f2 and f4 are students, f3 is an admin. Assertions are scoped to these ids.
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'access-student1@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'access-student2@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-0000000000f3', 'access-admin@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-0000000000f4', 'access-student4@test.local', 'authenticated', 'authenticated', '{}');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000f3');

create function pg_temp.events(p_user uuid, p_kind text) returns setof public.student_events language sql as $$
  select * from public.student_events where user_id = p_user and kind = p_kind order by id
$$;

-- ---------------------------------------------------------------- schema and defaults
select results_eq($$ select price_bani, bonus_credits, duration_months from access_settings where id = 1 $$,
  $$ values (15000, 100, 3) $$, 'the offer starts at 150 lei, 100 credits, 3 months');
select throws_ok($$ insert into access_settings (id, price_bani, bonus_credits, duration_months) values (2, 1, 0, 1) $$,
  '23514', null, 'access_settings is a singleton');
select throws_ok($$ update access_settings set price_bani = 0 $$, '23514', null, 'price below 1 is rejected');
select throws_ok($$ update access_settings set bonus_credits = 10001 $$, '23514', null, 'bonus above 10000 is rejected');
select throws_ok($$ update access_settings set duration_months = 25 $$, '23514', null, 'duration above 24 is rejected');
select is((select access_until from profiles where id = '00000000-0000-0000-0000-0000000000f1'), null,
  'a new account is in the trial (no access_until)');
select is(private.extend_access('2027-01-31 12:00Z', 1, '2026-12-01 00:00Z'), '2027-02-28 12:00Z'::timestamptz,
  'extend_access: Jan 31 + 1 month = Feb 28');
select is(private.extend_access(null, 3, '2026-11-08 10:00Z'), '2027-02-08 10:00Z'::timestamptz,
  'extend_access: a trial account starts from now');
select is(private.extend_access('2026-10-01 00:00Z', 3, '2026-11-08 10:00Z'), '2027-02-08 10:00Z'::timestamptz,
  'extend_access: an expired account starts from now');
select is(private.extend_access('2026-12-01 00:00Z', 3, '2026-11-08 10:00Z'), '2027-03-01 00:00Z'::timestamptz,
  'extend_access: an active account extends from access_until');

-- ---------------------------------------------------------------- purchase on a trial account
update profiles set credit_balance = 0 where id = '00000000-0000-0000-0000-0000000000f1';
create temp table bought on commit drop as
  select * from public.purchase_access('00000000-0000-0000-0000-0000000000f1', 15000, 100, 3);
select is((select access_until from bought), now() + interval '3 months', 'purchase returns now + 3 months');
select is((select bonus from bought), 100, 'purchase returns the bonus');
select is((select balance from bought), 100, 'purchase returns the new balance');
select is((select access_until from profiles where id = '00000000-0000-0000-0000-0000000000f1'), now() + interval '3 months',
  'profiles.access_until is set');
select is((select credit_balance from profiles where id = '00000000-0000-0000-0000-0000000000f1'), 100, 'the bonus was added');
select results_eq(
  $$ select status, price_bani, bonus_credits, duration_months, provider, approved_at is not null
       from access_orders where id = (select order_id from bought) $$,
  $$ values ('approved'::text, 15000, 100, 3, 'none'::text, true) $$,
  'purchase creates an approved order with the offer snapshot');
select results_eq(
  $$ select delta, balance_after, kind from credit_ledger where access_order_id = (select order_id from bought) $$,
  $$ values (100, 100, 'access_bonus'::text) $$, 'the bonus is an access_bonus ledger row linked to the order');
select results_eq(
  $$ select kind, months, until_before, until_after, order_id, admin_id from access_ledger
      where user_id = '00000000-0000-0000-0000-0000000000f1' $$,
  $$ values ('purchase'::text, 3, null::timestamptz, now() + interval '3 months', (select order_id from bought), null::uuid) $$,
  'purchase writes an access_ledger purchase row');
select results_eq(
  $$ select details ->> 'months', details ->> 'price_bani', details ->> 'credits', details ->> 'until'
       from pg_temp.events('00000000-0000-0000-0000-0000000000f1', 'access_purchased') $$,
  $$ select '3'::text, '15000'::text, '100'::text, to_jsonb(now() + interval '3 months') #>> '{}' $$,
  'exactly one access_purchased event with months, until, price_bani and credits');
select is((select count(*)::int from pg_temp.events('00000000-0000-0000-0000-0000000000f1', 'purchase')), 0,
  'the bonus does not log a credits purchase event');

-- ---------------------------------------------------------------- renew
update profiles set access_until = now() + interval '14 days' where id = '00000000-0000-0000-0000-0000000000f1';
select public.purchase_access('00000000-0000-0000-0000-0000000000f1', 15000, 100, 3);
select is((select access_until from profiles where id = '00000000-0000-0000-0000-0000000000f1'),
  now() + interval '14 days' + interval '3 months', 'renewing while active extends from access_until');
select results_eq(
  $$ select until_before from access_ledger where user_id = '00000000-0000-0000-0000-0000000000f1' order by id desc limit 1 $$,
  $$ select now() + interval '14 days' $$, 'the ledger keeps until_before');

update profiles set access_until = now() - interval '1 day' where id = '00000000-0000-0000-0000-0000000000f1';
select public.purchase_access('00000000-0000-0000-0000-0000000000f1', 15000, 100, 3);
select is((select access_until from profiles where id = '00000000-0000-0000-0000-0000000000f1'),
  now() + interval '3 months', 'renewing after expiry starts from now');

-- ---------------------------------------------------------------- offer_changed
select throws_ok($$ select * from public.purchase_access('00000000-0000-0000-0000-0000000000f2', 14999, 100, 3) $$,
  'P0001', 'offer_changed', 'a different price is refused');
select throws_ok($$ select * from public.purchase_access('00000000-0000-0000-0000-0000000000f2', 15000, 99, 3) $$,
  'P0001', 'offer_changed', 'a different bonus is refused');
select throws_ok($$ select * from public.purchase_access('00000000-0000-0000-0000-0000000000f2', 15000, 100, 2) $$,
  'P0001', 'offer_changed', 'a different duration is refused');
select is((select count(*)::int from access_orders where user_id = '00000000-0000-0000-0000-0000000000f2'), 0,
  'refused purchases write no order');
select is((select access_until from profiles where id = '00000000-0000-0000-0000-0000000000f2'), null,
  'refused purchases do not change access');

-- ---------------------------------------------------------------- bonus 0
update access_settings set bonus_credits = 0;
select lives_ok($$ select * from public.purchase_access('00000000-0000-0000-0000-0000000000f2', 15000, 0, 3) $$,
  'a purchase with no bonus succeeds');
select is((select count(*)::int from credit_ledger where user_id = '00000000-0000-0000-0000-0000000000f2' and kind = 'access_bonus'), 0,
  'no bonus means no credit ledger row');
select is((select details ->> 'credits' from pg_temp.events('00000000-0000-0000-0000-0000000000f2', 'access_purchased')), '0',
  'the event records 0 credits');
update access_settings set bonus_credits = 100;

-- ---------------------------------------------------------------- admin settings
grant select on bought to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}';

select lives_ok($$ select public.admin_save_access_settings(20000, 50, 6) $$, 'admin saves the offer');
select results_eq($$ select price_bani, bonus_credits, duration_months from access_settings $$,
  $$ values (20000, 50, 6) $$, 'the offer changed');
select throws_ok($$ select public.admin_save_access_settings(0, 50, 6) $$, '23514', null, 'a bad offer is rejected');
select results_eq(
  $$ select price_bani, bonus_credits, duration_months from access_orders
      where id = (select order_id from bought) $$,
  $$ values (15000, 100, 3) $$, 'the old order keeps its snapshot');
select lives_ok($$ select public.admin_save_access_settings(15000, 100, 3) $$, 'admin restores the offer');

-- ---------------------------------------------------------------- grant
reset role;
update profiles set access_until = null, credit_balance = 5 where id = '00000000-0000-0000-0000-0000000000f4';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}';

select is(public.admin_grant_access('00000000-0000-0000-0000-0000000000f4', 2, ' Promo '), now() + interval '2 months',
  'grant extends a trial account from now');
select is(public.admin_grant_access('00000000-0000-0000-0000-0000000000f4', 1, 'More'),
  now() + interval '3 months', 'grant extends an active account from access_until');
select throws_ok($$ select public.admin_grant_access('00000000-0000-0000-0000-0000000000f4', 2, '  ') $$,
  'P0001', 'reason_required', 'grant needs a reason');
select throws_ok($$ select public.admin_grant_access('00000000-0000-0000-0000-0000000000f4', 0, 'x') $$,
  'P0001', 'bad_months', 'grant of 0 months is rejected');
select throws_ok($$ select public.admin_grant_access('00000000-0000-0000-0000-0000000000f4', 25, 'x') $$,
  'P0001', 'bad_months', 'grant of 25 months is rejected');
select throws_ok($$ select public.admin_grant_access('00000000-0000-0000-0000-0000000000f3', 2, 'x') $$,
  'P0001', 'cannot_target_admin', 'an admin cannot be granted access');
select throws_ok($$ select public.admin_grant_access(gen_random_uuid(), 2, 'x') $$,
  'P0001', 'student_not_found', 'an unknown student is refused');

reset role;
select is((select credit_balance from profiles where id = '00000000-0000-0000-0000-0000000000f4'), 5,
  'grant does not change credits');
select results_eq(
  $$ select kind, months, admin_id, reason from access_ledger where user_id = '00000000-0000-0000-0000-0000000000f4' order by id $$,
  $$ values ('admin_grant'::text, 2, '00000000-0000-0000-0000-0000000000f3'::uuid, 'Promo'::text),
            ('admin_grant'::text, 1, '00000000-0000-0000-0000-0000000000f3'::uuid, 'More'::text) $$,
  'grants are in the access ledger with the admin and trimmed reason');
select results_eq(
  $$ select admin_id, details ->> 'months', details ->> 'reason' from pg_temp.events('00000000-0000-0000-0000-0000000000f4', 'access_granted') $$,
  $$ values ('00000000-0000-0000-0000-0000000000f3'::uuid, '2'::text, 'Promo'::text),
            ('00000000-0000-0000-0000-0000000000f3'::uuid, '1'::text, 'More'::text) $$,
  'grants log access_granted events');

-- ---------------------------------------------------------------- revoke
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}';
select throws_ok($$ select public.admin_revoke_access('00000000-0000-0000-0000-0000000000f4', ' ') $$,
  'P0001', 'reason_required', 'revoke needs a reason');
select throws_ok($$ select public.admin_revoke_access('00000000-0000-0000-0000-0000000000f3', 'x') $$,
  'P0001', 'cannot_target_admin', 'an admin cannot be revoked');
select throws_ok($$ select public.admin_revoke_access(gen_random_uuid(), 'x') $$,
  'P0001', 'student_not_found', 'revoking an unknown student is refused');
select lives_ok($$ select public.admin_revoke_access('00000000-0000-0000-0000-0000000000f4', 'Refund') $$, 'admin revokes access');
reset role;
select is((select access_until from profiles where id = '00000000-0000-0000-0000-0000000000f4'), now(),
  'revoke sets access_until to now');
select is((select credit_balance from profiles where id = '00000000-0000-0000-0000-0000000000f4'), 5, 'revoke keeps the credits');
select results_eq(
  $$ select kind, until_after, admin_id, reason from access_ledger where user_id = '00000000-0000-0000-0000-0000000000f4' order by id desc limit 1 $$,
  $$ values ('admin_revoke'::text, now(), '00000000-0000-0000-0000-0000000000f3'::uuid, 'Refund'::text) $$,
  'revoke is in the access ledger');
select results_eq(
  $$ select admin_id, details ->> 'reason' from pg_temp.events('00000000-0000-0000-0000-0000000000f4', 'access_revoked') $$,
  $$ values ('00000000-0000-0000-0000-0000000000f3'::uuid, 'Refund'::text) $$, 'revoke logs access_revoked');

-- ---------------------------------------------------------------- expiry log
-- f4 was revoked: no access_expired for it. f2 expired an hour ago: exactly one.
update profiles set access_until = now() - interval '1 hour' where id = '00000000-0000-0000-0000-0000000000f2';
select private.log_access_expiries();
select is((select count(*)::int from pg_temp.events('00000000-0000-0000-0000-0000000000f4', 'access_expired')), 0,
  'a revoked account gets no expiry event');
select is((select count(*)::int from pg_temp.events('00000000-0000-0000-0000-0000000000f2', 'access_expired')), 1,
  'an expired account gets one expiry event');
select results_eq(
  $$ select created_at, details ->> 'until' from pg_temp.events('00000000-0000-0000-0000-0000000000f2', 'access_expired') $$,
  $$ select now() - interval '1 hour', to_jsonb(now() - interval '1 hour') #>> '{}' $$,
  'the expiry event is dated at access_until');
select is(private.log_access_expiries(), 0, 'a second run logs nothing');
select is((select count(*)::int from pg_temp.events('00000000-0000-0000-0000-0000000000f2', 'access_expired')), 1,
  'still one expiry event');
update profiles set access_until = now() + interval '1 day' where id = '00000000-0000-0000-0000-0000000000f2';
select is(private.log_access_expiries(), 0, 'an active account is not expired');
select is(
  (select count(*)::int from cron.job where jobname = 'log-access-expiries' and schedule = '*/10 * * * *'), 1,
  'the expiry job is scheduled every 10 minutes');

-- ---------------------------------------------------------------- privileges
select ok(not has_function_privilege('anon', 'public.purchase_access(uuid,int,int,int)', 'execute'), 'anon cannot purchase');
select ok(not has_function_privilege('authenticated', 'public.purchase_access(uuid,int,int,int)', 'execute'), 'authenticated cannot purchase');
select ok(has_function_privilege('service_role', 'public.purchase_access(uuid,int,int,int)', 'execute'), 'service_role can purchase');
select ok(not has_function_privilege('anon', 'public.admin_grant_access(uuid,int,text)', 'execute'), 'anon cannot grant');
select ok(has_function_privilege('authenticated', 'public.admin_grant_access(uuid,int,text)', 'execute'), 'authenticated can call grant');
select ok(not has_function_privilege('service_role', 'public.admin_revoke_access(uuid,text)', 'execute'), 'service_role cannot revoke');
select ok(not has_function_privilege('authenticated', 'private.log_access_expiries()', 'execute'), 'authenticated cannot run the expiry log');
select ok(not has_function_privilege('authenticated', 'private.extend_access(timestamptz,int,timestamptz)', 'execute'), 'authenticated cannot call extend_access');

-- ---------------------------------------------------------------- student RLS (f1)
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select is((select count(*)::int from access_settings), 1, 'a student reads the offer');
select throws_ok($$ update access_settings set price_bani = 1 $$, '42501', null, 'a student cannot update the offer');
select throws_ok($$ update profiles set access_until = now() + interval '1 year' where id = auth.uid() $$,
  '42501', null, 'a student cannot write access_until');
select throws_ok($$ select public.admin_grant_access('00000000-0000-0000-0000-0000000000f1', 2, 'x') $$,
  '42501', null, 'a student cannot grant access');
select throws_ok($$ select public.admin_revoke_access('00000000-0000-0000-0000-0000000000f1', 'x') $$,
  '42501', null, 'a student cannot revoke access');
select throws_ok($$ select public.admin_save_access_settings(1, 1, 1) $$, '42501', null, 'a student cannot save the offer');
select ok((select count(*) from access_orders) > 0
  and (select count(*) = 0 from access_orders where user_id <> auth.uid()), 'a student sees only their own orders');
select ok((select count(*) from access_ledger) > 0
  and (select count(*) = 0 from access_ledger where user_id <> auth.uid()), 'a student sees only their own access ledger');
select throws_ok($$ insert into access_orders (user_id, price_bani, bonus_credits, duration_months, status)
  values (auth.uid(), 1, 0, 1, 'approved') $$, '42501', null, 'a student cannot insert orders');

-- ---------------------------------------------------------------- admin reads everything
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}';
select ok((select count(distinct user_id) from access_orders where user_id in
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2')) = 2, 'an admin reads all orders');
select ok((select count(distinct user_id) from access_ledger where user_id in
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f4')) = 2, 'an admin reads the whole access ledger');

-- ---------------------------------------------------------------- anon
reset role;
set local role anon;
select throws_ok($$ select * from access_settings $$, '42501', null, 'anon cannot read the offer');

select * from finish();
rollback;
