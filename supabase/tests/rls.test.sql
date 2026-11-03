begin;
select plan(13);

-- Fixtures (as postgres). Every assertion is scoped to these ids so the suite also passes on a seeded DB.
insert into nodes (id, parent_id, title) values
  ('00000000-0000-0000-0000-0000000000a1', null, 'Root'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1', 'Child');

insert into lessons (id, node_id, title, status) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a2', 'Published', 'published'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2', 'Draft', 'draft');

insert into cards (lesson_id, content) values
  ('00000000-0000-0000-0000-0000000000b1', '{"text":"x"}'),
  ('00000000-0000-0000-0000-0000000000b2', '{"text":"draft"}');
insert into questions (lesson_id, type, prompt, difficulty, options) values
  ('00000000-0000-0000-0000-0000000000b1', 'single_choice', 'pub q', 'easy', '[{"id":"a","text":"x","correct":true}]'),
  ('00000000-0000-0000-0000-0000000000b2', 'single_choice', 'draft q', 'easy', '[{"id":"a","text":"x","correct":true}]');
insert into writing_exercises (lesson_id, prompt, criteria) values
  ('00000000-0000-0000-0000-0000000000b1', 'pub w', 'c'),
  ('00000000-0000-0000-0000-0000000000b2', 'draft w', 'c');

insert into settings (id, welcome_message) values (1, 'Bun venit')
  on conflict (id) do update set welcome_message = excluded.welcome_message;
insert into ai_settings (id, rules) values (1, 'rules')
  on conflict (id) do update set rules = excluded.rules;

-- Admin user (students — authenticated but not in admins — are covered in accounts.test.sql).
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000d9', 'rls-admin@test.local', 'authenticated', 'authenticated');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000d9');

-- Anonymous: nothing is readable without an account.
set local role anon;

select is(
  (select (select count(*) from nodes
            where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2'))
        + (select count(*) from settings where id = 1)
        + (select count(*) from lessons
            where id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2'))
        + (select count(*) from cards
            where lesson_id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2'))
        + (select count(*) from questions
            where lesson_id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2'))
        + (select count(*) from writing_exercises
            where lesson_id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2')))::int,
  0, 'anon sees no nodes, settings, lessons, cards, questions or exercises');
select is((select count(*)::int from ai_settings), 0, 'anon cannot read ai_settings');
select throws_ok(
  $$ insert into lessons (node_id, title) values ('00000000-0000-0000-0000-0000000000a2', 'x') $$,
  null, null, 'anon cannot insert lessons');
select throws_ok(
  $$ select count(*) from rate_limits $$,
  '42501', null, 'anon cannot read rate_limits');

-- Admin (authenticated and in admins)
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d9","role":"authenticated"}';

select is((select count(*)::int from lessons
            where id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2')),
          2, 'admin sees draft lessons too');
select is((select rules from ai_settings where id = 1), 'rules', 'admin reads ai_settings');
select lives_ok(
  $$ insert into lessons (id, node_id, title) values ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a2', 'New') $$,
  'admin inserts lesson');
select lives_ok(
  $$ update lessons set title = 'Renamed' where id = '00000000-0000-0000-0000-0000000000b3' $$,
  'admin updates lesson');
select is(
  (select title from lessons where id = '00000000-0000-0000-0000-0000000000b3'), 'Renamed',
  'update took effect');
select lives_ok(
  $$ delete from lessons where id = '00000000-0000-0000-0000-0000000000b3' $$,
  'admin deletes lesson');
select throws_ok(
  $$ select count(*) from rate_limits $$,
  '42501', null, 'authenticated cannot read rate_limits');

-- Constraints and cascade (as postgres)
reset role;
select throws_ok(
  $$ update ai_settings set grade_max = grade_min $$,
  '23514', null, 'ai_settings rejects grade_max <= grade_min');

delete from nodes where id = '00000000-0000-0000-0000-0000000000a1';
select is(
  (select (select count(*) from nodes
            where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2'))
        + (select count(*) from lessons
            where id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2'))
        + (select count(*) from cards
            where lesson_id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2'))
        + (select count(*) from questions
            where lesson_id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2'))
        + (select count(*) from writing_exercises
            where lesson_id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2')))::int,
  0, 'deleting a node cascades to children, lessons and their content');

select * from finish();
rollback;
