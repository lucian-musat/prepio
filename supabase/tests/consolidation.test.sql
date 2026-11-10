begin;
select plan(57);

-- Fixtures (as postgres): d1 and d3 are students, d2 is an admin, e1 is published, e2 is a draft.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000d1', 'co1@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d2', 'co2@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d3', 'co3@test.local', 'authenticated', 'authenticated');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000d2');
insert into nodes (id, parent_id, title) values
  ('00000000-0000-0000-0000-0000000000c1', null, 'Root');
insert into lessons (id, node_id, title, status) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', 'Published', 'published'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c1', 'Draft', 'draft');

insert into solution_templates (id, title, exercise_type, points, body) values
  ('00000000-0000-0000-0000-0000000000f1', 'Template', 'essay', 'p', 'b'),
  ('00000000-0000-0000-0000-0000000000f2', 'Unused template', null, '', '');
insert into sources (id, lesson_id, title, author, work, body, position) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', 'Pub source', 'Autor', 'Opera', 'Text public', 0),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000e2', 'Draft source', 'Autor', 'Opera', 'Text draft', 0);
insert into consolidation_exercises (id, lesson_id, position, type, prompt, content, template_id) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1', 4, 'short_answer', 'pub prompt', '{"x":1}', '00000000-0000-0000-0000-0000000000f1'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000e2', 0, 'short_answer', 'draft prompt', '{}', null);
insert into consolidation_exercise_sources (exercise_id, source_id, label, position) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'A', 0),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2', 'A', 0);
insert into consolidation_ai_context (exercise_id, context) values
  ('00000000-0000-0000-0000-0000000000b1', '{"main":"secret","requirements":{}}');
insert into consolidation_attempts (user_id, exercise_id, answer, verdict) values
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000b1', '{"a":1}', 'ok');

-- ---------------------------------------------------------------- schema
select hasnt_table('public', 'writing_exercises', 'writing_exercises is gone');
select has_table('public', 'sources', 'sources exists');
select has_table('public', 'solution_templates', 'solution_templates exists');
select has_table('public', 'consolidation_exercises', 'consolidation_exercises exists');
select has_table('public', 'consolidation_exercise_sources', 'consolidation_exercise_sources exists');
select has_table('public', 'consolidation_ai_context', 'consolidation_ai_context exists');
select has_table('public', 'consolidation_attempts', 'consolidation_attempts exists');
select has_table('public', 'consolidation_runs', 'consolidation_runs exists');

-- ---------------------------------------------------------------- conversion helper (as postgres)
select lives_ok(
  $$ select public.essay_from_writing_exercise('00000000-0000-0000-0000-0000000000e1',
       'Explicați importanța Unirii din 1859 pentru formarea statului român modern, folosind cel puțin două argumente', 'C') $$,
  'essay_from_writing_exercise converts a writing exercise');
select is((select type from consolidation_exercises where lesson_id = '00000000-0000-0000-0000-0000000000e1' and position = 5),
  'essay', 'converted exercise is an essay');
select ok((select char_length(prompt) <= 81 and prompt like '%…' and prompt not like '% …'
             from consolidation_exercises where lesson_id = '00000000-0000-0000-0000-0000000000e1' and position = 5),
  'converted prompt is cut at a word boundary and ends in an ellipsis');
select is((select prompt from consolidation_exercises where lesson_id = '00000000-0000-0000-0000-0000000000e1' and position = 5),
  'Explicați importanța Unirii din 1859 pentru formarea statului român modern…',
  'converted prompt is the expected cut');
select is((select max(position) from consolidation_exercises where lesson_id = '00000000-0000-0000-0000-0000000000e1'),
  5, 'converted exercise goes after the existing ones');
select is((select content->'requirements'->0->>'text' from consolidation_exercises
            where lesson_id = '00000000-0000-0000-0000-0000000000e1' and position = 5),
  'Explicați importanța Unirii din 1859 pentru formarea statului român modern, folosind cel puțin două argumente',
  'requirement text is the full prompt');
