begin;
select plan(16);

-- Fixtures (as postgres). Assertions are scoped to these ids so the suite also passes on a seeded DB.
-- 71 is a student; 72, 73, 74 and 75 are admins: 72 started a lesson, 73 only a consolidation run, 74 only a BAC
-- subject, 75 never used the student app. 72 runs the admin queries.
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000071', 'ais-student@test.local', 'authenticated', 'authenticated', '{}', '{}'),
  ('00000000-0000-0000-0000-000000000072', 'ais-lesson@test.local', 'authenticated', 'authenticated', '{}', '{}'),
  ('00000000-0000-0000-0000-000000000073', 'ais-run@test.local', 'authenticated', 'authenticated', '{}', '{}'),
  ('00000000-0000-0000-0000-000000000074', 'ais-bac@test.local', 'authenticated', 'authenticated', '{}', '{}'),
  ('00000000-0000-0000-0000-000000000075', 'ais-idle@test.local', 'authenticated', 'authenticated', '{}', '{}');
insert into public.admins (user_id) values
  ('00000000-0000-0000-0000-000000000072'), ('00000000-0000-0000-0000-000000000073'),
  ('00000000-0000-0000-0000-000000000074'), ('00000000-0000-0000-0000-000000000075');

insert into nodes (id, parent_id, title) values ('00000000-0000-0000-0000-000000000761', null, 'Root');
insert into lessons (id, node_id, title, status) values
  ('00000000-0000-0000-0000-000000000771', '00000000-0000-0000-0000-000000000761', 'Lesson A', 'published');
insert into consolidation_exercises (id, lesson_id, type, prompt) values
  ('00000000-0000-0000-0000-000000000781', '00000000-0000-0000-0000-000000000771', 'facts', 'Exercise A1');
insert into public.bac_subjects (id, title, year, published) values
  ('00000000-0000-0000-0000-000000000791', 'BAC 2024', 2024, true);

insert into lesson_progress (user_id, lesson_id, finished_at) values
  ('00000000-0000-0000-0000-000000000071', '00000000-0000-0000-0000-000000000771', now()),
  ('00000000-0000-0000-0000-000000000072', '00000000-0000-0000-0000-000000000771', now());
insert into consolidation_runs (user_id, lesson_id, exercise_ids, index) values
  ('00000000-0000-0000-0000-000000000073', '00000000-0000-0000-0000-000000000771',
   array['00000000-0000-0000-0000-000000000781']::uuid[], 0);
insert into public.bac_attempts (user_id, subject_id) values
  ('00000000-0000-0000-0000-000000000074', '00000000-0000-0000-0000-000000000791');
select public.log_student_event('00000000-0000-0000-0000-000000000072', 'lesson_started',
  '00000000-0000-0000-0000-000000000771', null, null, '{}');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000072","role":"authenticated"}';

-- ---------------------------------------------------------------- the list
select results_eq(
  $$ select id, is_admin from public.admin_students('ais-', 50, 0) order by email $$,
  $$ values ('00000000-0000-0000-0000-000000000074'::uuid, true),
            ('00000000-0000-0000-0000-000000000072'::uuid, true),
            ('00000000-0000-0000-0000-000000000073'::uuid, true),
            ('00000000-0000-0000-0000-000000000071'::uuid, false) $$,
  'admins with progress, a consolidation run or a BAC subject are listed and flagged; students are not flagged');
select is((select count(*)::int from public.admin_students('ais-idle', 50, 0)), 0,
  'an admin who never used the student app is not listed');
select is((select total from public.admin_students('ais-', 50, 0) limit 1), 4::bigint, 'the total counts the listed admins');
select results_eq(
  $$ select lessons_finished from public.admin_students('', 1, 0, '00000000-0000-0000-0000-000000000072') $$,
  $$ values (1) $$,
  'an admin with progress is found by id, with the lessons finished');
select is((select count(*)::int from public.admin_students('', 1, 0, '00000000-0000-0000-0000-000000000075')), 0,
  'an admin without activity is not found by id');

-- ---------------------------------------------------------------- the filters
select is((select count(*)::int from public.admin_students('ais-lesson', 50, 0, null, 'trial')), 0,
  'the trial filter leaves admins out');
select is((select count(*)::int from public.admin_students('ais-student', 50, 0, null, 'trial')), 1,
  'the trial filter still lists students without access');
select is((select count(*)::int from public.admin_students('ais-lesson', 50, 0, null, 'full')), 1,
  'the full access filter lists admins');
select is((select count(*)::int from public.admin_students('ais-student', 50, 0, null, 'full')), 0,
  'the full access filter still leaves out students without access');
select is((select count(*)::int from public.admin_students('ais-lesson', 50, 0, null, 'active_today')), 1,
  'an admin with an event today is active today');

-- ---------------------------------------------------------------- read-only detail
select results_eq(
  $$ select lesson_id, finished_at is not null from public.admin_student_progress('00000000-0000-0000-0000-000000000072') $$,
  $$ values ('00000000-0000-0000-0000-000000000771'::uuid, true) $$,
  'admin_student_progress reads an admin''s progress');
select ok(
  exists (select 1 from public.admin_student_events('00000000-0000-0000-0000-000000000072', 10) where kind = 'lesson_started'),
  'admin_student_events reads an admin''s timeline');

-- ---------------------------------------------------------------- account actions still refuse admins
select throws_ok($$ select public.admin_reset_progress('00000000-0000-0000-0000-000000000072') $$,
  'P0001', 'cannot_target_admin', 'an admin''s progress can''t be reset');
select throws_ok($$ select public.admin_suspend_student('00000000-0000-0000-0000-000000000073', '[test] x') $$,
  'P0001', 'cannot_target_admin', 'an admin can''t be suspended');
select throws_ok($$ select public.admin_grant_access('00000000-0000-0000-0000-000000000073', 1, '[test] x') $$,
  'P0001', 'cannot_target_admin', 'access can''t be granted to an admin');

-- ---------------------------------------------------------------- non-admin
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000071","role":"authenticated"}';
select throws_ok($$ select * from public.admin_student_progress('00000000-0000-0000-0000-000000000072') $$,
  '42501', null, 'a student still cannot read progress through the admin RPC');

select * from finish();
rollback;
