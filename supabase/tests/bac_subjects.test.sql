begin;
select plan(63);

-- Fixtures (as postgres). c1 trial, c2 full access, c3 admin, c4 full access but suspended, c5 full access (sweep).
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000c01', 'bac-trial@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-000000000c02', 'bac-full@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-000000000c03', 'bac-admin@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-000000000c04', 'bac-suspended@test.local', 'authenticated', 'authenticated', '{}'),
  ('00000000-0000-0000-0000-000000000c05', 'bac-sweep@test.local', 'authenticated', 'authenticated', '{}');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-000000000c03');
update public.profiles set access_until = now() + interval '1 month'
 where id in ('00000000-0000-0000-0000-000000000c02', '00000000-0000-0000-0000-000000000c04',
              '00000000-0000-0000-0000-000000000c05');
update public.profiles set suspended_at = now(), suspended_reason = 'test'
 where id = '00000000-0000-0000-0000-000000000c04';

insert into public.bac_subjects (id, title, year, published) values
  ('00000000-0000-0000-0000-00000000ca01', '[test] Published', 2024, true),
  ('00000000-0000-0000-0000-00000000ca02', '[test] Draft', 2024, false);
insert into public.bac_sources (id, subject_id, section, body) values
  ('00000000-0000-0000-0000-00000000cb01', '00000000-0000-0000-0000-00000000ca01', 1, 'source text'),
  ('00000000-0000-0000-0000-00000000cb02', '00000000-0000-0000-0000-00000000ca02', 1, 'hidden source');
insert into public.bac_items (id, subject_id, section, type, prompt, content, points) values
  ('00000000-0000-0000-0000-00000000cc01', '00000000-0000-0000-0000-00000000ca01', 1, 'short_answer', 'q1', '{}', 6),
  ('00000000-0000-0000-0000-00000000cc02', '00000000-0000-0000-0000-00000000ca02', 1, 'short_answer', 'q2', '{}', 6);
insert into public.bac_item_sources (item_id, label, source_id) values
  ('00000000-0000-0000-0000-00000000cc01', 'A', '00000000-0000-0000-0000-00000000cb01');
insert into public.bac_item_barem (item_id, barem) values
  ('00000000-0000-0000-0000-00000000cc01', '{"x": 1}'),
  ('00000000-0000-0000-0000-00000000cc02', '{"x": 2}');

-- ---------------------------------------------------------------- constraints and defaults
select has_table('public', 'bac_attempts', 'bac_attempts exists');
select has_column('public', 'ai_settings', 'bac_rules', 'ai_settings.bac_rules exists');
select is((select credit_cost from bac_subjects where id = '00000000-0000-0000-0000-00000000ca01'), 10::smallint,
  'credit_cost defaults to 10');
select throws_ok($$ insert into bac_subjects (title, year, credit_cost) values ('[test] x', 2024, 0) $$, '23514', null,
  'credit_cost below 1 is rejected');
select throws_ok($$ insert into bac_subjects (title, year) values (' ', 2024) $$, '23514', null,
  'a blank title is rejected');
select throws_ok($$ insert into bac_items (subject_id, section, type, prompt, content, points)
  values ('00000000-0000-0000-0000-00000000ca01', 4, 'short_answer', 'q', '{}', 5) $$, '23514', null,
  'section 4 is rejected');
select throws_ok($$ insert into bac_items (subject_id, section, type, prompt, content, points)
  values ('00000000-0000-0000-0000-00000000ca01', 1, 'nope', 'q', '{}', 5) $$, '23514', null,
  'an unknown item type is rejected');
select throws_ok($$ insert into bac_items (subject_id, section, type, prompt, content, points)
  values ('00000000-0000-0000-0000-00000000ca01', 1, 'essay', 'q', '{}', 31) $$, '23514', null,
  'points above 30 are rejected');
select throws_ok($$ delete from bac_sources where id = '00000000-0000-0000-0000-00000000cb01' $$, '23503', null,
  'a source used by an item cannot be deleted');

-- ---------------------------------------------------------------- trial student
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000c01","role":"authenticated"}';
select is((select count(*)::int from bac_subjects), 1, 'trial: sees the published subject only');
select is((select count(*)::int from bac_items), 0, 'trial: sees no items');
select is((select count(*)::int from bac_sources), 0, 'trial: sees no sources');
select is((select count(*)::int from bac_item_sources), 0, 'trial: sees no item sources');
select throws_ok($$ select public.save_bac_draft('00000000-0000-0000-0000-00000000ca01', '{}', null) $$, '42501', null,
  'trial: save_bac_draft is forbidden');
reset role;

