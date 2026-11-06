begin;
select plan(52);

-- Fixtures (as postgres). Assertions are scoped to these ids so the suite also passes on a seeded DB.
-- f1, f2, f4, f5 are students (f2 gets suspended), f3 an admin. The auth trigger creates their profiles.
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, last_sign_in_at) values
  ('00000000-0000-0000-0000-0000000000f1', 'f1@test.local', 'authenticated', 'authenticated',
   '{"provider":"google"}', '{}', null),
  ('00000000-0000-0000-0000-0000000000f2', 'f2@test.local', 'authenticated', 'authenticated', '{}', '{}', null),
  ('00000000-0000-0000-0000-0000000000f3', 'f3@test.local', 'authenticated', 'authenticated', '{}', '{}', null),
  ('00000000-0000-0000-0000-0000000000f4', 'f4@test.local', 'authenticated', 'authenticated', '{}', '{}', null),
  ('00000000-0000-0000-0000-0000000000f5', 'f5@test.local', 'authenticated', 'authenticated', '{}', '{}',
   '2026-01-02 10:00:00+00');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000f3');

-- Lessons A (e1) and B (e2) are published; e3 is a draft.
insert into nodes (id, parent_id, title) values ('00000000-0000-0000-0000-0000000000c1', null, 'Root');
insert into lessons (id, node_id, title, status) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', 'Lesson A', 'published'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c1', 'Lesson B', 'published'),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000c1', 'Draft', 'draft');
insert into cards (lesson_id, content) values
  ('00000000-0000-0000-0000-0000000000e1', '{"text":"a1"}'),
  ('00000000-0000-0000-0000-0000000000e1', '{"text":"a2"}'),
  ('00000000-0000-0000-0000-0000000000e1', '{"text":"a3"}'),
  ('00000000-0000-0000-0000-0000000000e2', '{"text":"b1"}');
insert into questions (lesson_id, type, prompt, difficulty, options) values
  ('00000000-0000-0000-0000-0000000000e1', 'single_choice', 'q1', 'easy', '[]'),
  ('00000000-0000-0000-0000-0000000000e1', 'single_choice', 'q2', 'easy', '[]'),
  ('00000000-0000-0000-0000-0000000000e2', 'single_choice', 'q3', 'easy', '[]');
insert into consolidation_exercises (id, lesson_id, type, prompt) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', 'facts', 'Exercise A1'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000e1', 'facts', 'Exercise A2'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e2', 'facts', 'Exercise B1');

-- f1: progress on A (finished), B and the draft (finished); a run and attempts on A, an attempt on B.
insert into lesson_progress (user_id, lesson_id, finished_at, position) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1', now(), '{"phase":"questions","index":1}'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e2', null, '{"phase":"cards","index":0}'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e3', now(), null);
insert into consolidation_runs (user_id, lesson_id, exercise_ids, index) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1',
   array['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2']::uuid[], 1);
insert into consolidation_attempts (user_id, exercise_id, answer) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', '{}'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a2', '{}'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000b1', '{}');
-- f2 has started lesson A (so log_test_failed would otherwise accept it).
insert into lesson_progress (user_id, lesson_id) values
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000e1');
-- f4's only activity is two days old; f5 has no events at all (falls back to last_sign_in_at).
update student_events set created_at = now() - interval '2 days' where user_id = '00000000-0000-0000-0000-0000000000f4';
delete from student_events where user_id = '00000000-0000-0000-0000-0000000000f5';
-- An event that points at an exercise.
select public.log_student_event('00000000-0000-0000-0000-0000000000f1', 'check', null,
  '00000000-0000-0000-0000-0000000000a1', null, '{"cost":1}');

-- Balance and ledger before any reset.
create temp table before_reset as
  select (select credit_balance from profiles where id = '00000000-0000-0000-0000-0000000000f1') as balance,
         (select count(*) from credit_ledger where user_id = '00000000-0000-0000-0000-0000000000f1') as ledger_rows;
grant select on before_reset to authenticated;

-- ---------------------------------------------------------------- non-admin
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';

