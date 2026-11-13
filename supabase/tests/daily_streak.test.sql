begin;
select plan(14);

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'streak-1@test.local', 'authenticated', 'authenticated', '{}', '{}'),
  ('00000000-0000-0000-0000-0000000000b2', 'streak-2@test.local', 'authenticated', 'authenticated', '{}', '{}');

-- Replaces b1's days with the given ones (as postgres).
create function pg_temp.days(p_days text[]) returns void language sql as $$
  delete from public.student_active_days where user_id = '00000000-0000-0000-0000-0000000000b1';
  insert into public.student_active_days (user_id, day)
  select '00000000-0000-0000-0000-0000000000b1', d::date from unnest(p_days) d
$$;
create function pg_temp.summary(p_today date) returns jsonb language sql as $$
  select private.streak_summary('00000000-0000-0000-0000-0000000000b1', p_today)
$$;

select has_table('public', 'student_active_days', 'student_active_days exists');
select ok((select relrowsecurity from pg_class where oid = 'public.student_active_days'::regclass), 'RLS is on');

select is(pg_temp.summary('2026-11-13'), '{"current":0,"record":0,"today_done":false,"week":[]}'::jsonb, 'no days');

select pg_temp.days(array['2026-11-10', '2026-11-11', '2026-11-12']);
select is(pg_temp.summary('2026-11-12'),
  '{"current":3,"record":3,"today_done":true,"week":["2026-11-10","2026-11-11","2026-11-12"]}'::jsonb,
  'three days ending today');
select is(pg_temp.summary('2026-11-13'),
  '{"current":3,"record":3,"today_done":false,"week":["2026-11-10","2026-11-11","2026-11-12"]}'::jsonb,
  'streak is alive until midnight');
select is(pg_temp.summary('2026-11-14'),
  '{"current":0,"record":3,"today_done":false,"week":["2026-11-10","2026-11-11","2026-11-12"]}'::jsonb,
  'a missed day resets the current streak');

select pg_temp.days(array['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-12', '2026-11-13']);
select is(pg_temp.summary('2026-11-13'),
  '{"current":2,"record":5,"today_done":true,"week":["2026-11-12","2026-11-13"]}'::jsonb,
  'record is the longest run');

select pg_temp.days(array['2026-11-08', '2026-11-09', '2026-11-11', '2026-11-13']);
select is(pg_temp.summary('2026-11-13'),
  '{"current":1,"record":2,"today_done":true,"week":["2026-11-09","2026-11-11","2026-11-13"]}'::jsonb,
  'week is Monday to Sunday');

-- RLS and grants
select pg_temp.days(array['2026-11-10']);
insert into public.student_active_days (user_id, day) values ('00000000-0000-0000-0000-0000000000b2', '2026-11-10');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is((select count(*)::int from public.student_active_days), 1, 'a student sees only their own days');
select throws_ok($$ insert into public.student_active_days (user_id, day) values ('00000000-0000-0000-0000-0000000000b1', '2026-11-11') $$,
  '42501', null, 'clients cannot insert directly');

select public.mark_active_today();
select is((select (public.mark_active_today() ->> 'today_done')::boolean), true, 'mark_active_today reports today done');
select is((select count(*)::int from public.student_active_days
            where day = (now() at time zone 'Europe/Bucharest')::date), 1, 'marking twice stores one row');
select throws_ok($$ select private.streak_summary('00000000-0000-0000-0000-0000000000b1', current_date) $$,
  '42501', null, 'authenticated cannot call private.streak_summary');

set local role anon;
select throws_ok($$ select public.my_streak() $$, '42501', null, 'anon cannot read a streak');

select * from finish();
rollback;
