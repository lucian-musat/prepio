-- Referral hardening from the whole-branch review:
--  * referral_lookup: the programme flag is checked before anything is written; the rate-limit key is bounded (the last
--    x-forwarded-for entry, hashed into 1024 buckets); a rate-limited call raises 'rate_limited' instead of answering
--    valid = false, so a client cannot mistake "slow down" for "invalid code"; limit 120 calls per 60 s per bucket
--    (a school sits behind one NAT address).
--  * my_referral_summary: no code for an admin (referral_lookup rejects admin codes anyway).

create or replace function public.referral_lookup(p_code text)
returns table (valid boolean, inviter_first_name text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_headers jsonb;
  v_xff text;
  v_parts text[];
  v_ip text;
  v_key text;
  v_inviter uuid;
begin
  -- Programme off: nothing is written, the answer is "not valid".
  if not (select s.enabled from public.referral_settings s where s.id = 1) then
    return query select false, null::text;
    return;
  end if;

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;
  v_xff := coalesce(v_headers ->> 'x-forwarded-for', '');
  v_parts := string_to_array(v_xff, ',');
  -- The last entry is the one the proxy appended; earlier ones are client controlled.
  v_ip := nullif(btrim(coalesce(v_parts[array_length(v_parts, 1)], '')), '');
  v_key := 'referral_lookup:' || case when v_ip is null then 'unknown' else (hashtext(v_ip)::bigint & 1023)::text end;
  if not public.consume_rate_limit(v_key, 120, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select c.user_id into v_inviter from public.referral_codes c
   where c.code = private.normalize_referral_code(p_code)
     and not exists (select 1 from public.admins a where a.user_id = c.user_id);
  if v_inviter is null then
    return query select false, null::text;
    return;
  end if;
  return query select true, private.first_name_of((select p.display_name from public.profiles p where p.id = v_inviter));
end;
$$;

create or replace function public.my_referral_summary()
returns table (
  code text, enabled boolean, threshold int, credits_per_invitee int, duration_months int, has_access boolean,
  pending_count int, invitee_count int, credits_earned int, free_periods_earned int
)
language sql
stable
security definer
set search_path = ''
as $$
  select (select c.code from public.referral_codes c
           where c.user_id = auth.uid()
             and not exists (select 1 from public.admins a where a.user_id = c.user_id)),
         s.enabled,
         s.threshold,
         s.credits_per_invitee,
         a.duration_months,
         coalesce((select p.access_until > now() from public.profiles p where p.id = auth.uid()), false),
         (select count(*)::int from public.referrals r where r.inviter_id = auth.uid() and r.state = 'pending'),
         (select count(*)::int from public.referrals r where r.inviter_id = auth.uid()),
         (select coalesce(sum(r.reward_credits), 0)::int from public.referrals r
           where r.inviter_id = auth.uid() and r.state = 'converted_credits'),
         (select count(*)::int from public.access_ledger l where l.user_id = auth.uid() and l.kind = 'referral_reward')
    from public.referral_settings s, public.access_settings a
   where s.id = 1 and a.id = 1;
$$;
