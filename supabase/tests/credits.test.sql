begin;
select plan(58);

-- Fixtures (as postgres). Assertions are scoped to these ids so the suite also passes on a seeded DB.
-- f1 and f2 are students, f3 is an admin. The auth trigger creates their profiles.
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'credits-student1@test.local', 'authenticated', 'authenticated', '{"full_name":"Credit Student"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'credits-student2@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-0000000000f3', 'credits-admin@test.local', 'authenticated', 'authenticated', '{}');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000f3');

insert into nodes (id, parent_id, title) values ('00000000-0000-0000-0000-0000000000c1', null, 'Root');
insert into lessons (id, node_id, title, status) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', 'Published', 'published');

-- ---------------------------------------------------------------- schema and seeded rows
select has_column('public', 'profiles', 'credit_balance', 'profiles.credit_balance exists');
select is((select credit_balance from profiles where id = '00000000-0000-0000-0000-0000000000f1'), 12,
  'a new profile starts with the welcome credits');
select is((select welcome_credits from credit_settings where id = 1), 12, 'credit_settings row 1 starts at 12 welcome credits');
select throws_ok($$ insert into credit_settings (id) values (2) $$, '23514', null, 'credit_settings is a singleton');
select results_eq(
  $$ select credits, price_bani, featured, active, sort_order from credit_packages order by sort_order $$,
  $$ values (20, 999, false, true, 0), (50, 1999, true, true, 1), (120, 3999, false, true, 2) $$,
  'the three starting packages are seeded');
select col_default_is('public', 'consolidation_exercises', 'credit_cost', '1', 'credit_cost defaults to 1');

-- ---------------------------------------------------------------- spend (service role path, as postgres)
update profiles set credit_balance = 3 where id = '00000000-0000-0000-0000-0000000000f1';

create temp table spent on commit drop as
  select * from public.spend_credits('00000000-0000-0000-0000-0000000000f1', 2, null, 'exercise');
select is((select balance from spent), 1, 'spend 2 of 3 leaves 1');
select isnt((select entry_id from spent), null, 'spend returns the ledger entry');
select results_eq(
  $$ select delta, balance_after, kind, target from credit_ledger where id = (select entry_id from spent) $$,
  $$ values (-2, 1, 'check'::text, 'exercise'::text) $$,
  'spend writes a check ledger row');
select results_eq(
  $$ select entry_id, balance from public.spend_credits('00000000-0000-0000-0000-0000000000f1', 2, null, 'exercise') $$,
  $$ values (null::bigint, 1) $$,
  'an overdraw returns a null entry and the unchanged balance');
select is((select credit_balance from profiles where id = '00000000-0000-0000-0000-0000000000f1'), 1,
  'the overdraw changed nothing');
select throws_ok($$ select * from public.spend_credits('00000000-0000-0000-0000-0000000000f1', 0, null, 'exercise') $$,
  'P0001', 'bad_amount', 'spend rejects a non-positive amount');

-- ---------------------------------------------------------------- refund
select is(public.refund_credits((select entry_id from spent)), 3, 'refund restores the balance');
select is(public.refund_credits((select entry_id from spent)), 3, 'a second refund returns the same balance');
select is((select count(*)::int from credit_ledger where refund_of = (select entry_id from spent) and kind = 'refund'), 1,
  'there is exactly one refund row');
select is((select delta from credit_ledger where refund_of = (select entry_id from spent)), 2, 'the refund delta mirrors the spend');

-- Spending to zero, one credit at a time, never goes below zero.
update profiles set credit_balance = 1 where id = '00000000-0000-0000-0000-0000000000f1';
select is((select balance from public.spend_credits('00000000-0000-0000-0000-0000000000f1', 1, null, 'exercise')), 0,
  'spending the last credit leaves 0');
select results_eq(
  $$ select entry_id, balance from public.spend_credits('00000000-0000-0000-0000-0000000000f1', 1, null, 'exercise') $$,
  $$ values (null::bigint, 0) $$,
  'spending at 0 returns a null entry and 0');