-- ---------------------------------------------------------------- full access student
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000c02","role":"authenticated"}';
select is((select count(*)::int from bac_subjects), 1, 'full: sees only the published subject');
select is((select count(*)::int from bac_items), 1, 'full: sees the published items');
select is((select count(*)::int from bac_sources), 1, 'full: sees the published sources');
select is((select count(*)::int from bac_item_sources), 1, 'full: sees the item sources');
select is((select count(*)::int from bac_item_barem), 0, 'full: sees no barem');
create temp table d1 on commit drop as
  select public.save_bac_draft('00000000-0000-0000-0000-00000000ca01', '{"a": 1}', '{"section": 1, "index": 0}') as id;
grant select on d1 to authenticated;
select isnt((select id from d1), null, 'full: save_bac_draft returns an id');
select is(public.save_bac_draft('00000000-0000-0000-0000-00000000ca01', '{"a": 2}', '{"section": 2, "index": 1}'),
  (select id from d1), 'full: a second call returns the same id');
select results_eq($$ select answers, position, status from bac_attempts $$,
  $$ values ('{"a": 2}'::jsonb, '{"section": 2, "index": 1}'::jsonb, 'draft'::text) $$,
  'full: the second call overwrote answers and position');
select throws_ok($$ update bac_attempts set points = 90 $$, '42501', null, 'full: cannot write points');
select throws_ok($$ update bac_attempts set status = 'graded' $$, '42501', null, 'full: cannot write status');
select throws_ok($$ insert into bac_attempts (user_id, subject_id) values (auth.uid(), '00000000-0000-0000-0000-00000000ca02') $$,
  '42501', null, 'full: cannot insert attempts');
select throws_ok($$ delete from bac_attempts $$, '42501', null, 'full: cannot delete attempts');
select throws_ok($$ select public.save_bac_draft('00000000-0000-0000-0000-00000000ca02', '{}', null) $$, '42501', null,
  'full: an unpublished subject cannot be drafted');
create function pg_temp.edited() returns int language sql as
  $$ with u as (update bac_subjects set title = 'x' returning 1) select count(*)::int from u $$;
select is(pg_temp.edited(), 0, 'full: cannot edit subjects (RLS hides every row from the update)');
reset role;
select is((select count(*)::int from student_events
            where user_id = '00000000-0000-0000-0000-000000000c02' and kind = 'bac_started'), 1,
  'bac_started is logged once, on the first insert');

-- Other students never see this attempt.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000c05","role":"authenticated"}';
select is((select count(*)::int from bac_attempts), 0, 'full: another student sees no attempts of mine');
reset role;

-- ---------------------------------------------------------------- admin
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000c03","role":"authenticated"}';
select is((select count(*)::int from bac_subjects where title like '[test]%'), 2, 'admin: sees every subject');
select is((select count(*)::int from bac_item_barem), 2, 'admin: sees every barem');
select is((select count(*)::int from bac_items), 2, 'admin: sees every item');
select is((select count(*)::int from bac_attempts), 1, 'admin: sees every attempt');
select lives_ok($$ update bac_subjects set title = '[test] Draft 2' where id = '00000000-0000-0000-0000-00000000ca02' $$,
  'admin: edits a subject');
reset role;

-- ---------------------------------------------------------------- suspended student
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000c04","role":"authenticated"}';
select is((select count(*)::int from bac_subjects), 0, 'suspended: sees no subjects');
select is((select count(*)::int from bac_items), 0, 'suspended: sees no items');
select throws_ok($$ select public.save_bac_draft('00000000-0000-0000-0000-00000000ca01', '{}', null) $$, '42501', null,
  'suspended: save_bac_draft is forbidden');
reset role;

-- ---------------------------------------------------------------- can_open_bac_for
select ok(public.can_open_bac_for('00000000-0000-0000-0000-000000000c02'), 'can_open_bac_for: full access');
select ok(public.can_open_bac_for('00000000-0000-0000-0000-000000000c03'), 'can_open_bac_for: admin');
select ok(not public.can_open_bac_for('00000000-0000-0000-0000-000000000c01'), 'can_open_bac_for: not a trial student');
select ok(not public.can_open_bac_for('00000000-0000-0000-0000-000000000c04'), 'can_open_bac_for: not a suspended student');
select ok(not has_function_privilege('authenticated', 'public.can_open_bac_for(uuid)', 'execute'),
  'authenticated cannot call can_open_bac_for');
select ok(has_function_privilege('service_role', 'public.can_open_bac_for(uuid)', 'execute'),
  'service_role can call can_open_bac_for');

