begin;
select plan(6);

select is(
  (select count(*) filter (where consume_rate_limit('ip-a', 10, 3600))::int from generate_series(1, 10)),
  10, 'first 10 calls are allowed');
select is(consume_rate_limit('ip-a', 10, 3600), false, '11th call is blocked');
select is(consume_rate_limit('ip-b', 10, 3600), true, 'a different key is independent');

update rate_limits set window_start = now() - interval '2 hours' where key = 'ip-a';
select is(consume_rate_limit('ip-a', 10, 3600), true, 'allowed again after the window expires');
select is((select count from rate_limits where key = 'ip-a'), 1, 'window reset restarts the count');

set local role anon;
select throws_ok(
  $$ select consume_rate_limit('ip-c', 10, 3600) $$,
  '42501', null, 'anon cannot execute consume_rate_limit');

select * from finish();
rollback;