-- ---------------------------------------------------------------- purchase
create temp table bought on commit drop as
  select * from public.purchase_credit_package('00000000-0000-0000-0000-0000000000f1',
    (select id from credit_packages where featured and active));
select is((select credits from bought), 50, 'purchase returns the package credits');
select is((select balance from bought), 50, 'purchase adds the credits');
select results_eq(
  $$ select status, credits, price_bani, provider, approved_at is not null from credit_orders where id = (select order_id from bought) $$,
  $$ values ('approved'::text, 50, 1999, 'none'::text, true) $$,
  'purchase creates an approved order from a snapshot of the package');
select results_eq(
  $$ select delta, balance_after, kind from credit_ledger where order_id = (select order_id from bought) $$,
  $$ values (50, 50, 'purchase'::text) $$,
  'purchase writes a purchase ledger row');
update credit_packages set price_bani = 2999 where featured and active;
select is((select price_bani from credit_orders where id = (select order_id from bought)), 1999,
  'a later price change does not alter the order');

insert into credit_packages (id, credits, price_bani, active, sort_order) values
  ('00000000-0000-0000-0000-0000000000a9', 7, 100, false, 9);
select throws_ok(
  $$ select * from public.purchase_credit_package('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a9') $$,
  'P0001', 'package_unavailable', 'an inactive package cannot be bought');
select throws_ok(
  $$ select * from public.purchase_credit_package('00000000-0000-0000-0000-0000000000f1', gen_random_uuid()) $$,
  'P0001', 'package_unavailable', 'an unknown package cannot be bought');

-- f2 gets a ledger row and an order, so the student RLS checks below have something to hide.
select * from public.purchase_credit_package('00000000-0000-0000-0000-0000000000f2',
  (select id from credit_packages where credits = 20 and active));

-- ---------------------------------------------------------------- constraints
select throws_ok($$ insert into credit_packages (credits, price_bani, featured, active) values (1, 1, true, true) $$,
  '23505', null, 'a second featured active package is rejected');
select lives_ok($$ insert into credit_packages (credits, price_bani, featured, active) values (1, 1, true, false) $$,
  'an inactive package may be featured');
select throws_ok(
  $$ insert into credit_ledger (user_id, delta, balance_after, kind) values ('00000000-0000-0000-0000-0000000000f1', 1, 1, 'admin') $$,
  '23514', null, 'an admin ledger row needs a reason');
select throws_ok(
  $$ insert into credit_ledger (user_id, delta, balance_after, kind) values ('00000000-0000-0000-0000-0000000000f1', 0, 1, 'check') $$,
  '23514', null, 'a ledger row needs a non-zero delta');
select throws_ok($$ update profiles set credit_balance = -1 where id = '00000000-0000-0000-0000-0000000000f1' $$,
  '23514', null, 'the balance cannot go negative');
select throws_ok(
  $$ insert into consolidation_exercises (lesson_id, type, prompt, credit_cost) values ('00000000-0000-0000-0000-0000000000e1', 'facts', 'x', 6) $$,
  '23514', null, 'credit_cost 6 is rejected');
select throws_ok(
  $$ insert into consolidation_exercises (lesson_id, type, prompt, credit_cost) values ('00000000-0000-0000-0000-0000000000e1', 'facts', 'x', 0) $$,
  '23514', null, 'credit_cost 0 is rejected');

-- ---------------------------------------------------------------- student f1
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';

select ok((select count(*) from credit_ledger where user_id = '00000000-0000-0000-0000-0000000000f1') > 0,
  'student reads their own ledger rows');
select is((select count(*)::int from credit_ledger where user_id = '00000000-0000-0000-0000-0000000000f2'), 0,
  'student cannot read another student''s ledger');
select is((select count(*)::int from credit_orders where user_id = '00000000-0000-0000-0000-0000000000f1'), 1,
  'student reads their own orders');
select is((select count(*)::int from credit_orders where user_id = '00000000-0000-0000-0000-0000000000f2'), 0,
  'student cannot read another student''s orders');
