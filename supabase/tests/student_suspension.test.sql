begin;
select plan(43);

-- Fixtures (as postgres). Assertions are scoped to these ids so the suite also passes on a seeded DB.
-- f1 and f2 are students, f3 an admin. The auth trigger creates their profiles.
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'f1@test.local', 'authenticated', 'authenticated', '{}', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'f2@test.local', 'authenticated', 'authenticated', '{}', '{}'),
  ('00000000-0000-0000-0000-0000000000f3', 'f3@test.local', 'authenticated', 'authenticated', '{}', '{}');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000f3');

insert into nodes (id, parent_id, title) values ('00000000-0000-0000-0000-0000000000c1', null, 'Root');
insert into lessons (id, node_id, title, status) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', 'Published', 'published');
insert into cards (lesson_id, content) values ('00000000-0000-0000-0000-0000000000e1', '{"text":"x"}');
insert into consolidation_exercises (id, lesson_id, type, prompt) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', 'facts', 'x');

create function pg_temp.events(p_user uuid, p_kind text) returns setof public.student_events language sql as $$
  select * from public.student_events where user_id = p_user and kind = p_kind order by id
$$;

-- ---------------------------------------------------------------- schema
select has_table('public', 'blocked_emails', 'blocked_emails exists');
select ok((select relrowsecurity from pg_class where oid = 'public.blocked_emails'::regclass), 'blocked_emails has RLS on');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'blocked_emails'), 0,
  'blocked_emails has no policies');
select is(
  (select array_agg(tablename::text order by tablename) from pg_policies
    where schemaname = 'public' and permissive = 'RESTRICTIVE' and policyname like '%not_suspended'),
  array['bac_attempts', 'bac_item_sources', 'bac_items', 'bac_sources', 'bac_subjects',
        'cards', 'consolidation_attempts', 'consolidation_exercise_sources', 'consolidation_exercises',
        'consolidation_runs', 'credit_packages', 'lesson_progress', 'lessons', 'nodes', 'questions', 'settings',
        'solution_templates', 'sources'],
  'every student-facing content table has a restrictive not-suspended policy');
select throws_ok(
  $$ update profiles set suspended_at = now() where id = '00000000-0000-0000-0000-0000000000f2' $$,
  '23514', null, 'a suspension without a reason is rejected');
select throws_ok(
  $$ update profiles set suspended_at = now(), suspended_reason = '  ' where id = '00000000-0000-0000-0000-0000000000f2' $$,
  '23514', null, 'a blank suspension reason is rejected');

-- ---------------------------------------------------------------- admin suspends f1
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}';

select lives_ok($$ select public.admin_adjust_credits('00000000-0000-0000-0000-0000000000f1', 5, 'gift') $$,
  'admin gives the student credits');
select lives_ok($$ select public.admin_suspend_student('00000000-0000-0000-0000-0000000000f1', 'Old') $$,
  'admin suspends a student');
select lives_ok($$ select public.admin_suspend_student('00000000-0000-0000-0000-0000000000f1', 'Test') $$,
  'suspending again replaces the reason');
select throws_ok($$ select public.admin_suspend_student('00000000-0000-0000-0000-0000000000f2', '  ') $$,
  'P0001', 'reason_required', 'a blank reason is rejected');
select throws_ok($$ select public.admin_suspend_student('00000000-0000-0000-0000-0000000000f3', 'x') $$,
  'P0001', 'cannot_target_admin', 'an admin cannot be suspended');
select ok((select count(*) from lessons where id = '00000000-0000-0000-0000-0000000000e1') = 1,
  'admin still reads lessons');

reset role;
select results_eq(
  $$ select suspended_reason, suspended_by, reregistration_blocked, suspended_at is not null from profiles
      where id = '00000000-0000-0000-0000-0000000000f1' $$,
  $$ values ('Test'::text, '00000000-0000-0000-0000-0000000000f3'::uuid, false, true) $$,
  'the profile holds the suspension');
select results_eq(
  $$ select admin_id, details from pg_temp.events('00000000-0000-0000-0000-0000000000f1', 'suspended') $$,
  $$ values ('00000000-0000-0000-0000-0000000000f3'::uuid, '{"reason":"Old"}'::jsonb),
            ('00000000-0000-0000-0000-0000000000f3'::uuid, '{"reason":"Test"}'::jsonb) $$,
  'each suspension logs suspended with the admin and the reason');
select is((select count(*)::int from student_events
            where user_id = '00000000-0000-0000-0000-0000000000f1' and kind in ('name_changed', 'mode_changed')), 0,
  'a suspension logs no profile-change events');

-- ---------------------------------------------------------------- suspended student f1
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';