select throws_ok($$ select * from public.admin_student_progress('00000000-0000-0000-0000-0000000000f1') $$,
  '42501', null, 'a student cannot read progress through the admin RPC');
select throws_ok($$ select public.admin_reset_progress('00000000-0000-0000-0000-0000000000f1') $$,
  '42501', null, 'a student cannot reset progress');
select throws_ok($$ select * from public.admin_students(null, 10, 0, null, 'all') $$,
  '42501', null, 'a student cannot list students');
select throws_ok($$ select * from public.admin_student_events('00000000-0000-0000-0000-0000000000f1', 10) $$,
  '42501', null, 'a student cannot read the timeline');

-- ---------------------------------------------------------------- admin f3: progress
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}';

select results_eq(
  $$ select lesson_id, finished_at is not null, position, cards_total, questions_total, run_index, run_total,
            run_finished_at, run_updated_at is not null, progress_updated_at is not null
       from public.admin_student_progress('00000000-0000-0000-0000-0000000000f1') order by lesson_id $$,
  $$ values ('00000000-0000-0000-0000-0000000000e1'::uuid, true, '{"phase":"questions","index":1}'::jsonb, 3, 2,
             1, 2, null::timestamptz, true, true),
            ('00000000-0000-0000-0000-0000000000e2'::uuid, false, '{"phase":"cards","index":0}'::jsonb, 1, 1,
             null::int, null::int, null::timestamptz, false, true) $$,
  'admin_student_progress returns both published lessons with their totals and the run (not the draft)');
select throws_ok($$ select * from public.admin_student_progress('00000000-0000-0000-0000-0000000000f3') $$,
  'P0001', 'cannot_target_admin', 'admin_student_progress refuses an admin');
select is((select count(*)::int from public.admin_student_progress('00000000-0000-0000-0000-0000000000f4')), 0,
  'a student without progress has no rows');

-- ---------------------------------------------------------------- admin f3: list
select results_eq(
  $$ select provider, suspended_at, suspended_reason, reregistration_blocked, lessons_finished, total
       from public.admin_students('', 1, 0, '00000000-0000-0000-0000-0000000000f1') $$,
  $$ values ('google'::text, null::timestamptz, null::text, false, 1, 1::bigint) $$,
  'admin_students returns the provider, the suspension fields and the published lessons finished');
select ok(
  (select last_activity_at = (select max(created_at) from student_events
                               where user_id = '00000000-0000-0000-0000-0000000000f1')
     from public.admin_students('', 1, 0, '00000000-0000-0000-0000-0000000000f1')),
  'last_activity_at is the newest timeline event');
select is(
  (select last_activity_at from public.admin_students('', 1, 0, '00000000-0000-0000-0000-0000000000f5')),
  '2026-01-02 10:00:00+00'::timestamptz, 'without events, last_activity_at falls back to the last sign-in');
select results_eq(
  $$ select id, total from public.admin_students('f1@test', 10, 0) $$,
  $$ values ('00000000-0000-0000-0000-0000000000f1'::uuid, 1::bigint) $$,
  'the old call shape still works (p_filter defaults to all)');
select throws_ok($$ select * from public.admin_students(null, 10, 0, null, 'nope') $$,
  'P0001', 'bad_filter', 'an unknown filter is rejected');

select lives_ok($$ select public.admin_suspend_student('00000000-0000-0000-0000-0000000000f2', 'Spam') $$,
  'admin suspends f2');
select ok(
  (select bool_and(suspended_at is not null) from public.admin_students(null, 200, 0, null, 'suspended')),
  'the suspended filter lists only suspended students');
select results_eq(
  $$ select id, suspended_reason, total from public.admin_students('f2@test', 10, 0, null, 'suspended') $$,
  $$ values ('00000000-0000-0000-0000-0000000000f2'::uuid, 'Spam'::text, 1::bigint) $$,
  'the suspended filter combines with the search');
select is((select count(*)::int from public.admin_students('f1@test', 10, 0, null, 'suspended')), 0,
  'an active student is not in the suspended filter');
select is((select count(*)::int from public.admin_students('f1@test', 10, 0, null, 'active_today')), 1,
  'a student with an event today is active today');