select is((select count(*)::int from credit_packages where not active), 0, 'student sees no inactive packages');
select is((select count(*)::int from credit_packages where active), 3, 'student sees the active packages');
select is((select count(*)::int from credit_settings), 0, 'student cannot read credit_settings');
select is((select credit_balance from profiles where id = '00000000-0000-0000-0000-0000000000f1'), 50,
  'student reads their own balance');
select throws_ok($$ update profiles set credit_balance = 999 where id = '00000000-0000-0000-0000-0000000000f1' $$,
  '42501', null, 'student cannot update their balance');
select throws_ok(
  $$ insert into credit_ledger (user_id, delta, balance_after, kind) values ('00000000-0000-0000-0000-0000000000f1', 100, 100, 'purchase') $$,
  '42501', null, 'student cannot insert ledger rows');
select throws_ok(
  $$ insert into credit_orders (user_id, package_id, credits, price_bani, status) values
       ('00000000-0000-0000-0000-0000000000f1', (select id from credit_packages where active limit 1), 1, 1, 'approved') $$,
  '42501', null, 'student cannot insert orders');
select throws_ok($$ select * from public.spend_credits('00000000-0000-0000-0000-0000000000f1', 1, null, 'exercise') $$,
  '42501', null, 'student cannot execute spend_credits');
select throws_ok(
  $$ select * from public.purchase_credit_package('00000000-0000-0000-0000-0000000000f1', (select id from credit_packages where active limit 1)) $$,
  '42501', null, 'student cannot execute purchase_credit_package');
select throws_ok($$ select public.admin_adjust_credits('00000000-0000-0000-0000-0000000000f1', 5, 'x') $$,
  '42501', null, 'student cannot adjust credits');
select throws_ok($$ select public.admin_save_credit_settings(5, '[]'::jsonb) $$,
  '42501', null, 'student cannot save credit settings');
select throws_ok($$ select * from public.admin_students(null, 10, 0) $$,
  '42501', null, 'student cannot list students');

-- ---------------------------------------------------------------- admin f3
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}';

select throws_ok($$ select public.admin_adjust_credits('00000000-0000-0000-0000-0000000000f1', 5, '   ') $$,
  'P0001', 'reason_required', 'an adjustment needs a reason');
select throws_ok($$ select public.admin_adjust_credits('00000000-0000-0000-0000-0000000000f1', -51, 'test') $$,
  'P0001', 'insufficient_balance', 'an adjustment cannot take the balance below 0');
select is(public.admin_adjust_credits('00000000-0000-0000-0000-0000000000f1', 5, 'test'), 55, 'an adjustment returns the new balance');
select results_eq(
  $$ select delta, kind, admin_id, reason from credit_ledger
      where user_id = '00000000-0000-0000-0000-0000000000f1' and kind = 'admin' $$,
  $$ values (5, 'admin'::text, '00000000-0000-0000-0000-0000000000f3'::uuid, 'test'::text) $$,
  'an adjustment writes an admin row with the admin''s id');
select is((select admin_email from public.admin_credit_ledger('00000000-0000-0000-0000-0000000000f1', 1)),
  'credits-admin@test.local', 'admin_credit_ledger lists the newest entry first, with the admin''s email');

select lives_ok(
  $$ select public.admin_save_credit_settings(15, (
       select jsonb_agg(jsonb_build_object('id', id, 'credits', credits, 'price_bani', price_bani,
                                           'featured', credits = 20, 'active', active) order by sort_order)
         from credit_packages where active)) $$,
  'admin saves the settings, moving the featured flag');
select is((select credits from credit_packages where featured and active), 20, 'the featured flag moved');
select is((select welcome_credits from credit_settings where id = 1), 15, 'the welcome credits were saved');

select is((select count(*)::int from public.admin_students(null, 1000, 0) where id = '00000000-0000-0000-0000-0000000000f3'), 0,
  'admin_students does not list admins who never used the student app');
select results_eq(
  $$ select id, display_name, credit_balance, total from public.admin_students('student1@test', 10, 0) $$,
  $$ values ('00000000-0000-0000-0000-0000000000f1'::uuid, 'Credit Student'::text, 55, 1::bigint) $$,
  'admin_students finds a student by part of the email');

select * from finish();
rollback;