-- ---------------------------------------------------------------- open attempt lifecycle
select throws_ok($$ insert into bac_attempts (user_id, subject_id)
  values ('00000000-0000-0000-0000-000000000c02', '00000000-0000-0000-0000-00000000ca01') $$, '23505', null,
  'a second open attempt violates the partial unique index');
update bac_attempts set status = 'grading', submitted_at = now() where id = (select id from d1);
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000c02","role":"authenticated"}';
select throws_ok($$ select public.save_bac_draft('00000000-0000-0000-0000-00000000ca01', '{}', null) $$, 'P0001', 'grading',
  'save_bac_draft while grading raises');
reset role;
update bac_attempts set status = 'failed' where id = (select id from d1);
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000c02","role":"authenticated"}';
select is(public.save_bac_draft('00000000-0000-0000-0000-00000000ca01', '{"b": 1}', null), (select id from d1),
  'save_bac_draft on a failed attempt returns the same id');
reset role;
select is((select status from bac_attempts where id = (select id from d1)), 'draft', 'the failed attempt is a draft again');
update bac_attempts set status = 'graded', points = 50, grade = 6.00 where id = (select id from d1);
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000c02","role":"authenticated"}';
create temp table d2 on commit drop as
  select public.save_bac_draft('00000000-0000-0000-0000-00000000ca01', '{}', null) as id;
grant select on d2 to authenticated;
select isnt((select id from d2), (select id from d1), 'after a graded attempt save_bac_draft creates a new attempt');
reset role;
select is((select count(*)::int from student_events
            where user_id = '00000000-0000-0000-0000-000000000c02' and kind = 'bac_started'), 1,
  'bac_started is not logged again for a retake');

-- ---------------------------------------------------------------- log_student_event_service
select lives_ok($$ select public.log_student_event_service('00000000-0000-0000-0000-000000000c02', 'bac_submitted', null,
  '{"subject_id": "x"}') $$, 'log_student_event_service accepts bac_submitted');
select lives_ok($$ select public.log_student_event_service('00000000-0000-0000-0000-000000000c02', 'bac_graded', null, '{}') $$,
  'log_student_event_service accepts bac_graded');
select lives_ok($$ select public.log_student_event_service('00000000-0000-0000-0000-000000000c02', 'check_blocked', null, '{}') $$,
  'log_student_event_service still accepts check_blocked');
select throws_ok($$ select public.log_student_event_service('00000000-0000-0000-0000-000000000c02', 'suspended', null, '{}') $$,
  'P0001', 'bad_kind', 'log_student_event_service rejects other kinds');

-- ---------------------------------------------------------------- stale grading sweep
update profiles set credit_balance = 50 where id = '00000000-0000-0000-0000-000000000c05';
create temp table sp on commit drop as
  select * from public.spend_credits('00000000-0000-0000-0000-000000000c05', 10, null, 'bac:test');
insert into bac_attempts (id, user_id, subject_id, status, submitted_at, ledger_entry) values
  ('00000000-0000-0000-0000-00000000cd01', '00000000-0000-0000-0000-000000000c05',
   '00000000-0000-0000-0000-00000000ca01', 'grading', now() - interval '6 minutes', (select entry_id from sp));
insert into bac_attempts (id, user_id, subject_id, status, submitted_at) values
  ('00000000-0000-0000-0000-00000000cd02', '00000000-0000-0000-0000-000000000c05',
   '00000000-0000-0000-0000-00000000ca02', 'grading', now() - interval '1 minute');
select is((select credit_balance from profiles where id = '00000000-0000-0000-0000-000000000c05'), 40, 'balance was charged');
select lives_ok($$ select private.fail_stale_bac_grading() $$, 'the sweep runs');
select is((select status from bac_attempts where id = '00000000-0000-0000-0000-00000000cd01'), 'failed',
  'sweep: the stale attempt failed');
select is((select credit_balance from profiles where id = '00000000-0000-0000-0000-000000000c05'), 50,
  'sweep: the balance is restored');
select is((select count(*)::int from student_events
            where user_id = '00000000-0000-0000-0000-000000000c05' and kind = 'bac_grading_failed'
              and details = '{"subject_id": "00000000-0000-0000-0000-00000000ca01"}'), 1,
  'sweep: one bac_grading_failed event');
select is((select status from bac_attempts where id = '00000000-0000-0000-0000-00000000cd02'), 'grading',
  'sweep: a recent attempt is untouched');
select lives_ok($$ select private.fail_stale_bac_grading() $$, 'a second sweep run is harmless');
select is((select credit_balance from profiles where id = '00000000-0000-0000-0000-000000000c05'), 50,
  'sweep: no double refund');
select ok(exists (select 1 from cron.job where jobname = 'fail-stale-bac-grading'), 'the sweep is scheduled');

select * from finish();
rollback;
