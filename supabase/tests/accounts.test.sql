begin;
select plan(48);

-- Fixtures (as postgres). Every assertion is scoped to these ids so the suite also passes on a seeded DB.
-- Users: d1 = student, d2 = admin (also in admins).
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000d1', 'student@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d2', 'admin@test.local', 'authenticated', 'authenticated');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000d2');

insert into nodes (id, parent_id, title) values
  ('00000000-0000-0000-0000-0000000000c1', null, 'Root'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c1', 'Child');
insert into lessons (id, node_id, title, status) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c2', 'Published', 'published'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c2', 'Draft', 'draft');
insert into cards (lesson_id, content) values
  ('00000000-0000-0000-0000-0000000000e1', '{"text":"x"}'),
  ('00000000-0000-0000-0000-0000000000e2', '{"text":"draft"}');
insert into questions (lesson_id, type, prompt, difficulty, options) values
  ('00000000-0000-0000-0000-0000000000e1', 'single_choice', 'pub q', 'easy', '[{"id":"a","text":"x","correct":true}]'),
  ('00000000-0000-0000-0000-0000000000e2', 'single_choice', 'draft q', 'easy', '[{"id":"a","text":"x","correct":true}]');
insert into writing_exercises (lesson_id, prompt, criteria) values
  ('00000000-0000-0000-0000-0000000000e1', 'pub w', 'c'),
  ('00000000-0000-0000-0000-0000000000e2', 'draft w', 'c');
insert into settings (id, welcome_message) values (1, 'Bun venit')
  on conflict (id) do update set welcome_message = excluded.welcome_message;
insert into ai_settings (id, rules) values (1, 'rules')
  on conflict (id) do update set rules = excluded.rules;

-- ---------------------------------------------------------------- anon: nothing is readable
set local role anon;