select is((select content->'requirements'->0->>'id' from consolidation_exercises
            where lesson_id = '00000000-0000-0000-0000-0000000000e1' and position = 5),
  'r1', 'requirement id is r1');
select is((select c.context->'requirements'->>'r1' from consolidation_ai_context c
             join consolidation_exercises x on x.id = c.exercise_id
            where x.lesson_id = '00000000-0000-0000-0000-0000000000e1' and x.position = 5),
  'C', 'AI context holds the old criteria under r1');
select is((select c.context->>'main' from consolidation_ai_context c
             join consolidation_exercises x on x.id = c.exercise_id
            where x.lesson_id = '00000000-0000-0000-0000-0000000000e1' and x.position = 5),
  '', 'AI context main is empty');
select is((select count(*)::int from consolidation_exercises where lesson_id = '00000000-0000-0000-0000-0000000000e2'
              and type = 'essay'), 0, 'no conversion happened on the draft lesson');

-- ---------------------------------------------------------------- anon
set local role anon;
select throws_ok($$ select count(*) from sources $$, '42501', null, 'anon cannot read sources');
select throws_ok($$ select count(*) from solution_templates $$, '42501', null, 'anon cannot read solution_templates');
select throws_ok($$ select count(*) from consolidation_exercises $$, '42501', null, 'anon cannot read consolidation_exercises');
select throws_ok($$ select count(*) from consolidation_exercise_sources $$, '42501', null, 'anon cannot read consolidation_exercise_sources');
select throws_ok($$ select count(*) from consolidation_ai_context $$, '42501', null, 'anon cannot read consolidation_ai_context');
select throws_ok($$ select count(*) from consolidation_attempts $$, '42501', null, 'anon cannot read consolidation_attempts');
select throws_ok($$ select count(*) from consolidation_runs $$, '42501', null, 'anon cannot read consolidation_runs');

-- ---------------------------------------------------------------- student d1
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';