select is((select count(*)::int from public.admin_students('f4@test', 10, 0, null, 'active_today')), 0,
  'a student whose only event is two days old is not active today');
select is((select count(*)::int from public.admin_students(null, 200, 0, null, 'active_today')),
  (select max(total)::int from public.admin_students(null, 200, 0, null, 'active_today')),
  'total equals the filtered row count');

-- ---------------------------------------------------------------- admin f3: reset one lesson
select throws_ok($$ select public.admin_reset_progress('00000000-0000-0000-0000-0000000000f3') $$,
  'P0001', 'cannot_target_admin', 'admin_reset_progress refuses an admin');
select throws_ok($$ select public.admin_reset_progress('00000000-0000-0000-0000-0000000000ff') $$,
  'P0001', 'student_not_found', 'admin_reset_progress refuses an unknown user');
select throws_ok(
  $$ select public.admin_reset_progress('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000ee') $$,
  'P0001', 'lesson_not_found', 'admin_reset_progress refuses an unknown lesson');
select lives_ok(
  $$ select public.admin_reset_progress('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1') $$,
  'admin resets lesson A');

reset role;
select is((select count(*)::int from lesson_progress
            where user_id = '00000000-0000-0000-0000-0000000000f1' and lesson_id = '00000000-0000-0000-0000-0000000000e1'), 0,
  'the reset removes A''s progress');
select is((select count(*)::int from consolidation_runs where user_id = '00000000-0000-0000-0000-0000000000f1'), 0,
  'the reset removes A''s run');
select results_eq(
  $$ select exercise_id from consolidation_attempts where user_id = '00000000-0000-0000-0000-0000000000f1' $$,
  $$ values ('00000000-0000-0000-0000-0000000000b1'::uuid) $$,
  'the reset removes A''s attempts and keeps B''s');
select is((select count(*)::int from lesson_progress where user_id = '00000000-0000-0000-0000-0000000000f1'), 2,
  'the reset keeps the other lessons'' progress');
select results_eq(
  $$ select credit_balance, (select count(*) from credit_ledger where user_id = '00000000-0000-0000-0000-0000000000f1')
       from profiles where id = '00000000-0000-0000-0000-0000000000f1' $$,
  $$ select balance, ledger_rows from before_reset $$,
  'the reset leaves the credit balance and the ledger unchanged');
select results_eq(
  $$ select lesson_id, admin_id, details from student_events
      where user_id = '00000000-0000-0000-0000-0000000000f1' and kind = 'progress_reset' $$,
  $$ values ('00000000-0000-0000-0000-0000000000e1'::uuid, '00000000-0000-0000-0000-0000000000f3'::uuid,
             '{"scope":"lesson"}'::jsonb) $$,
  'the reset logs progress_reset with the lesson, the admin and the scope');

-- ---------------------------------------------------------------- timeline
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}';
select results_eq(
  $$ select kind, lesson_title, admin_email, details
       from public.admin_student_events('00000000-0000-0000-0000-0000000000f1', 1) $$,
  $$ values ('progress_reset'::text, 'Lesson A'::text, 'f3@test.local'::text, '{"scope":"lesson"}'::jsonb) $$,
  'admin_student_events lists the newest event first, with the lesson title and the admin email');
select results_eq(
  $$ select exercise_type, exercise_prompt from public.admin_student_events('00000000-0000-0000-0000-0000000000f1', 50)
      where kind = 'check' $$,
  $$ values ('facts'::text, 'Exercise A1'::text) $$,
  'admin_student_events resolves the exercise');
select ok(
  (select bool_and(id < (select max(id) from student_events where user_id = '00000000-0000-0000-0000-0000000000f1'))
     from public.admin_student_events('00000000-0000-0000-0000-0000000000f1', 50,
            (select max(id) from student_events where user_id = '00000000-0000-0000-0000-0000000000f1'))),
  'p_before pages to older events');
select throws_ok($$ select * from public.admin_student_events('00000000-0000-0000-0000-0000000000f3', 10) $$,
  'P0001', 'cannot_target_admin', 'admin_student_events refuses an admin');

