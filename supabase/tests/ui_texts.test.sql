begin;
select plan(14);

insert into auth.users (id, email, aud, role, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000000' || x)::uuid, 'ut-' || x || '@test.local', 'authenticated', 'authenticated', '{}'
  from unnest(array['b1','ad']) x;
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000ad');
insert into public.ui_texts (key, value) values ('home.hero.welcomeBack', 'Salut, {nume}!');

select ok((select relrowsecurity from pg_class where oid = 'public.ui_texts'::regclass), 'ui_texts has RLS enabled');

-- anon
set local role anon;
select is((select count(*)::int from public.ui_texts), 1, 'anon can select');

-- student
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is((select count(*)::int from public.ui_texts), 1, 'student sees rows');
select throws_ok($$ insert into public.ui_texts (key, value) values ('home.x', 'v') $$, '42501', null, 'student cannot insert');
with u as (update public.ui_texts set value = 'hack' returning 1) select is((select count(*)::int from u), 0, 'student update affects 0 rows');
with d as (delete from public.ui_texts returning 1) select is((select count(*)::int from d), 0, 'student delete affects 0 rows');

-- admin
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}';
select lives_ok($$ insert into public.ui_texts (key, value) values ('home.hero.welcome', 'Ceva') $$, 'admin can insert');
select throws_ok($$ insert into public.ui_texts (key, value) values ('Home.x', 'v') $$, '23514', null, 'key check rejects uppercase start');
select throws_ok($$ insert into public.ui_texts (key, value) values ('home', 'v') $$, '23514', null, 'key check rejects a key without a dot');

reset role;
update public.ui_texts set updated_at = now() - interval '1 day' where key = 'home.hero.welcome';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}';
with u as (update public.ui_texts set value = 'Alt' where key = 'home.hero.welcome' returning 1) select is((select count(*)::int from u), 1, 'admin can update');
select ok((select updated_at > now() - interval '1 hour' from public.ui_texts where key = 'home.hero.welcome'), 'updated_at moves on update');
with d as (delete from public.ui_texts where key = 'home.hero.welcome' returning 1) select is((select count(*)::int from d), 1, 'admin can delete');
select is((select count(*)::int from public.ui_texts), 1, 'other row remains');

reset role;
select is((select count(*)::int from public.ui_texts where key = 'home.hero.welcome'), 0, 'welcome override removed');

select * from finish();
rollback;
