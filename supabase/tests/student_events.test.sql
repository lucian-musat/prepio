begin;
select plan(44);

-- Fixtures (as postgres). Assertions are scoped to these ids so the suite also passes on a seeded DB.
-- b1 is a student, b2 an admin. The auth trigger creates their profiles (and the welcome grant).
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'events-student@test.local', 'authenticated', 'authenticated',
   '{"provider":"google"}', '{}'),
  ('00000000-0000-0000-0000-0000000000b2', 'events-admin@test.local', 'authenticated', 'authenticated',
   '{"provider":"email"}', '{}');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000b2');

insert into nodes (id, parent_id, title) values ('00000000-0000-0000-0000-0000000000c1', null, 'Root');
insert into lessons (id, node_id, title, status) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', 'Published', 'published'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c1', 'Draft', 'draft'),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000c1', 'Published 2', 'published'),
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000c1', 'Not started', 'published');
insert into consolidation_exercises (id, lesson_id, type, prompt) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', 'facts', 'x');

-- Events of b1, of one kind.
create function pg_temp.ev(p_kind text) returns setof public.student_events language sql as $$
  select * from public.student_events
   where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = p_kind order by id
$$;
create function pg_temp.n(p_kind text) returns int language sql as $$
  select count(*)::int from public.student_events
   where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = p_kind
$$;

-- ---------------------------------------------------------------- schema
select has_table('public', 'student_events', 'student_events exists');
select ok((select relrowsecurity from pg_class where oid = 'public.student_events'::regclass), 'RLS is on');

-- ---------------------------------------------------------------- registration
select results_eq(
  $$ select kind, details from public.student_events
      where user_id = '00000000-0000-0000-0000-0000000000b1' order by id $$,
  $$ values ('registered'::text, '{"provider":"google"}'::jsonb),
            ('welcome_credits'::text, jsonb_build_object('credits', (select welcome_credits from credit_settings where id = 1))) $$,
  'sign-up logs registered (with the provider), then welcome_credits');

-- ---------------------------------------------------------------- profile changes
update profiles set display_name = 'Ana' where id = '00000000-0000-0000-0000-0000000000b1';
select is(pg_temp.n('name_changed'), 0, 'setting the name for the first time logs nothing');
update profiles set display_name = 'Ana B' where id = '00000000-0000-0000-0000-0000000000b1';
select is(pg_temp.n('name_changed'), 1, 'renaming logs name_changed');
update profiles set display_name = 'Ana B' where id = '00000000-0000-0000-0000-0000000000b1';
select is(pg_temp.n('name_changed'), 1, 'saving the same name logs nothing');

update profiles set learning_mode = 'guided' where id = '00000000-0000-0000-0000-0000000000b1';
select results_eq($$ select details from pg_temp.ev('mode_changed') $$, $$ values ('{"mode":"guided"}'::jsonb) $$,
  'setting the learning mode logs mode_changed with the mode');
update profiles set learning_mode = 'guided', display_name = 'Ana B' where id = '00000000-0000-0000-0000-0000000000b1';
select is(pg_temp.n('mode_changed'), 1, 'saving the same mode logs nothing');
update profiles set learning_mode = 'free' where id = '00000000-0000-0000-0000-0000000000b1';
select results_eq($$ select details from pg_temp.ev('mode_changed') $$,
  $$ values ('{"mode":"guided"}'::jsonb), ('{"mode":"free"}'::jsonb) $$, 'changing the mode logs the new mode');

-- ---------------------------------------------------------------- lesson progress
insert into lesson_progress (user_id, lesson_id, position)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1', '{"card":1}');
select results_eq($$ select lesson_id from pg_temp.ev('lesson_started') $$,
  $$ values ('00000000-0000-0000-0000-0000000000e1'::uuid) $$, 'a progress insert logs lesson_started');
select is(pg_temp.n('lesson_finished'), 0, 'an unfinished insert logs no lesson_finished');

