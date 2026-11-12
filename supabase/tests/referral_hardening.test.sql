begin;
select plan(8);

insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'hd-inviter@test.local', 'authenticated', 'authenticated', '{"full_name":"Ana Pop"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'hd-admin@test.local', 'authenticated', 'authenticated', '{}');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000a2');
create temp table t_code as select code from referral_codes where user_id = '00000000-0000-0000-0000-0000000000a1';
grant select on t_code to anon, authenticated;
update referral_settings set enabled = false where id = 1;

-- Programme off: the lookup answers "not valid" and writes nothing (no rate_limits row, whatever the header).
delete from rate_limits where key like 'referral_lookup:%';
set local role anon;
select set_config('request.headers', '{"x-forwarded-for":"9.9.9.9"}', true);
select results_eq($$ select valid, inviter_first_name from referral_lookup((select code from t_code)) $$,
  $$ values (false, null::text) $$, 'off: the lookup is not valid');
reset role;
select is((select count(*)::int from rate_limits where key like 'referral_lookup:%'), 0, 'off: no rate_limits row is created');

update referral_settings set enabled = true where id = 1;

-- A client-controlled first x-forwarded-for entry does not widen the key space: the last entry decides.
set local role anon;
do $$
begin
  for g in 1..20 loop
    perform set_config('request.headers', json_build_object('x-forwarded-for', 'spoof-' || g || ', 7.7.7.7')::text, true);
    perform * from referral_lookup('ZZZZZZZZ');
  end loop;
end $$;
reset role;
select is((select count(*)::int from rate_limits where key like 'referral_lookup:%'), 1,
  'varying the first x-forwarded-for entry still maps to one key');
select ok((select bool_and(key ~ '^referral_lookup:[0-9]{1,4}$') from rate_limits where key like 'referral_lookup:%'),
  'the key is a bounded bucket, not the raw address');

-- Over the limit the lookup raises rate_limited (it does not answer "invalid"); 120 calls pass.
delete from rate_limits where key like 'referral_lookup:%';
set local role anon;
select set_config('request.headers', '{"x-forwarded-for":"8.8.8.8"}', true);
select is((select count(*) filter (where l.valid)::int
             from generate_series(1, 120) g, t_code c, lateral referral_lookup(case when g > 0 then c.code end) l),
  120, 'the lookup allows 120 calls per window');
select throws_ok($$ select * from referral_lookup((select code from t_code)) $$, 'P0001', 'rate_limited',
  'the 121st call raises rate_limited');
reset role;
delete from rate_limits where key like 'referral_lookup:%';

-- The summary has no code for an admin, even when a code row exists for them.
insert into referral_codes (user_id, code) values ('00000000-0000-0000-0000-0000000000a2', 'ADMNHD99')
  on conflict (user_id) do update set code = excluded.code;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select is((select code from my_referral_summary()), null, 'an admin summary has no code');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select isnt((select code from my_referral_summary()), null, 'a student summary still has the code');
reset role;

select * from finish();
rollback;
