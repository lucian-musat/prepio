begin;
select plan(8);

-- Fixtures (as postgres): d1 is a student, d2 is an admin.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000d1', 'at1@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d2', 'at2@test.local', 'authenticated', 'authenticated');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000d2');
insert into nodes (id, parent_id, title) values
  ('00000000-0000-0000-0000-0000000000c1', null, 'Root');
insert into lessons (id, node_id, title, status) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', 'Lesson', 'published');
insert into consolidation_exercises (id, lesson_id, position, type, prompt, content) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000e1', 0, 'essay', 'p', '{}');
insert into ai_templates (id, title, type, criteria) values
  ('00000000-0000-0000-0000-0000000000a1', 'Linked', 'facts', 'c');
insert into consolidation_ai_template_links (exercise_id, requirement_id, template_id) values
  ('00000000-0000-0000-0000-0000000000b1', '', '00000000-0000-0000-0000-0000000000a1');

-- ---------------------------------------------------------------- schema
select ok(to_regclass('public.ai_templates') is not null and to_regclass('public.consolidation_ai_template_links') is not null,
  'ai_templates and consolidation_ai_template_links exist');
select ok((select bool_and(relrowsecurity) from pg_class
            where oid in ('public.ai_templates'::regclass, 'public.consolidation_ai_template_links'::regclass)),
  'RLS is enabled on both tables');

-- ---------------------------------------------------------------- student d1
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';

select is((select (select count(*) from ai_templates) + (select count(*) from consolidation_ai_template_links))::int,
  0, 'student sees no templates and no links');
select throws_ok($$ insert into ai_templates (title, type, criteria) values ('x', 'facts', 'c') $$,
  '42501', null, 'student cannot insert templates');

-- ---------------------------------------------------------------- admin d2
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';

insert into ai_templates (title, type, criteria) values ('Admin tpl', 'essay_requirement', 'c');
select is((select count(*)::int from ai_templates where title = 'Admin tpl'), 1, 'admin inserts and selects a template');
select throws_ok($$ delete from ai_templates where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '23503', null, 'a linked template cannot be deleted');
select throws_ok($$ insert into ai_templates (title, type, criteria) values ('x', 'bogus', 'c') $$,
  '23514', null, 'an invalid type is rejected');

-- ---------------------------------------------------------------- cascade (as postgres)
reset role;
delete from consolidation_exercises where id = '00000000-0000-0000-0000-0000000000b1';
select is((select count(*)::int from consolidation_ai_template_links where exercise_id = '00000000-0000-0000-0000-0000000000b1'), 0, 'deleting an exercise removes its template links');

select * from finish();
rollback;