select is((select count(*)::int from sources where lesson_id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2')),
  1, 'student sees only the published lesson''s sources');
select is((select count(*)::int from consolidation_exercises where lesson_id = '00000000-0000-0000-0000-0000000000e2'),
  0, 'student sees no exercises of the draft lesson');
select is((select count(*)::int from consolidation_exercises where lesson_id = '00000000-0000-0000-0000-0000000000e1'),
  2, 'student sees the exercises of the published lesson');
select is((select count(*)::int from consolidation_exercise_sources
            where exercise_id in ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2')),
  1, 'student sees only the published exercise''s source links');
select is((select count(*)::int from solution_templates where id in ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2')),
  2, 'student reads all solution templates');
select is((select count(*)::int from consolidation_ai_context), 0, 'student cannot read the AI context (RLS hides every row)');

select throws_ok($$ insert into sources (lesson_id, body) values ('00000000-0000-0000-0000-0000000000e1', 'x') $$,
  '42501', null, 'student cannot insert sources');
select throws_ok($$ insert into consolidation_exercises (lesson_id, type, prompt) values ('00000000-0000-0000-0000-0000000000e1', 'essay', 'x') $$,
  '42501', null, 'student cannot insert exercises');
select lives_ok($$ update consolidation_exercises set prompt = 'x' $$, 'student update of exercises is silently filtered out by RLS');
select lives_ok($$ delete from consolidation_exercises $$, 'student delete of exercises is silently filtered out by RLS');
select is((select count(*)::int from consolidation_exercises where prompt = 'x'), 0, 'student update changed nothing');
select is((select count(*)::int from consolidation_exercises where lesson_id = '00000000-0000-0000-0000-0000000000e1'), 2, 'student delete removed nothing');
select throws_ok($$ insert into solution_templates (title) values ('x') $$, '42501', null, 'student cannot insert templates');
select throws_ok($$ insert into consolidation_ai_context (exercise_id, context) values ('00000000-0000-0000-0000-0000000000b2', '{}') $$,
  '42501', null, 'student cannot write the AI context');

select lives_ok(
  $$ insert into consolidation_attempts (exercise_id, answer, verdict) values ('00000000-0000-0000-0000-0000000000b1', '{"a":1}', 'almost') $$,
  'student inserts own attempt');
select lives_ok(
  $$ update consolidation_attempts set verdict = 'ok', feedback = '{"main":"bine"}' where exercise_id = '00000000-0000-0000-0000-0000000000b1' $$,
  'student updates own attempt');
select is((select verdict from consolidation_attempts where exercise_id = '00000000-0000-0000-0000-0000000000b1'), 'ok', 'attempt update took effect');
select is((select count(*)::int from consolidation_attempts where user_id = '00000000-0000-0000-0000-0000000000d3'),
  0, 'student cannot see another student''s attempt');
select throws_ok(
  $$ update consolidation_attempts set verdict = 'maybe' where exercise_id = '00000000-0000-0000-0000-0000000000b1' $$,
  '23514', null, 'an invalid verdict is rejected');

select lives_ok(
  $$ insert into consolidation_runs (lesson_id, exercise_ids, index) values ('00000000-0000-0000-0000-0000000000e1', array['00000000-0000-0000-0000-0000000000b1']::uuid[], 0) $$,
  'student inserts own run');
select lives_ok(
  $$ update consolidation_runs set index = 1, finished_at = now() where lesson_id = '00000000-0000-0000-0000-0000000000e1' $$,
  'student updates own run');
select ok((select finished_at is not null and index = 1 from consolidation_runs where lesson_id = '00000000-0000-0000-0000-0000000000e1'),
  'run update took effect');

-- ---------------------------------------------------------------- admin d2
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';

select lives_ok(
  $$ insert into sources (id, lesson_id, body) values ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000e2', 'x') $$,
  'admin inserts a source');
select lives_ok($$ update consolidation_exercises set prompt = 'edited' where id = '00000000-0000-0000-0000-0000000000b2' $$,
  'admin updates an exercise of a draft lesson');
select is((select prompt from consolidation_exercises where id = '00000000-0000-0000-0000-0000000000b2'), 'edited', 'admin update took effect');
select is((select count(*)::int from consolidation_ai_context where exercise_id = '00000000-0000-0000-0000-0000000000b1'),
  1, 'admin reads the AI context');
select lives_ok($$ insert into consolidation_ai_context (exercise_id, context) values ('00000000-0000-0000-0000-0000000000b2', '{"main":"m","requirements":{}}') $$,
  'admin writes the AI context');
select lives_ok($$ delete from sources where id = '00000000-0000-0000-0000-0000000000a3' $$, 'admin deletes an unused source');

select throws_ok($$ delete from sources where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '23503', null, 'a source used by an exercise cannot be deleted');
select throws_ok($$ delete from solution_templates where id = '00000000-0000-0000-0000-0000000000f1' $$,
  '23503', null, 'a template used by an exercise cannot be deleted');
select lives_ok($$ delete from solution_templates where id = '00000000-0000-0000-0000-0000000000f2' $$, 'admin deletes an unused template');

-- ---------------------------------------------------------------- cascade (as postgres)
reset role;
set local request.jwt.claims = '{"role":"service_role"}'; -- published lessons are only deletable by the service role
delete from lessons where id = '00000000-0000-0000-0000-0000000000e1';
select is(
  (select (select count(*) from sources where lesson_id = '00000000-0000-0000-0000-0000000000e1')
        + (select count(*) from consolidation_exercises where lesson_id = '00000000-0000-0000-0000-0000000000e1')
        + (select count(*) from consolidation_exercise_sources where exercise_id = '00000000-0000-0000-0000-0000000000b1')
        + (select count(*) from consolidation_ai_context where exercise_id = '00000000-0000-0000-0000-0000000000b1')
        + (select count(*) from consolidation_attempts where exercise_id = '00000000-0000-0000-0000-0000000000b1')
        + (select count(*) from consolidation_runs where lesson_id = '00000000-0000-0000-0000-0000000000e1'))::int,
  0, 'deleting a lesson cascades to sources, exercises, links, context, attempts and runs');

select * from finish();
rollback;