select is((select count(*)::int from nodes
            where id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2')),
          0, 'anon sees no nodes');
select is((select count(*)::int from lessons
            where id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2')),
          0, 'anon sees no lessons');
select is((select count(*)::int from cards
            where lesson_id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2')),
          0, 'anon sees no cards');
select is((select count(*)::int from questions
            where lesson_id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2')),
          0, 'anon sees no questions');
select is((select count(*)::int from writing_exercises
            where lesson_id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2')),
          0, 'anon sees no writing exercises');
select is((select count(*)::int from settings where id = 1), 0, 'anon sees no settings');

-- ---------------------------------------------------------------- student (authenticated, not in admins)
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';

select is(public.is_admin(), false, 'student: is_admin() is false');
select is((select count(*)::int from nodes
            where id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2')),
          2, 'student sees fixture nodes');
select is((select welcome_message from settings where id = 1), 'Bun venit', 'student sees settings row 1');
select results_eq(
  $$ select title from lessons
      where id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2') $$,
  $$ values ('Published'::text) $$,
  'student sees only the published fixture lesson');
select results_eq(
  $$ select content->>'text' from cards
      where lesson_id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2') $$,
  $$ values ('x'::text) $$,
  'student sees only published fixture cards');
select results_eq(
  $$ select prompt from questions
      where lesson_id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2') $$,
  $$ values ('pub q'::text) $$,
  'student sees only published fixture questions');
select results_eq(
  $$ select prompt from writing_exercises
      where lesson_id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2') $$,
  $$ values ('pub w'::text) $$,
  'student sees only published fixture exercises');
select is((select count(*)::int from ai_settings), 0, 'student cannot read ai_settings');
select throws_ok($$ select count(*) from admins $$, '42501', null, 'student cannot read admins');
select throws_ok(
  $$ insert into lessons (node_id, title) values ('00000000-0000-0000-0000-0000000000c2', 'x') $$,
  '42501', null, 'student cannot insert lessons');
select lives_ok($$ update settings set welcome_message = 'hacked' where id = 1 $$, 'student settings update runs');
select is((select welcome_message from settings where id = 1), 'Bun venit', 'student settings update affects 0 rows');
select lives_ok($$ delete from lessons where id = '00000000-0000-0000-0000-0000000000e1' $$, 'student lesson delete runs');
select is((select count(*)::int from lessons where id = '00000000-0000-0000-0000-0000000000e1'),
          1, 'student lesson delete affects 0 rows');

-- ---------------------------------------------------------------- admin
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';

select is(public.is_admin(), true, 'admin: is_admin() is true');
select is((select count(*)::int from lessons
            where id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2')),
          2, 'admin sees draft lessons too');
select is((select rules from ai_settings where id = 1), 'rules', 'admin reads ai_settings');
select lives_ok(
  $$ insert into lessons (id, node_id, title) values ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000c2', 'New') $$,
  'admin inserts lesson');
select lives_ok(
  $$ update lessons set title = 'Renamed' where id = '00000000-0000-0000-0000-0000000000e3' $$,
  'admin updates lesson');
select is((select title from lessons where id = '00000000-0000-0000-0000-0000000000e3'), 'Renamed', 'admin update took effect');
select lives_ok($$ delete from lessons where id = '00000000-0000-0000-0000-0000000000e3' $$, 'admin deletes lesson');
select is((select count(*)::int from lessons where id = '00000000-0000-0000-0000-0000000000e3'), 0, 'admin delete took effect');

-- ---------------------------------------------------------------- profiles
reset role;
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'ana@test.local', 'authenticated', 'authenticated', '{"full_name":"Ana Pop"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'name@test.local', 'authenticated', 'authenticated', '{"name":"  Ion Ionescu  "}'),
  ('00000000-0000-0000-0000-0000000000f3', 'long@test.local', 'authenticated', 'authenticated',
    jsonb_build_object('full_name', repeat('x', 70))),
  ('00000000-0000-0000-0000-0000000000f5', 'blankfull@test.local', 'authenticated', 'authenticated', '{"full_name":"  ","name":"Ion"}'),
  ('00000000-0000-0000-0000-0000000000f4', 'blank@test.local', 'authenticated', 'authenticated', '{"full_name":"   "}');

select is((select display_name from profiles where id = '00000000-0000-0000-0000-0000000000f1'),
          'Ana Pop', 'new user with full_name gets a profile with that display_name');
select is((select display_name from profiles where id = '00000000-0000-0000-0000-0000000000f2'),
          'Ion Ionescu', 'falls back to trimmed name metadata');
select is((select display_name from profiles where id = '00000000-0000-0000-0000-0000000000f3'),
          repeat('x', 60), 'long names are truncated to 60 chars');
select is((select display_name from profiles where id = '00000000-0000-0000-0000-0000000000f4'),
          null, 'blank name metadata gives a null display_name');
select is((select display_name from profiles where id = '00000000-0000-0000-0000-0000000000f5'),
          'Ion', 'blank full_name falls back to name');
select is((select count(*)::int from auth.users u where not exists (select 1 from profiles p where p.id = u.id)),
          0, 'every auth user has a profile row');
select ok(exists (select 1 from profiles where id = '00000000-0000-0000-0000-0000000000d1' and display_name is null),
          'new user without metadata gets a profile with a null display_name');

-- Backdate updated_at with triggers off, so the update below shows the trigger refreshing it.
set local session_replication_role = replica;
update profiles set updated_at = '2000-01-01' where id = '00000000-0000-0000-0000-0000000000d1';
set local session_replication_role = origin;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';

select results_eq($$ select id from profiles $$,
  $$ values ('00000000-0000-0000-0000-0000000000d1'::uuid) $$,
  'student sees only their own profile (not the admin''s or anyone else''s)');
select lives_ok($$ update profiles set display_name = 'Maria' where id = '00000000-0000-0000-0000-0000000000d1' $$,
  'student updates own display_name');
select is((select display_name from profiles where id = '00000000-0000-0000-0000-0000000000d1'), 'Maria', 'own update took effect');
select ok((select updated_at > '2000-01-01' from profiles where id = '00000000-0000-0000-0000-0000000000d1'),
  'update refreshes updated_at');
select throws_ok($$ update profiles set display_name = '   ' where id = '00000000-0000-0000-0000-0000000000d1' $$,
  '23514', null, 'blank display_name is rejected');
select throws_ok($$ update profiles set display_name = repeat('a', 61) where id = '00000000-0000-0000-0000-0000000000d1' $$,
  '23514', null, '61-char display_name is rejected');
select lives_ok($$ update profiles set display_name = 'Hacked' where id = '00000000-0000-0000-0000-0000000000d2' $$,
  'student update of another profile runs');
select throws_ok($$ insert into profiles (id) values ('00000000-0000-0000-0000-0000000000d1') $$,
  '42501', null, 'student cannot insert profiles');
select throws_ok($$ delete from profiles where id = '00000000-0000-0000-0000-0000000000d1' $$,
  '42501', null, 'student cannot delete profiles');

-- ---------------------------------------------------------------- storage: only admins write images
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('images', 'test/student.png') $$,
  '42501', null, 'student cannot upload to images');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('images', 'test/admin.png') $$,
  'admin uploads to images');

-- ---------------------------------------------------------------- cascade
reset role;
select is((select display_name from profiles where id = '00000000-0000-0000-0000-0000000000d2'),
          null, 'student update of another profile changed nothing');
delete from auth.users where id = '00000000-0000-0000-0000-0000000000d1';
select is((select count(*)::int from profiles where id = '00000000-0000-0000-0000-0000000000d1'),
          0, 'deleting the user removes their profile');

select * from finish();
rollback;
