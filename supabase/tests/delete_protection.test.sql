begin;
select plan(8);

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'dp-admin@test.local', 'authenticated', 'authenticated', '{}', '{}');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000b1');

-- Root > Child holds a published lesson; Root2 holds only a draft; Root3 holds a published lesson for service_role.
insert into nodes (id, parent_id, title) values
  ('00000000-0000-0000-0000-0000000000b2', null, 'DP Root'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b2', 'DP Child'),
  ('00000000-0000-0000-0000-0000000000b4', null, 'DP Root drafts'),
  ('00000000-0000-0000-0000-0000000000b5', null, 'DP Root service');
insert into lessons (id, node_id, title, status) values
  ('00000000-0000-0000-0000-0000000000b6', '00000000-0000-0000-0000-0000000000b3', 'DP Published', 'published'),
  ('00000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-0000000000b3', 'DP Draft', 'draft'),
  ('00000000-0000-0000-0000-0000000000b8', '00000000-0000-0000-0000-0000000000b4', 'DP Draft only', 'draft'),
  ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-0000000000b5', 'DP Service', 'published');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';

select throws_ok($$ delete from lessons where id = '00000000-0000-0000-0000-0000000000b6' $$,
  'P0001', 'published_lesson_delete', 'admin cannot delete a published lesson');
select lives_ok($$ delete from lessons where id = '00000000-0000-0000-0000-0000000000b7' $$,
  'admin can delete a draft lesson');
select throws_ok($$ delete from nodes where id = '00000000-0000-0000-0000-0000000000b2' $$,
  'P0001', 'published_lesson_delete', 'admin cannot delete a node that cascades into a published lesson');
select lives_ok($$ delete from nodes where id = '00000000-0000-0000-0000-0000000000b4' $$,
  'admin can delete a node holding only drafts');

reset role;
select is((select count(*)::int from lessons where id = '00000000-0000-0000-0000-0000000000b6'), 1,
  'the published lesson still exists after the refused deletes');

set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
select lives_ok($$ delete from lessons where id = '00000000-0000-0000-0000-0000000000b9' $$,
  'service_role can delete a published lesson (JWT role claim)');

-- A bare service_role connection without a JWT claim: auth.role() is not 'authenticated', so the delete is allowed.
set local request.jwt.claims = '';
select lives_ok($$ delete from lessons where id = '00000000-0000-0000-0000-0000000000b6' $$,
  'service_role without a JWT claim can delete a published lesson (auth.role() is not authenticated)');

-- Plain postgres (SQL editor, migrations) is not an authenticated session.
reset role;
set local request.jwt.claims = '';
insert into lessons (id, node_id, title, status) values
  ('00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-0000000000b5', 'DP Postgres', 'published');
select lives_ok($$ delete from lessons where id = '00000000-0000-0000-0000-0000000000ba' $$,
  'plain postgres without claims can delete a published lesson');

select * from finish();
rollback;
