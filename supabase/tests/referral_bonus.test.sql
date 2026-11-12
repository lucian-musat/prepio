begin;
select plan(42);

-- Fix wave 2: free access includes the bonus credits; purchase survives a failing referral step; attach rate limit;
-- invitee deletion lock order; summary cap fields; public settings bonus; admin ledger links.
update access_settings set price_bani = 15000, bonus_credits = 100, duration_months = 3 where id = 1;
update referral_settings set enabled = true, threshold = 2, credits_per_invitee = 40, max_rewarded = 100 where id = 1;

insert into auth.users (id, email, aud, role, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000000' || x)::uuid, 'rb-' || x || '@test.local', 'authenticated', 'authenticated', '{}'
  from unnest(array['a1','a2','a3','a4','a5','a6','a7','ad','ae',
                    'b1','b2','b3','b4','b5','b6','c1','c2','c3','c4','c5','c6','c7','c8','d1','d2']) x;
insert into public.admins (user_id) values
  ('00000000-0000-0000-0000-0000000000ad'), ('00000000-0000-0000-0000-0000000000ae');

create function pg_temp.uid(p text) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-0000000000' || p)::uuid;
$$;
-- Buys at the current offer (the bonus may change between purchases).
create function pg_temp.buy(p_user text) returns void language sql as $$
  select null from public.access_settings s,
    lateral public.purchase_access(pg_temp.uid(p_user), s.price_bani, s.bonus_credits, s.duration_months) x
   where s.id = 1;
$$;
create function pg_temp.bonus_rows(p_user text) returns int language sql as $$
  select count(*)::int from public.credit_ledger where user_id = pg_temp.uid(p_user) and kind = 'access_bonus';
$$;
create function pg_temp.balance(p_user text) returns int language sql as $$
  select credit_balance from public.profiles where id = pg_temp.uid(p_user);
$$;
create function pg_temp.grants(p_user text) returns int language sql as $$
  select count(*)::int from public.access_ledger where user_id = pg_temp.uid(p_user) and kind = 'referral_reward';
$$;

insert into referrals (inviter_id, invitee_id, created_at)
select pg_temp.uid(v.inviter), pg_temp.uid(v.invitee), now() - (v.ord || ' minutes')::interval
  from (values ('a1','b1',60), ('a1','b2',59),
               ('a2','b3',58), ('a2','b4',57),
               ('a3','b5',56), ('a3','b6',55),
               ('a4','c1',54), ('a4','c2',53), ('a4','c3',52), ('a4','c4',51),
               ('ad','c5',50), ('ad','c6',49),
               ('a6','c7',48), ('a7','c8',47)) v(inviter, invitee, ord);

-- ---------------------------------------------------------------- (A) threshold grant credits the bonus once
create temp table t_a1 as select pg_temp.balance('a1') b;
select pg_temp.buy('b1');
select is(pg_temp.bonus_rows('a1'), 0, 'below the threshold: no bonus row');
select pg_temp.buy('b2');
select is(pg_temp.grants('a1'), 1, 'the threshold grants one free access period');
select is(pg_temp.balance('a1'), (select b + 100 from t_a1), 'the free access credits exactly bonus_credits (100)');
select results_eq($$ select delta, access_order_id, reason from credit_ledger
                      where user_id = pg_temp.uid('a1') and kind = 'access_bonus' $$,
  $$ values (100, null::uuid, null::text) $$, 'one access_bonus ledger row of 100, not tied to an order');
select is((select l.referral_id from credit_ledger l where l.user_id = pg_temp.uid('a1') and l.kind = 'access_bonus'),
  (select r.id from referrals r where r.invitee_id = pg_temp.uid('b1')),
  'the bonus row points at the oldest consumed invitee');
select is((select r.access_ledger_id from credit_ledger l join referrals r on r.id = l.referral_id
            where l.user_id = pg_temp.uid('a1') and l.kind = 'access_bonus'),
  (select id from access_ledger where user_id = pg_temp.uid('a1') and kind = 'referral_reward'),
  'that invitee points at the grant: credit row -> referral -> access_ledger');
select results_eq($$ select (details ->> 'bonus_credits')::int, (details ->> 'months')::int
                       from student_events where user_id = pg_temp.uid('a1') and kind = 'referral_access' $$,
  $$ values (100, 3) $$, 'referral_access carries the bonus credits');
select is((select count(*)::int from student_events where user_id = pg_temp.uid('a1')
             and kind not in ('registered', 'welcome_credits', 'referral_access')), 0,
  'the bonus row adds no second timeline event');
select is((select count(*)::int from credit_ledger where user_id = pg_temp.uid('a1') and kind = 'referral'), 0,
  'the free access gives no referral credits');

-- The setting is read at grant time.
update access_settings set bonus_credits = 70 where id = 1;
create temp table t_a2 as select pg_temp.balance('a2') b;
select pg_temp.buy('b3');
select pg_temp.buy('b4');
select is(pg_temp.balance('a2'), (select b + 70 from t_a2), 'a changed bonus_credits is read at grant time');
select results_eq($$ select (details ->> 'bonus_credits')::int from student_events
                      where user_id = pg_temp.uid('a2') and kind = 'referral_access' $$,
  $$ values (70) $$, 'the event snapshots the bonus of that moment');
select is((select delta from credit_ledger where user_id = pg_temp.uid('a1') and kind = 'access_bonus'), 100,
  'an earlier bonus row keeps its value');

-- bonus_credits = 0: the grant happens, no ledger row.
update access_settings set bonus_credits = 0 where id = 1;
create temp table t_a3 as select pg_temp.balance('a3') b;
select pg_temp.buy('b5');
select pg_temp.buy('b6');
select is(pg_temp.grants('a3'), 1, 'bonus 0: the access is still granted');
select is(pg_temp.bonus_rows('a3'), 0, 'bonus 0: no access_bonus row');
select is(pg_temp.balance('a3'), (select b from t_a3), 'bonus 0: the balance is unchanged');
select results_eq($$ select (details ->> 'bonus_credits')::int from student_events
                      where user_id = pg_temp.uid('a3') and kind = 'referral_access' $$,
  $$ values (0) $$, 'bonus 0: the event says 0');
update access_settings set bonus_credits = 100 where id = 1;

-- Surplus: four pending with the threshold lowered to 2 -> one grant, one bonus row per event.
update referral_settings set threshold = 5 where id = 1;
select pg_temp.buy('c1');
select pg_temp.buy('c2');
select pg_temp.buy('c3');
update referral_settings set threshold = 2 where id = 1;
create temp table t_a4 as select pg_temp.balance('a4') b;
select pg_temp.buy('c4');
select is(pg_temp.grants('a4'), 1, 'surplus: one grant for the event');
select is(pg_temp.bonus_rows('a4'), 1, 'surplus: one bonus row for the event');
select is(pg_temp.balance('a4'), (select b + 100 from t_a4), 'surplus: the bonus is credited once');
select is((select count(*)::int from referrals where inviter_id = pg_temp.uid('a4') and state = 'pending'), 2,
  'surplus: the rest stays pending');

-- An admin inviter is never rewarded, so no bonus either.
select pg_temp.buy('c5');
select pg_temp.buy('c6');
select is(pg_temp.grants('ad') + pg_temp.bonus_rows('ad'), 0, 'an admin inviter gets no grant and no bonus');

-- admin_grant_access gives no bonus.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ae","role":"authenticated"}';
select lives_ok($$ select admin_grant_access('00000000-0000-0000-0000-0000000000a5', 3, 'cadou') $$, 'admin grants access');
reset role;
select is(pg_temp.bonus_rows('a5'), 0, 'an admin grant carries no bonus credits');

-- ---------------------------------------------------------------- (B3) a failing referral step never rolls back a purchase
create function public.t_referrals_boom() returns trigger language plpgsql as $$
begin
  raise exception 'boom';
end $$;
create trigger t_referrals_boom before update on public.referrals for each row execute function public.t_referrals_boom();
set local client_min_messages = error; -- the expected 'referral step skipped' warnings stay out of the output
create temp table t_c7 as select pg_temp.balance('c7') b;
select lives_ok($$ select pg_temp.buy('c7') $$, 'the purchase succeeds although the referral step fails');
select is((select count(*)::int from access_orders where user_id = pg_temp.uid('c7') and status = 'approved'), 1,
  'the order is approved');
select is((select access_until from profiles where id = pg_temp.uid('c7')), now() + interval '3 months',
  'the buyer has access');
select is(pg_temp.balance('c7'), (select b + 100 from t_c7), 'the buyer gets the normal bonus');
select results_eq($$ select state, first_paid_at from referrals where invitee_id = pg_temp.uid('c7') $$,
  $$ values ('registered'::text, null::timestamptz) $$, 'the referral row is untouched (nothing half-written)');
select is(pg_temp.grants('a6') + pg_temp.bonus_rows('a6'), 0, 'the inviter got nothing from the failed step');
-- The inviter path too: a7's pending invitee cannot convert, a7's own purchase still goes through.
drop trigger t_referrals_boom on public.referrals;
select pg_temp.buy('c8');
create trigger t_referrals_boom before update on public.referrals for each row execute function public.t_referrals_boom();
select lives_ok($$ select pg_temp.buy('a7') $$, 'the inviter''s purchase succeeds although the conversion fails');
select is((select state from referrals where invitee_id = pg_temp.uid('c8')), 'pending', 'the pending invitee stays pending');
drop trigger t_referrals_boom on public.referrals;
drop function public.t_referrals_boom();
reset client_min_messages;

-- ---------------------------------------------------------------- (B1) attach is rate limited per user
delete from rate_limits where key like 'referral_attach:%';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select is((select count(*)::int from generate_series(1, 30) g, lateral referral_attach('ZZZZ' || g) r where r = 'invalid'),
  30, 'attach answers 30 calls in the window');
select throws_ok($$ select referral_attach('ZZZZZZZZ') $$, 'P0001', 'rate_limited', 'the 31st call raises rate_limited');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';
select is(referral_attach('ZZZZZZZZ'), 'invalid', 'another user has their own limit');
reset role;
select is((select count(*)::int from rate_limits where key = 'referral_attach:' || pg_temp.uid('d1')::text), 1,
  'the key is per user');
update referral_settings set enabled = false where id = 1;
delete from rate_limits where key like 'referral_attach:%';
set local role authenticated;
select is(referral_attach('ZZZZZZZZ'), 'disabled', 'programme off: disabled');
reset role;
select is((select count(*)::int from rate_limits where key like 'referral_attach:%'), 0, 'programme off: nothing written');
update referral_settings set enabled = true where id = 1;

-- ---------------------------------------------------------------- (B2) invitee deletion: lock order and behaviour
select ok(pg_get_functiondef('private.referrals_before_invitee_delete()'::regprocedure)
            ~ 'from public\.profiles p where p\.id = old\.id for update',
  'the delete trigger locks the profile first');

-- ---------------------------------------------------------------- (B4) summary cap fields, public bonus, admin links
update referral_settings set max_rewarded = 2 where id = 1;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select results_eq($$ select max_rewarded, cap_reached from my_referral_summary() $$,
  $$ values (2, true) $$, 'two rewarded invitees with cap 2: cap reached');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}';
select results_eq($$ select max_rewarded, cap_reached from my_referral_summary() $$,
  $$ values (2, false) $$, 'no rewarded invitee: cap not reached');
reset role;
update referral_settings set max_rewarded = 100 where id = 1;

set local role anon;
select results_eq($$ select bonus_credits from referral_public_settings() $$, $$ values (100) $$,
  'the public settings carry the bonus credits, readable signed out');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000ae","role":"authenticated"}';
select is((select count(*)::int from admin_credit_ledger(pg_temp.uid('a1'), 50)
            where kind = 'access_bonus' and referral_id is not null and access_order_id is null), 1,
  'admin_credit_ledger exposes the referral link of the bonus row');
reset role;

select * from finish();
rollback;