update lesson_progress set finished_at = now()
 where user_id = '00000000-0000-0000-0000-0000000000b1' and lesson_id = '00000000-0000-0000-0000-0000000000e1';
select results_eq($$ select lesson_id from pg_temp.ev('lesson_finished') $$,
  $$ values ('00000000-0000-0000-0000-0000000000e1'::uuid) $$, 'finishing logs lesson_finished');
update lesson_progress set position = '{"card":2}', finished_at = now() + interval '1 minute'
 where user_id = '00000000-0000-0000-0000-0000000000b1' and lesson_id = '00000000-0000-0000-0000-0000000000e1';
select is(pg_temp.n('lesson_finished'), 1, 'updating a finished lesson logs no second lesson_finished');
select is(pg_temp.n('lesson_started'), 1, 'updating the position logs no second lesson_started');

insert into lesson_progress (user_id, lesson_id, finished_at)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e3', now());
select is((select count(*)::int from public.student_events
            where user_id = '00000000-0000-0000-0000-0000000000b1' and lesson_id = '00000000-0000-0000-0000-0000000000e3'
              and kind in ('lesson_started', 'lesson_finished')), 2,
  'an insert that is already finished logs lesson_started and lesson_finished');

-- ---------------------------------------------------------------- consolidation runs
insert into consolidation_runs (user_id, lesson_id, exercise_ids)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1',
        array['00000000-0000-0000-0000-0000000000a1'::uuid]);
select results_eq($$ select lesson_id from pg_temp.ev('consolidation_started') $$,
  $$ values ('00000000-0000-0000-0000-0000000000e1'::uuid) $$, 'a run insert logs consolidation_started');
update consolidation_runs set index = 1
 where user_id = '00000000-0000-0000-0000-0000000000b1' and lesson_id = '00000000-0000-0000-0000-0000000000e1';
select is(pg_temp.n('consolidation_finished'), 0, 'advancing the run logs nothing');
update consolidation_runs set finished_at = now()
 where user_id = '00000000-0000-0000-0000-0000000000b1' and lesson_id = '00000000-0000-0000-0000-0000000000e1';
select results_eq($$ select lesson_id from pg_temp.ev('consolidation_finished') $$,
  $$ values ('00000000-0000-0000-0000-0000000000e1'::uuid) $$, 'finishing the run logs consolidation_finished');
-- The app restarts a finished run in place (same row, finished_at back to null).
update consolidation_runs set index = 0, finished_at = null
 where user_id = '00000000-0000-0000-0000-0000000000b1' and lesson_id = '00000000-0000-0000-0000-0000000000e1';
select is(pg_temp.n('consolidation_started'), 2, 'restarting a finished run logs consolidation_started');
update consolidation_runs set finished_at = now()
 where user_id = '00000000-0000-0000-0000-0000000000b1' and lesson_id = '00000000-0000-0000-0000-0000000000e1';
select is(pg_temp.n('consolidation_finished'), 2, 'finishing the restarted run logs a second consolidation_finished');

-- ---------------------------------------------------------------- credits
create temp table spent on commit drop as
  select * from public.spend_credits('00000000-0000-0000-0000-0000000000b1', 1, '00000000-0000-0000-0000-0000000000a1', 'exercise');
select results_eq($$ select exercise_id, details from pg_temp.ev('check') $$,
  $$ values ('00000000-0000-0000-0000-0000000000a1'::uuid, '{"cost":1,"target":"exercise"}'::jsonb) $$,
  'spend_credits logs check with the exercise, cost and target');
select public.refund_credits((select entry_id from spent));
select results_eq($$ select exercise_id, details from pg_temp.ev('check_refunded') $$,
  $$ values ('00000000-0000-0000-0000-0000000000a1'::uuid, '{"credits":1}'::jsonb) $$,
  'refund_credits logs check_refunded');
