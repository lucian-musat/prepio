begin;
select plan(76);

-- Offer: 15000 bani, 100 bonus credits, 3 months (the defaults). Referrals: on, threshold 5, 40 credits, cap 100.
update access_settings set price_bani = 15000, bonus_credits = 100, duration_months = 3 where id = 1;
update referral_settings set enabled = true, threshold = 5, credits_per_invitee = 40, max_rewarded = 100 where id = 1;

-- Inviters a1..a9, admin inviter ad, admin ae (for admin_grant_access); invitees b1..b6, c1..c13.
insert into auth.users (id, email, aud, role, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000000' || x)::uuid, 'rw-' || x || '@test.local', 'authenticated', 'authenticated', '{}'
  from unnest(array['a1','a2','a3','a4','a5','a6','a7','a8','a9','ad','ae',
                    'b1','b2','b3','b4','b5','b6',
                    'c1','c2','c3','c4','c5','c6','c7','c8','c9','ca','cb','cc','cd']) x;
insert into public.admins (user_id) values
  ('00000000-0000-0000-0000-0000000000ad'), ('00000000-0000-0000-0000-0000000000ae');

-- Referral rows as referral_attach leaves them (registered), oldest first.
insert into referrals (inviter_id, invitee_id, created_at)
select ('00000000-0000-0000-0000-0000000000' || v.inviter)::uuid, ('00000000-0000-0000-0000-0000000000' || v.invitee)::uuid,
       now() - (v.ord || ' minutes')::interval
  from (values ('a1','b1',60), ('a1','b2',59), ('a1','b3',58), ('a1','b4',57), ('a1','b5',56), ('a1','b6',55),
               ('a2','a3',50),
               ('a3','c1',49), ('a3','c2',48), ('a3','c3',47), ('a3','c4',46),
               ('a4','c5',45), ('a5','c6',44), ('a5','c7',43),
               ('a6','c8',42), ('a6','c9',41), ('a6','ca',40),
               ('a7','cb',39), ('a8','cc',38), ('a9','cd',37)) v(inviter, invitee, ord);
update profiles set display_name = 'Maria Ionescu' where id = '00000000-0000-0000-0000-0000000000b1';

create function pg_temp.buy(p_user text) returns void language sql as $$
  select null from public.purchase_access(('00000000-0000-0000-0000-0000000000' || p_user)::uuid, 15000, 100, 3);
$$;
create function pg_temp.uid(p text) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-0000000000' || p)::uuid;
$$;
create function pg_temp.state(p_invitee text) returns text language sql as $$
  select state from public.referrals where invitee_id = pg_temp.uid(p_invitee);
$$;
create function pg_temp.referral_credits(p_user text) returns int language sql as $$
  select coalesce(sum(delta), 0)::int from public.credit_ledger where user_id = pg_temp.uid(p_user) and kind = 'referral';
$$;
create function pg_temp.reward_grants(p_user text) returns int language sql as $$
  select count(*)::int from public.access_ledger where user_id = pg_temp.uid(p_user) and kind = 'referral_reward';
$$;

-- ---------------------------------------------------------------- deferred from Task 1
select lives_ok($$ insert into access_ledger (user_id, kind, months, until_after)
                   values (pg_temp.uid('a9'), 'referral_reward', 3, now()) $$,
  'a referral_reward ledger row needs no reason');
select throws_ok($$ insert into access_ledger (user_id, kind, months, until_after)
                    values (pg_temp.uid('a9'), 'admin_grant', 3, now()) $$,
  '23514', null, 'an admin_grant ledger row still needs a reason');
delete from access_ledger where user_id = pg_temp.uid('a9');

-- ---------------------------------------------------------------- trial inviter, threshold 5
select pg_temp.buy('b1');
select results_eq($$ select state, invitee_first_name, first_paid_at is not null, reward_credits
                       from referrals where invitee_id = pg_temp.uid('b1') $$,
  $$ values ('pending'::text, 'Maria'::text, true, null::int) $$,
  'trial inviter: first paying invitee is pending, first name refreshed from the profile');
select is((select access_until from profiles where id = pg_temp.uid('a1')), null, 'trial inviter: no access yet');
select pg_temp.buy('b2');
select pg_temp.buy('b3');
select pg_temp.buy('b4');
select is((select count(*)::int from referrals where inviter_id = pg_temp.uid('a1') and state = 'pending'), 4,
  'four paying invitees are pending');
select is(pg_temp.reward_grants('a1'), 0, 'below the threshold nothing is granted');
create temp table t_a1_bal as select credit_balance from profiles where id = pg_temp.uid('a1');
select pg_temp.buy('b5');
select is(pg_temp.reward_grants('a1'), 1, 'the fifth paying invitee grants one access period');
select results_eq($$ select months, until_before, until_after, reason, order_id, admin_id
                       from access_ledger where user_id = pg_temp.uid('a1') and kind = 'referral_reward' $$,
  $$ select 3, null::timestamptz, now() + interval '3 months', null::text, null::uuid, null::uuid $$,
  'the grant is duration_months from now, no reason, no order, no admin');
select is((select access_until from profiles where id = pg_temp.uid('a1')), now() + interval '3 months',
  'the inviter now has access for duration_months');
select is((select credit_balance from profiles where id = pg_temp.uid('a1')), (select credit_balance from t_a1_bal),
  'the free access carries no bonus credits');
select is((select count(*)::int from access_orders where user_id = pg_temp.uid('a1')), 0, 'the grant is not an order');
select is((select count(*)::int from referrals where inviter_id = pg_temp.uid('a1') and state = 'consumed_access'
             and access_ledger_id = (select id from access_ledger where user_id = pg_temp.uid('a1') and kind = 'referral_reward')),
  5, 'all five are consumed_access and point at the grant');
select is((select count(*)::int from referrals where inviter_id = pg_temp.uid('a1') and state = 'pending'), 0,
  'nothing left pending');
select results_eq($$ select (details ->> 'months')::int, (details ->> 'until')::timestamptz, (details ->> 'invitees')::int
                       from student_events where user_id = pg_temp.uid('a1') and kind = 'referral_access' $$,
  $$ values (3, now() + interval '3 months', 5) $$, 'referral_access is logged once for the inviter');

select pg_temp.buy('b6');
select results_eq($$ select state, reward_credits from referrals where invitee_id = pg_temp.uid('b6') $$,
  $$ values ('converted_credits'::text, 40) $$, 'the sixth invitee (inviter now has access) is converted_credits');
select is(pg_temp.referral_credits('a1'), 40, 'the inviter gets 40 credits for the sixth invitee');
select is((select count(*)::int from credit_ledger l join referrals r on r.id = l.referral_id
            where l.user_id = pg_temp.uid('a1') and l.kind = 'referral' and r.invitee_id = pg_temp.uid('b6')
              and r.credit_ledger_id = l.id), 1,
  'the credit row references the invitee through referral_id and back through credit_ledger_id');
select is(pg_temp.reward_grants('a1'), 1, 'still a single access grant');
select is((select count(*)::int from student_events where user_id = pg_temp.uid('a1') and kind = 'referral_credits'),
  (select count(*)::int from credit_ledger where user_id = pg_temp.uid('a1') and kind = 'referral'),
  'exactly one referral_credits event per referral credit row');
select results_eq($$ select m.kind, m.details from credit_ledger l, student_event_of_ledger(l) m
                      where l.user_id = pg_temp.uid('a1') and l.kind = 'referral' $$,
  $$ values ('referral_credits'::text, '{"credits": 40}'::jsonb) $$,
  'student_event_of_ledger maps a referral row to referral_credits');
select is((select count(*)::int from student_events where user_id = pg_temp.uid('a1') and kind = 'referral_access'), 1,
  'referral_access is not logged for a credit reward');

-- The invitees themselves get only their normal purchase.
select is((select count(*)::int from credit_ledger where user_id = pg_temp.uid('b6') and kind = 'referral'), 0,
  'the invitee gets no referral credits');

-- ---------------------------------------------------------------- idempotency
create temp table t_before as
  select (select count(*) from referrals where inviter_id = pg_temp.uid('a1')) n,
         (select string_agg(state || coalesce(first_paid_at::text, ''), ',' order by id) from referrals where inviter_id = pg_temp.uid('a1')) s,
         pg_temp.referral_credits('a1') c, pg_temp.reward_grants('a1') g,
         (select access_until from profiles where id = pg_temp.uid('a1')) u,
         (select count(*) from student_events where user_id = pg_temp.uid('a1')) e;
select pg_temp.buy('b6');
select pg_temp.buy('b1');
select results_eq($$ select (select count(*) from referrals where inviter_id = pg_temp.uid('a1')),
                            (select string_agg(state || coalesce(first_paid_at::text, ''), ',' order by id) from referrals where inviter_id = pg_temp.uid('a1')),
                            pg_temp.referral_credits('a1'), pg_temp.reward_grants('a1'),
                            (select access_until from profiles where id = pg_temp.uid('a1')),
                            (select count(*) from student_events where user_id = pg_temp.uid('a1')) $$,
  $$ select n, s, c, g, u, e from t_before $$,
  'a second purchase by an invitee changes nothing for the inviter');
select is((select count(*)::int from access_orders where user_id = pg_temp.uid('b1') and status = 'approved'), 2,
  'the renewal itself is still recorded');

-- ---------------------------------------------------------------- inviter with active access
update profiles set access_until = now() + interval '10 days' where id = pg_temp.uid('a2');
create temp table t_a2_bal as select credit_balance from profiles where id = pg_temp.uid('a2');

-- ---------------------------------------------------------------- inviter with 4 pending buys (and is an invitee of a2)
select pg_temp.buy('c1');
select pg_temp.buy('c2');
select pg_temp.buy('c3');
select pg_temp.buy('c4');
select is((select count(*)::int from referrals where inviter_id = pg_temp.uid('a3') and state = 'pending'), 4,
  'a3 has four pending invitees');
create temp table t_a3_bal as select credit_balance from profiles where id = pg_temp.uid('a3');
create temp table t_a3_res as
  select * from purchase_access(pg_temp.uid('a3'), 15000, 100, 3);
select is(pg_temp.referral_credits('a3'), 160, 'the inviter''s own purchase converts four pending into 160 credits');
select is((select count(*)::int from credit_ledger where user_id = pg_temp.uid('a3') and kind = 'referral'
             and delta = 40 and referral_id is not null), 4, 'one 40-credit row per converted invitee, each with referral_id');
select is((select count(*)::int from referrals r join credit_ledger l on l.id = r.credit_ledger_id and l.referral_id = r.id
            where r.inviter_id = pg_temp.uid('a3') and r.state = 'converted_credits' and r.reward_credits = 40), 4,
  'four rows converted_credits with the snapshot and the ledger link');
select is((select count(*)::int from credit_ledger where user_id = pg_temp.uid('a3') and kind = 'access_bonus' and delta = 100), 1,
  'the normal purchase bonus is still given');
select is((select credit_balance from profiles where id = pg_temp.uid('a3')), (select credit_balance + 260 from t_a3_bal),
  'balance grew by bonus plus conversions');
select is((select balance from t_a3_res), (select credit_balance from profiles where id = pg_temp.uid('a3')),
  'purchase_access returns the final balance');
select results_eq($$ select bonus, access_until from t_a3_res $$, $$ values (100, now() + interval '3 months') $$,
  'purchase_access return shape is unchanged');
select is(pg_temp.reward_grants('a3'), 0, 'the conversion grants no access');
select is((select count(*)::int from student_events where user_id = pg_temp.uid('a3') and kind = 'referral_credits'), 4,
  'one referral_credits event per converted invitee');

-- a3 was also a2's invitee: a2 has access, so a2 gets 40 credits now.
select results_eq($$ select state, reward_credits from referrals where invitee_id = pg_temp.uid('a3') $$,
  $$ values ('converted_credits'::text, 40) $$, 'inviter with access: the paying invitee is converted_credits');
select is(pg_temp.referral_credits('a2'), 40, 'inviter with access gets +40 credits immediately');
select is((select credit_balance from profiles where id = pg_temp.uid('a2')), (select credit_balance + 40 from t_a2_bal),
  'the inviter balance grew by 40');
select is(pg_temp.reward_grants('a2'), 0, 'inviter with access gets no access grant');

-- A second purchase by an inviter with nothing pending converts nothing.
select pg_temp.buy('a3');
select is(pg_temp.referral_credits('a3'), 160, 'a later purchase with nothing pending converts nothing');

-- ---------------------------------------------------------------- admin grant
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ae","role":"authenticated"}';
select lives_ok($$ select admin_grant_access('00000000-0000-0000-0000-0000000000cd', 3, 'cadou') $$,
  'admin grants access to an invitee');
reset role;
select results_eq($$ select state, first_paid_at from referrals where invitee_id = pg_temp.uid('cd') $$,
  $$ values ('registered'::text, null::timestamptz) $$, 'an admin grant to an invitee changes nothing');
select is(pg_temp.reward_grants('a9') + pg_temp.referral_credits('a9'), 0, 'the inviter gets nothing from an admin grant');

-- ---------------------------------------------------------------- flag off
update referral_settings set enabled = false where id = 1;
select pg_temp.buy('c5');
select results_eq($$ select state, first_paid_at is not null, reward_credits, access_ledger_id, credit_ledger_id
                       from referrals where invitee_id = pg_temp.uid('c5') $$,
  $$ values ('not_rewarded_disabled'::text, true, null::int, null::bigint, null::bigint) $$,
  'flag off: the first payment is recorded as not_rewarded_disabled');
select is(pg_temp.reward_grants('a4') + pg_temp.referral_credits('a4'), 0, 'flag off: nothing granted');
update referral_settings set enabled = true where id = 1;
select pg_temp.buy('c5');
select is(pg_temp.state('c5'), 'not_rewarded_disabled', 'flag back on: not rewarded retroactively');
select is(pg_temp.reward_grants('a4') + pg_temp.referral_credits('a4'), 0, 'flag back on: still nothing granted');

-- a8's first invitee pays while the flag is off (checked below).
update referral_settings set enabled = false where id = 1;
select pg_temp.buy('cc');
update referral_settings set enabled = true where id = 1;

-- ---------------------------------------------------------------- cap
update referral_settings set max_rewarded = 1 where id = 1;
select pg_temp.buy('c6');
select is(pg_temp.state('c6'), 'pending', 'cap 1: the first paying invitee counts');
select pg_temp.buy('c7');
select results_eq($$ select state, first_paid_at is not null from referrals where invitee_id = pg_temp.uid('c7') $$,
  $$ values ('over_cap'::text, true) $$, 'cap 1: the second paying invitee is over_cap');
update referral_settings set max_rewarded = 100 where id = 1;

-- ---------------------------------------------------------------- threshold lowered
select pg_temp.buy('c8');
select pg_temp.buy('c9');
update referrals set first_paid_at = now() - interval '2 days' where invitee_id = pg_temp.uid('c8');
update referrals set first_paid_at = now() - interval '1 day' where invitee_id = pg_temp.uid('c9');
update referral_settings set threshold = 2 where id = 1;
select pg_temp.buy('ca');
select is(pg_temp.reward_grants('a6'), 1, 'threshold lowered to 2 with 3 pending: exactly one grant');
select results_eq($$ select r.state from referrals r where r.inviter_id = pg_temp.uid('a6') order by r.first_paid_at, r.created_at $$,
  $$ values ('consumed_access'::text), ('consumed_access'), ('pending') $$,
  'the two oldest pending are consumed, one stays pending');
-- ---------------------------------------------------------------- pending invitee deletes the account
-- a7: cb pays (pending, threshold 2), deletes the account, then another paying invitee completes the threshold.
select pg_temp.buy('cb');
delete from auth.users where id = pg_temp.uid('cb');
select results_eq($$ select state, invitee_id, invitee_first_name from referrals where inviter_id = pg_temp.uid('a7') $$,
  $$ values ('pending'::text, null::uuid, 'Coleg'::text) $$, 'a deleted paying invitee stays pending with the name snapshot');
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  (pg_temp.uid('ce'), 'rw-ce@test.local', 'authenticated', 'authenticated', '{}');
insert into referrals (inviter_id, invitee_id) values (pg_temp.uid('a7'), pg_temp.uid('ce'));
select pg_temp.buy('ce');
select is(pg_temp.reward_grants('a7'), 1, 'the deleted invitee still counts toward the threshold');
select is((select count(*)::int from referrals where inviter_id = pg_temp.uid('a7') and state = 'consumed_access'), 2,
  'the deleted invitee is consumed with the other');
update referral_settings set threshold = 5 where id = 1;

-- ---------------------------------------------------------------- access expiring / admin grant does not convert
-- a8: cc paid while the flag was off above, so it is not_rewarded_disabled; use a fresh invitee.
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  (pg_temp.uid('cf'), 'rw-cf@test.local', 'authenticated', 'authenticated', '{}'),
  (pg_temp.uid('d0'), 'rw-d0@test.local', 'authenticated', 'authenticated', '{}');
insert into referrals (inviter_id, invitee_id) values (pg_temp.uid('a8'), pg_temp.uid('cf')), (pg_temp.uid('a8'), pg_temp.uid('d0'));
select is(pg_temp.state('cc'), 'not_rewarded_disabled', 'flag off: the first payment is not rewarded');
select pg_temp.buy('cf');
select is(pg_temp.state('cf'), 'pending', 'a8 has a pending invitee');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ae","role":"authenticated"}';
select admin_grant_access('00000000-0000-0000-0000-0000000000a8', 1, 'cadou');
reset role;
select is(pg_temp.state('cf'), 'pending', 'an admin grant to the inviter does not convert pending invitees');
select is(pg_temp.referral_credits('a8'), 0, 'no credits from the admin grant');
update profiles set access_until = now() - interval '1 day' where id = pg_temp.uid('a8');
select pg_temp.buy('d0');
select is((select count(*)::int from referrals where inviter_id = pg_temp.uid('a8') and state = 'pending'), 2,
  'after the inviter''s access expired the old pending is intact and the new invitee is pending too');

-- ---------------------------------------------------------------- flag off: own purchase does not convert
update referral_settings set enabled = false where id = 1;
select pg_temp.buy('a8');
select is((select count(*)::int from referrals where inviter_id = pg_temp.uid('a8') and state = 'pending'), 2,
  'flag off: the inviter''s purchase does not convert pending invitees');
update referral_settings set enabled = true where id = 1;

-- ---------------------------------------------------------------- admin inviter (defensive)
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  (pg_temp.uid('d1'), 'rw-d1@test.local', 'authenticated', 'authenticated', '{}');
insert into referrals (inviter_id, invitee_id) values (pg_temp.uid('ad'), pg_temp.uid('d1'));
select pg_temp.buy('d1');
select results_eq($$ select state, first_paid_at is not null from referrals where invitee_id = pg_temp.uid('d1') $$,
  $$ values ('not_rewarded_disabled'::text, true) $$, 'an admin inviter is never rewarded');
select is(pg_temp.reward_grants('ad') + pg_temp.referral_credits('ad'), 0, 'the admin inviter gets nothing');

-- ---------------------------------------------------------------- snapshot of the credit value
update referral_settings set credits_per_invitee = 25 where id = 1;
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  (pg_temp.uid('d2'), 'rw-d2@test.local', 'authenticated', 'authenticated', '{"full_name":"Radu Stan"}');
insert into referrals (inviter_id, invitee_id) values (pg_temp.uid('a2'), pg_temp.uid('d2'));
select pg_temp.buy('d2');
select results_eq($$ select state, reward_credits, invitee_first_name from referrals where invitee_id = pg_temp.uid('d2') $$,
  $$ values ('converted_credits'::text, 25, 'Radu'::text) $$, 'the reward value is the setting at the time of the event');
select results_eq($$ select reward_credits from referrals where invitee_id = pg_temp.uid('a3') $$,
  $$ values (40) $$, 'an earlier reward keeps its snapshot');
update referral_settings set credits_per_invitee = 40 where id = 1;

-- ---------------------------------------------------------------- not the first approved order
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  (pg_temp.uid('d3'), 'rw-d3@test.local', 'authenticated', 'authenticated', '{}');
select pg_temp.buy('d3');
insert into referrals (inviter_id, invitee_id) values (pg_temp.uid('a2'), pg_temp.uid('d3'));
select pg_temp.buy('d3');
select results_eq($$ select state, first_paid_at from referrals where invitee_id = pg_temp.uid('d3') $$,
  $$ values ('registered'::text, null::timestamptz) $$, 'a row attached after an earlier paid order is never rewarded');

-- ---------------------------------------------------------------- credits_per_invitee = 0
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  (pg_temp.uid('d4'), 'rw-d4@test.local', 'authenticated', 'authenticated', '{}'),
  (pg_temp.uid('d5'), 'rw-d5@test.local', 'authenticated', 'authenticated', '{}'),
  (pg_temp.uid('d6'), 'rw-d6@test.local', 'authenticated', 'authenticated', '{}'),
  (pg_temp.uid('e0'), 'rw-e0@test.local', 'authenticated', 'authenticated', '{}');
insert into referrals (inviter_id, invitee_id) values
  (pg_temp.uid('a2'), pg_temp.uid('d4')), (pg_temp.uid('e0'), pg_temp.uid('d5')), (pg_temp.uid('e0'), pg_temp.uid('d6'));
update referral_settings set credits_per_invitee = 0 where id = 1;
create temp table t_a2_rows as select count(*)::int n from credit_ledger where user_id = pg_temp.uid('a2') and kind = 'referral';
select pg_temp.buy('d4');
select results_eq($$ select state, reward_credits, credit_ledger_id from referrals where invitee_id = pg_temp.uid('d4') $$,
  $$ values ('converted_credits'::text, 0, null::bigint) $$, 'credits 0: converted with reward 0 and no ledger link');
select is((select count(*)::int from credit_ledger where user_id = pg_temp.uid('a2') and kind = 'referral'),
  (select n from t_a2_rows), 'credits 0: no credit ledger row');
update referral_settings set credits_per_invitee = 40 where id = 1;

-- ---------------------------------------------------------------- admin-granted access with an older pending invitee
select pg_temp.buy('d5');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ae","role":"authenticated"}';
select admin_grant_access('00000000-0000-0000-0000-0000000000e0', 1, 'cadou');
reset role;
select pg_temp.buy('d6');
select results_eq($$ select state, reward_credits from referrals where invitee_id = pg_temp.uid('d6') $$,
  $$ values ('converted_credits'::text, 40) $$, 'admin-granted access counts: the newcomer gets credits');
select is(pg_temp.state('d5'), 'pending', 'the older pending invitee stays pending');
select is(pg_temp.referral_credits('e0'), 40, 'only the newcomer was credited');

-- ---------------------------------------------------------------- admin skip in referral_convert_pending
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  (pg_temp.uid('d7'), 'rw-d7@test.local', 'authenticated', 'authenticated', '{}');
insert into referrals (inviter_id, invitee_id, state, first_paid_at)
  values (pg_temp.uid('ad'), pg_temp.uid('d7'), 'pending', now());
select pg_temp.buy('ad');
select is(pg_temp.state('d7'), 'pending', 'an admin''s purchase does not convert pending invitees');
select is(pg_temp.referral_credits('ad'), 0, 'the admin gets no referral credits');

-- ---------------------------------------------------------------- unchanged surface
select is((select pg_get_function_result(p.oid) from pg_proc p where p.oid = 'public.purchase_access(uuid,int,int,int)'::regprocedure),
  'TABLE(order_id uuid, access_until timestamp with time zone, bonus integer, balance integer)',
  'purchase_access keeps its return shape');
select ok(not has_function_privilege('anon', 'public.purchase_access(uuid,int,int,int)', 'execute'), 'anon cannot purchase');
select ok(not has_function_privilege('authenticated', 'public.purchase_access(uuid,int,int,int)', 'execute'), 'authenticated cannot purchase');
select ok(has_function_privilege('service_role', 'public.purchase_access(uuid,int,int,int)', 'execute'), 'service_role can purchase');
select ok(not has_function_privilege('service_role', 'private.referral_on_purchase(uuid)', 'execute'),
  'service_role cannot call the reward helper directly');

select * from finish();
rollback;
