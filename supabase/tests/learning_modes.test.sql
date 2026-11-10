begin;
select plan(22);

-- Fixtures (as postgres): d1 and d3 are students, e1 is a published lesson.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000d1', 'lm1@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d3', 'lm3@test.local', 'authenticated', 'authenticated');
insert into nodes (id, parent_id, title) values
  ('00000000-0000-0000-0000-0000000000c1', null, 'Root');
insert into lessons (id, node_id, title, status) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', 'Published', 'published'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c1', 'Other', 'published');
insert into lesson_progress (user_id, lesson_id, position) values
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000e1', '{"phase":"cards"}');
-- Full access, so progress writes on any lesson are allowed (trial limits are tested in paid_access.test.sql).
update profiles set access_until = now() + interval '1 day'
 where id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d3');

select has_column('public', 'profiles', 'learning_mode', 'profiles.learning_mode exists');
select ok(exists (select 1 from profiles where id = '00000000-0000-0000-0000-0000000000d1' and learning_mode is null),
  'new profiles start with a null learning_mode');

-- ---------------------------------------------------------------- anon
set local role anon;
select throws_ok($$ select count(*) from lesson_progress $$, '42501', null, 'anon cannot read lesson_progress');

-- ---------------------------------------------------------------- student d1
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';

select lives_ok($$ update profiles set learning_mode = 'free' where id = '00000000-0000-0000-0000-0000000000d1' $$,
  'student sets own learning_mode');
select is((select learning_mode from profiles where id = '00000000-0000-0000-0000-0000000000d1'), 'free', 'learning_mode took effect');
select throws_ok($$ update profiles set learning_mode = 'other' where id = '00000000-0000-0000-0000-0000000000d1' $$,
  '23514', null, 'invalid learning_mode is rejected');

select lives_ok(
  $$ insert into lesson_progress (lesson_id, position) values ('00000000-0000-0000-0000-0000000000e1', '{"phase":"cards","index":0}') $$,
  'student inserts own progress');
select is((select user_id from lesson_progress where lesson_id = '00000000-0000-0000-0000-0000000000e1'),
  '00000000-0000-0000-0000-0000000000d1'::uuid, 'user_id defaults to the caller');
select lives_ok(
  $$ update lesson_progress set finished_at = now() where lesson_id = '00000000-0000-0000-0000-0000000000e1' $$,
  'student updates own finished_at');
select ok((select finished_at is not null from lesson_progress where lesson_id = '00000000-0000-0000-0000-0000000000e1'),
  'finished_at took effect');

-- PostgREST-style upsert: sets every payload column, including lesson_id.
select lives_ok(
  $$ insert into public.lesson_progress (lesson_id, position) values ('00000000-0000-0000-0000-0000000000e1', '{"phase":"cards","index":1,"results":{}}')
       on conflict (user_id, lesson_id) do update set lesson_id = excluded.lesson_id, position = excluded.position $$,
  'upsert on an existing row (update path) works');
select lives_ok(
  $$ insert into public.lesson_progress (lesson_id, position) values ('00000000-0000-0000-0000-0000000000e2', '{"phase":"cards","index":1,"results":{}}')
       on conflict (user_id, lesson_id) do update set lesson_id = excluded.lesson_id, position = excluded.position $$,
  'upsert on a new row (insert path) works');
select is((select position->>'index' from lesson_progress where lesson_id = '00000000-0000-0000-0000-0000000000e1'),
  '1', 'upsert updated position');
select ok((select finished_at is not null from lesson_progress where lesson_id = '00000000-0000-0000-0000-0000000000e1'),
  'position-only upsert leaves finished_at intact');

select is((select count(*)::int from lesson_progress where user_id = '00000000-0000-0000-0000-0000000000d3'),
  0, 'student does not see another student''s progress');
select lives_ok(
  $$ update lesson_progress set finished_at = now() where user_id = '00000000-0000-0000-0000-0000000000d3' $$,
  'update of another student''s row runs');
select throws_ok(
  $$ insert into lesson_progress (user_id, lesson_id) values ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000e2') $$,
  '42501', null, 'cannot insert progress for another user');
select throws_ok($$ delete from lesson_progress $$, '42501', null, 'student cannot delete progress');

-- ---------------------------------------------------------------- cascades
reset role;
select ok((select finished_at is null from lesson_progress where user_id = '00000000-0000-0000-0000-0000000000d3'),
  'update of another student''s row affected nothing');
set local request.jwt.claims = '{"role":"service_role"}'; -- published lessons are only deletable by the service role
delete from lessons where id = '00000000-0000-0000-0000-0000000000e2';
select is((select count(*)::int from lesson_progress where lesson_id = '00000000-0000-0000-0000-0000000000e2'),
  0, 'deleting a lesson removes its progress');
delete from auth.users where id = '00000000-0000-0000-0000-0000000000d1';
select is((select count(*)::int from lesson_progress where user_id = '00000000-0000-0000-0000-0000000000d1'),
  0, 'deleting the user removes their progress');
select is((select count(*)::int from lesson_progress where user_id = '00000000-0000-0000-0000-0000000000d3'),
  1, 'other students keep their progress');

select * from finish();
rollback;