select * from public.purchase_credit_package('00000000-0000-0000-0000-0000000000b1',
  (select id from credit_packages where featured and active));
select results_eq($$ select details from pg_temp.ev('purchase') $$,
  $$ select jsonb_build_object('credits', credits) from credit_packages where featured and active $$,
  'purchase_credit_package logs purchase with the credits');
select is(pg_temp.n('check_blocked'), 0, 'a successful spend logs no check_blocked');

-- ---------------------------------------------------------------- student b1
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';

select lives_ok($$ select public.log_app_open() $$, 'student logs an app open');
select lives_ok($$ select public.log_app_open() $$, 'student logs a second app open the same day');
select lives_ok($$ select public.log_test_failed('00000000-0000-0000-0000-0000000000e1') $$,
  'student logs a failed test on a published lesson');
select throws_ok($$ select public.log_test_failed('00000000-0000-0000-0000-0000000000e2') $$,
  'P0001', 'bad_lesson', 'a draft lesson is rejected');
select throws_ok($$ select public.log_test_failed(gen_random_uuid()) $$,
  'P0001', 'bad_lesson', 'an unknown lesson is rejected');
select throws_ok($$ select public.log_test_failed('00000000-0000-0000-0000-0000000000e4') $$,
  'P0001', 'bad_lesson', 'a published lesson the student has not started is rejected');
select is((select count(*)::int from public.student_events), 0, 'student reads no events, not even their own');
select throws_ok(
  $$ insert into public.student_events (user_id, kind) values ('00000000-0000-0000-0000-0000000000b1', 'app_opened') $$,
  '42501', null, 'student cannot insert events');
select throws_ok(
  $$ select public.log_student_event('00000000-0000-0000-0000-0000000000b1', 'app_opened', null, null, null, '{}') $$,
  '42501', null, 'student cannot call log_student_event');

-- ---------------------------------------------------------------- anon
set local role anon;
select throws_ok($$ select public.log_app_open() $$, '42501', null, 'anon cannot log an app open');
select throws_ok($$ select count(*) from public.student_events $$, '42501', null, 'anon cannot read events');

-- ---------------------------------------------------------------- admin b2
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';

select lives_ok($$ select public.admin_adjust_credits('00000000-0000-0000-0000-0000000000b1', 5, 'gift') $$,
  'admin adjusts credits');
select results_eq($$ select admin_id, details from pg_temp.ev('credits_adjusted') $$,
  $$ values ('00000000-0000-0000-0000-0000000000b2'::uuid, '{"delta":5,"reason":"gift"}'::jsonb) $$,
  'admin_adjust_credits logs credits_adjusted with the admin and the reason');
select is(pg_temp.n('app_opened'), 1, 'two app opens on the same day make one row');
select results_eq($$ select lesson_id, details from pg_temp.ev('test_failed') $$,
  $$ values ('00000000-0000-0000-0000-0000000000e1'::uuid, '{}'::jsonb) $$, 'log_test_failed wrote one row');
select is((select count(*)::int from public.student_events where user_id = '00000000-0000-0000-0000-0000000000b1'), 19,
  'admin reads every event of the student');
select throws_ok($$ delete from public.student_events where user_id = '00000000-0000-0000-0000-0000000000b1' $$,
  '42501', null, 'admin cannot delete events directly');

-- ---------------------------------------------------------------- service role
set local role service_role;
select is((select count(*)::int from public.student_events where user_id = '00000000-0000-0000-0000-0000000000b1'), 19,
  'service role reads events');
select throws_ok(
  $$ insert into public.student_events (user_id, kind) values ('00000000-0000-0000-0000-0000000000b1', 'app_opened') $$,
  '42501', null, 'service role cannot insert events');

-- ---------------------------------------------------------------- cascade
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000b1';
select is((select count(*)::int from public.student_events where user_id = '00000000-0000-0000-0000-0000000000b1'), 0,
  'deleting the user deletes their events');

select * from finish();
rollback;
