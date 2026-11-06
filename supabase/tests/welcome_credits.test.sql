begin;
select plan(27);

-- ---------------------------------------------------------------- backfill (before any fixture is inserted)
select is((select count(*)::int from profiles p
            where not exists (select 1 from credit_ledger l where l.user_id = p.id and l.kind = 'welcome')),
          0, 'every pre-existing profile has a welcome row');
select is((select count(*)::int from profiles p
            where (select count(*) from credit_ledger l where l.user_id = p.id and l.kind = 'welcome') <> 1),
          0, 'every pre-existing profile has exactly one welcome row');

-- ---------------------------------------------------------------- schema
select has_schema('private', 'schema private exists');
select has_table('private', 'secrets', 'private.secrets exists');
select is((select octet_length(value) from private.secrets where name = 'welcome_pepper'), 32,
  'the welcome pepper is seeded with 32 random bytes');
select has_table('public', 'welcome_grants', 'public.welcome_grants exists');
select ok((select relrowsecurity from pg_class where oid = 'public.welcome_grants'::regclass),
  'welcome_grants has RLS enabled');
select is((select count(*)::int from pg_constraint where conrelid = 'public.welcome_grants'::regclass and contype = 'f'),
  0, 'welcome_grants has no foreign key');
select is(private.email_fingerprint('  Ion@Test.local '), private.email_fingerprint('ion@test.local'),
  'the fingerprint ignores case and surrounding blanks');
select isnt(private.email_fingerprint('ion@test.local'), private.email_fingerprint('ana@test.local'),
  'different emails give different fingerprints');

-- ---------------------------------------------------------------- the grant on sign-up
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'Ion@Test.local', 'authenticated', 'authenticated', '{"full_name":"Ion Pop"}');
select is((select credit_balance from profiles where id = '00000000-0000-0000-0000-0000000000a1'), 12,
  'a new user gets the 12 welcome credits');
select results_eq(
  $$ select delta, balance_after, kind from credit_ledger where user_id = '00000000-0000-0000-0000-0000000000a1' $$,
  $$ values (12, 12, 'welcome'::text) $$,
  'a new user gets one welcome ledger row');
select is((select display_name from profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'Ion Pop',
  'handle_new_user still sets the display name');
select is(public.grant_welcome_credits('00000000-0000-0000-0000-0000000000a1', 'other@test.local'), false,
  'a second grant for the same user gives nothing');
select is((select credit_balance from profiles where id = '00000000-0000-0000-0000-0000000000a1'), 12,
  'the balance is unchanged after the second grant');

-- Deleting the account cascades the profile and the ledger, but the fingerprint stays.
delete from auth.users where id = '00000000-0000-0000-0000-0000000000a1';
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a2', '  ion@test.local ', 'authenticated', 'authenticated');
select is((select credit_balance from profiles where id = '00000000-0000-0000-0000-0000000000a2'), 0,
  'the same email after deleting the account gets no credits');
select is((select count(*)::int from credit_ledger where user_id = '00000000-0000-0000-0000-0000000000a2' and kind = 'welcome'),
  0, 'the same email after deleting the account gets no welcome row');

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a3', 'ana@test.local', 'authenticated', 'authenticated');
select is((select credit_balance from profiles where id = '00000000-0000-0000-0000-0000000000a3'), 12,
  'a different email gets 12');

update credit_settings set welcome_credits = 15 where id = 1;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a4', 'maria@test.local', 'authenticated', 'authenticated');
select is((select credit_balance from profiles where id = '00000000-0000-0000-0000-0000000000a4'), 15,
  'the next new user gets the changed welcome credits');

-- No email (e.g. a phone sign-up): always granted.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a5', null, 'authenticated', 'authenticated');
select is((select credit_balance from profiles where id = '00000000-0000-0000-0000-0000000000a5'), 15,
  'a user without an email gets the welcome credits');

-- welcome_credits = 0: the fingerprint is recorded and nothing is granted.
update credit_settings set welcome_credits = 0 where id = 1;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a6', 'zero@test.local', 'authenticated', 'authenticated');
select is((select credit_balance from profiles where id = '00000000-0000-0000-0000-0000000000a6'), 0,
  'with welcome_credits = 0 a new user gets nothing');
select is((select count(*)::int from credit_ledger where user_id = '00000000-0000-0000-0000-0000000000a6'), 0,
  'with welcome_credits = 0 there is no ledger row');
select ok(exists (select 1 from welcome_grants where email_hash = private.email_fingerprint('zero@test.local')),
  'with welcome_credits = 0 the fingerprint is still recorded');

-- ---------------------------------------------------------------- service_role writes nothing directly
set local role service_role;
select throws_ok(
  $$ insert into credit_ledger (user_id, delta, balance_after, kind) values ('00000000-0000-0000-0000-0000000000a3', 1, 13, 'purchase') $$,
  '42501', null, 'service_role cannot insert into credit_ledger');

-- ---------------------------------------------------------------- students
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';

select throws_ok($$ select count(*) from welcome_grants $$, '42501', null, 'student cannot read welcome_grants');
select throws_ok($$ select count(*) from private.secrets $$, '42501', null, 'student cannot read private.secrets');
select throws_ok($$ select public.grant_welcome_credits('00000000-0000-0000-0000-0000000000a3', 'x@test.local') $$,
  '42501', null, 'student cannot execute grant_welcome_credits');

select * from finish();
rollback;