select ok(public.is_suspended(), 'is_suspended() is true for the suspended student');
select is((select count(*)::int from lessons), 0, 'suspended student reads no lessons');
select is((select count(*)::int from cards), 0, 'suspended student reads no cards');
select is((select count(*)::int from consolidation_exercises), 0, 'suspended student reads no consolidation exercises');
select is((select count(*)::int from nodes), 0, 'suspended student reads no nodes');
select throws_ok(
  $$ insert into lesson_progress (lesson_id) values ('00000000-0000-0000-0000-0000000000e1') $$,
  '42501', null, 'suspended student cannot write lesson progress');
select results_eq($$ select suspended_reason from profiles $$, $$ values ('Test'::text) $$,
  'suspended student reads their own profile, with the reason');
select results_eq($$ select user_id, delta from credit_ledger where kind = 'admin' $$,
  $$ values ('00000000-0000-0000-0000-0000000000f1'::uuid, 5) $$,
  'suspended student reads their own credit ledger');
select is((select count(*)::int from credit_orders), 0, 'credit_orders select works for a suspended student');
select throws_ok($$ update profiles set suspended_at = null $$, '42501', null,
  'student cannot clear their suspension');
select throws_ok($$ select public.admin_reactivate_student('00000000-0000-0000-0000-0000000000f1') $$,
  '42501', null, 'student cannot reactivate themselves');

-- ---------------------------------------------------------------- non-suspended student f2
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}';

select ok(not public.is_suspended(), 'is_suspended() is false for an active student');
select is((select count(*)::int from lessons where id = '00000000-0000-0000-0000-0000000000e1'), 1,
  'an active student still reads lessons');
select throws_ok($$ select public.admin_suspend_student('00000000-0000-0000-0000-0000000000f1', 'x') $$,
  '42501', null, 'a student cannot suspend');
select throws_ok($$ select public.block_student_email('00000000-0000-0000-0000-0000000000f1', 'x') $$,
  '42501', null, 'a student cannot block an email');
select throws_ok($$ select * from public.blocked_emails $$, '42501', null, 'authenticated cannot read blocked_emails');

-- ---------------------------------------------------------------- reactivation
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}';
select lives_ok($$ select public.admin_reactivate_student('00000000-0000-0000-0000-0000000000f1') $$,
  'admin reactivates the student');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select is((select count(*)::int from lessons where id = '00000000-0000-0000-0000-0000000000e1'), 1,
  'the reactivated student reads lessons again');

reset role;
select results_eq(
  $$ select admin_id from pg_temp.events('00000000-0000-0000-0000-0000000000f1', 'reactivated') $$,
  $$ values ('00000000-0000-0000-0000-0000000000f3'::uuid) $$, 'reactivation logs reactivated with the admin');
select results_eq(
  $$ select suspended_at, suspended_reason, suspended_by, reregistration_blocked from profiles
      where id = '00000000-0000-0000-0000-0000000000f1' $$,
  $$ values (null::timestamptz, null::text, null::uuid, false) $$, 'reactivation clears the suspension');

-- ---------------------------------------------------------------- blocked re-registration
set local role service_role;
select throws_ok($$ select public.block_student_email('00000000-0000-0000-0000-0000000000f1', ' ') $$,
  'P0001', 'reason_required', 'blocking needs a reason');
select lives_ok($$ select public.block_student_email('00000000-0000-0000-0000-0000000000f1', 'Abuz') $$,
  'service role blocks the email');
select throws_ok($$ select * from public.blocked_emails $$, '42501', null, 'service role cannot read blocked_emails');

reset role;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000f1';
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f4', ' F1@Test.local ', 'authenticated', 'authenticated', '{}', '{}');
select results_eq(
  $$ select suspended_reason, suspended_by, reregistration_blocked, suspended_at is not null from profiles
      where id = '00000000-0000-0000-0000-0000000000f4' $$,
  $$ values ('Abuz'::text, null::uuid, true, true) $$,
  'a blocked email signs up suspended, with the reason and reregistration_blocked');
select results_eq(
  $$ select admin_id, details from pg_temp.events('00000000-0000-0000-0000-0000000000f4', 'suspended') $$,
  $$ values (null::uuid, '{"reason":"Abuz","blocked":true}'::jsonb) $$,
  'the blocked sign-up logs suspended with blocked: true');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}';
select lives_ok($$ select public.admin_reactivate_student('00000000-0000-0000-0000-0000000000f4') $$,
  'admin reactivates the blocked account');

reset role;
select is((select reregistration_blocked from profiles where id = '00000000-0000-0000-0000-0000000000f4'), false,
  'reactivation clears reregistration_blocked');
delete from auth.users where id = '00000000-0000-0000-0000-0000000000f4';
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f5', 'f1@test.local', 'authenticated', 'authenticated', '{}', '{}');
select results_eq(
  $$ select suspended_at, reregistration_blocked from profiles where id = '00000000-0000-0000-0000-0000000000f5' $$,
  $$ values (null::timestamptz, false) $$, 'after reactivation the email signs up normally');

select * from finish();
rollback;