-- ---------------------------------------------------------------- the student continues after a reset
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select lives_ok(
  $$ insert into lesson_progress (lesson_id, position) values ('00000000-0000-0000-0000-0000000000e1', '{"phase":"cards","index":0}')
       on conflict (user_id, lesson_id) do update set position = excluded.position $$,
  'after the reset the student upserts progress on A again');

-- ---------------------------------------------------------------- full reset
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}';
select lives_ok($$ select public.admin_reset_progress('00000000-0000-0000-0000-0000000000f1') $$,
  'admin resets the whole journey');
reset role;
select is(
  (select count(*)::int from lesson_progress where user_id = '00000000-0000-0000-0000-0000000000f1')
  + (select count(*)::int from consolidation_runs where user_id = '00000000-0000-0000-0000-0000000000f1')
  + (select count(*)::int from consolidation_attempts where user_id = '00000000-0000-0000-0000-0000000000f1'), 0,
  'the full reset removes all progress, runs and attempts');
select results_eq(
  $$ select lesson_id, details from student_events
      where user_id = '00000000-0000-0000-0000-0000000000f1' and kind = 'progress_reset' order by id desc limit 1 $$,
  $$ values (null::uuid, '{"scope":"all"}'::jsonb) $$,
  'the full reset logs progress_reset with scope all');
select ok(exists (select 1 from profiles where id = '00000000-0000-0000-0000-0000000000f1'),
  'the full reset keeps the profile');
select results_eq(
  $$ select credit_balance from profiles where id = '00000000-0000-0000-0000-0000000000f1' $$,
  $$ select balance from before_reset $$,
  'the full reset leaves the credit balance unchanged');

-- ---------------------------------------------------------------- suspended student f2 (review fixes)
update profiles set learning_mode = 'guided' where id = '00000000-0000-0000-0000-0000000000f2';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}';
select throws_ok($$ update profiles set display_name = 'New name' $$, '42501', null,
  'a suspended student cannot rename themselves');
select throws_ok($$ update profiles set learning_mode = 'free' $$, '42501', null,
  'a suspended student cannot change the learning mode');
select throws_ok($$ select public.log_test_failed('00000000-0000-0000-0000-0000000000e1') $$, '42501', null,
  'a suspended student cannot log a failed test');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f4","role":"authenticated"}';
select lives_ok($$ update profiles set display_name = 'F4 name', learning_mode = 'free' $$,
  'an active student still edits their profile');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}';
select lives_ok($$ select public.admin_suspend_student('00000000-0000-0000-0000-0000000000f2', 'Spam again') $$,
  'admin re-suspends a suspended student (definer update on the profile)');

reset role;
set local role service_role;
select lives_ok(
  $$ update profiles set suspended_reason = 'Service' where id = '00000000-0000-0000-0000-0000000000f2' $$,
  'the service role still updates suspension fields');
reset role;
select is((select suspended_reason from profiles where id = '00000000-0000-0000-0000-0000000000f2'), 'Service',
  'the service role update landed');
select is((select count(*)::int from student_events
            where user_id = '00000000-0000-0000-0000-0000000000f2' and kind = 'test_failed'), 0,
  'no test_failed was logged for the suspended student');

-- ---------------------------------------------------------------- reactivating an active student is a no-op
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}';
select lives_ok($$ select public.admin_reactivate_student('00000000-0000-0000-0000-0000000000f1') $$,
  'reactivating an active student succeeds');
select throws_ok($$ select public.admin_reactivate_student('00000000-0000-0000-0000-0000000000ff') $$,
  'P0001', 'student_not_found', 'reactivating an unknown user still fails');
select lives_ok($$ select public.admin_reactivate_student('00000000-0000-0000-0000-0000000000f2') $$,
  'reactivating a suspended student succeeds');
reset role;
select is((select count(*)::int from student_events
            where user_id = '00000000-0000-0000-0000-0000000000f1' and kind = 'reactivated'), 0,
  'reactivating an active student logs nothing');
select is((select count(*)::int from student_events
            where user_id = '00000000-0000-0000-0000-0000000000f2' and kind = 'reactivated'), 1,
  'reactivating a suspended student logs reactivated');

select * from finish();
rollback;
