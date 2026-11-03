begin;
select plan(8);

-- Fixtures (as postgres). Ids are scoped so the suite also passes on a seeded DB.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a5', 'ct-student@test.local', 'authenticated', 'authenticated');
insert into nodes (id, parent_id, title) values
  ('00000000-0000-0000-0000-0000000000a6', null, 'Root');
insert into lessons (id, node_id, title, status) values
  ('00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000a6', 'Published', 'published'),
  ('00000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-0000000000a6', 'Draft', 'draft');
insert into cards (lesson_id, type, content) values
  ('00000000-0000-0000-0000-0000000000a7', 'images', '{"images":[],"display":"single"}'),
  ('00000000-0000-0000-0000-0000000000a8', 'text', '{"text":"draft"}');
insert into cards (lesson_id) values ('00000000-0000-0000-0000-0000000000a7');

select is((select type from cards
            where lesson_id = '00000000-0000-0000-0000-0000000000a7' and content = '{}'),
          'text', 'default card type is text (default content is {})');
select throws_ok(
  $$ insert into cards (lesson_id, type) values ('00000000-0000-0000-0000-0000000000a7', 'foo') $$,
  '23514', null, 'unknown card type is rejected');
select throws_ok(
  $$ insert into cards (lesson_id, content) values ('00000000-0000-0000-0000-0000000000a7', '[]') $$,
  '23514', null, 'non-object content is rejected');
select hasnt_column('public', 'cards', 'body', 'legacy body column is gone');
select hasnt_column('public', 'cards', 'image_path', 'legacy image_path column is gone');
select hasnt_column('public', 'cards', 'image_credit', 'legacy image_credit column is gone');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}';

select is((select count(*)::int from cards
            where lesson_id in ('00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000a8')),
          2, 'student sees cards of the published lesson only');
select is((select count(*)::int from cards where lesson_id = '00000000-0000-0000-0000-0000000000a8'),
          0, 'student sees no cards of draft lessons');

select * from finish();
rollback;
