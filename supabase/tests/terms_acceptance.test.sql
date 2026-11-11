begin;
select plan(15);

-- Fixtures (as postgres). g1, g2 are students; g3 is a suspended student. The auth trigger creates their profiles.
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'g1@test.local', 'authenticated', 'authenticated', '{}', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'g2@test.local', 'authenticated', 'authenticated', '{}', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'g3@test.local', 'authenticated', 'authenticated', '{}', '{}');
update public.profiles set suspended_at = now(), suspended_reason = 'Test'
  where id = '00000000-0000-0000-0000-0000000000a3';

select col_is_null('public', 'profiles', 'age_confirmed_at', 'age_confirmed_at is nullable');
select is((select age_confirmed_at from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), null,
  'new accounts start unconfirmed');

-- ---------------------------------------------------------------- anon
set local role anon;
select throws_ok($$ select public.accept_terms('2026-11-11') $$, '42501', null, 'anon cannot accept terms');
select throws_ok($$ select public.current_terms_version() $$, '42501', null, 'anon cannot read the terms version');

-- ---------------------------------------------------------------- student g1
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select is(public.current_terms_version(), '2026-11-11', 'current terms version (14+ and parental consent)');
select throws_ok($$ update profiles set terms_version = 'x' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501', null, 'a student cannot write terms_version directly');
select throws_ok($$ update profiles set age_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501', null, 'a student cannot write age_confirmed_at directly');
select throws_ok($$ select public.accept_terms('2099-01-01') $$, 'P0001', 'terms_version_mismatch',
  'a wrong version is refused');
select throws_ok($$ select public.accept_terms('2026-11-10') $$, 'P0001', 'terms_version_mismatch',
  'the previous (16+) version is refused');
select lives_ok($$ select public.accept_terms('2026-11-11') $$, 'the current version is accepted');
select is((select terms_version from profiles where id = '00000000-0000-0000-0000-0000000000a1'), '2026-11-11',
  'the student reads their terms_version');
select ok((select age_confirmed_at is not null from profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'the student reads their age_confirmed_at');

-- ---------------------------------------------------------------- the other student is untouched
reset role;
select is((select terms_version from public.profiles where id = '00000000-0000-0000-0000-0000000000a2'), null,
  'another student is unchanged');

-- ---------------------------------------------------------------- suspended student may accept (gate doesn't apply to them)
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select lives_ok($$ select public.accept_terms('2026-11-11') $$, 'a suspended student can still accept');
reset role;
select is((select terms_version from public.profiles where id = '00000000-0000-0000-0000-0000000000a3'), '2026-11-11',
  'the suspended student acceptance is stored');

select * from finish();
rollback;
