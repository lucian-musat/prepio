begin;
select plan(13);

-- Fixtures (as postgres). d1 and d2 are students with full access; d1 owns the attempts.
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000d01', 'bac-charge1@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-000000000d02', 'bac-charge2@test.local', 'authenticated', 'authenticated', '{}');
update public.profiles set access_until = now() + interval '1 month', credit_balance = 15
 where id in ('00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-000000000d02');

insert into public.bac_subjects (id, title, year, published) values
  ('00000000-0000-0000-0000-00000000da01', '[test] Charge A', 2024, true),
  ('00000000-0000-0000-0000-00000000da02', '[test] Charge B', 2024, true);
insert into public.bac_attempts (id, user_id, subject_id, status) values
  ('00000000-0000-0000-0000-00000000db01', '00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-00000000da01', 'grading'),
  ('00000000-0000-0000-0000-00000000db02', '00000000-0000-0000-0000-000000000d01', '00000000-0000-0000-0000-00000000da02', 'draft');

-- ---------------------------------------------------------------- charge
create temp table charged on commit drop as
  select * from public.bac_charge_attempt('00000000-0000-0000-0000-00000000db01', '00000000-0000-0000-0000-000000000d01', 10, 'bac:A');
select is((select balance from charged), 5, 'charges the amount');
select isnt((select entry_id from charged), null, 'returns the ledger entry');
select is((select ledger_entry from bac_attempts where id = '00000000-0000-0000-0000-00000000db01'),
  (select entry_id from charged), 'stores the ledger entry on the attempt in the same call');
select results_eq(
  $$ select delta, kind, target, exercise_id from credit_ledger where id = (select entry_id from charged) $$,
  $$ values (-10, 'check'::text, 'bac:A'::text, null::uuid) $$,
  'writes a check ledger row with the target');

-- ---------------------------------------------------------------- balance too low
create temp table low on commit drop as
  select * from public.bac_charge_attempt('00000000-0000-0000-0000-00000000db01', '00000000-0000-0000-0000-000000000d01', 10, 'bac:A');
select results_eq($$ select entry_id, balance from low $$, $$ values (null::bigint, 5) $$,
  'too low a balance: null entry and the balance');
select is((select count(*)::int from credit_ledger where user_id = '00000000-0000-0000-0000-000000000d01' and kind = 'check'), 1,
  'too low a balance: no ledger row');
select is((select ledger_entry from bac_attempts where id = '00000000-0000-0000-0000-00000000db01'),
  (select entry_id from charged), 'too low a balance: the stored entry is untouched');

-- ---------------------------------------------------------------- refusals
select throws_ok(
  $$ select * from public.bac_charge_attempt('00000000-0000-0000-0000-00000000db02', '00000000-0000-0000-0000-000000000d01', 1, 'bac:B') $$,
  'P0001', 'attempt_not_grading', 'refuses an attempt that is not grading');
select throws_ok(
  $$ select * from public.bac_charge_attempt('00000000-0000-0000-0000-00000000db01', '00000000-0000-0000-0000-000000000d02', 1, 'bac:A') $$,
  'P0001', 'attempt_not_grading', 'refuses another student''s attempt');
select is((select credit_balance from profiles where id = '00000000-0000-0000-0000-000000000d02'), 15,
  'the refused call charged nothing');
select throws_ok(
  $$ select * from public.bac_charge_attempt('00000000-0000-0000-0000-00000000db01', '00000000-0000-0000-0000-000000000d01', 0, 'bac:A') $$,
  'P0001', 'bad_amount', 'refuses a non-positive amount');

-- ---------------------------------------------------------------- privileges
select ok(not has_function_privilege('authenticated', 'public.bac_charge_attempt(uuid, uuid, int, text)', 'execute'),
  'authenticated cannot execute bac_charge_attempt');
select ok(has_function_privilege('service_role', 'public.bac_charge_attempt(uuid, uuid, int, text)', 'execute'),
  'service_role can execute bac_charge_attempt');

select * from finish();
rollback;
