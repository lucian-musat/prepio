-- 1. referral_attach: the inviter's profile must be strictly older than the invitee's. The referral graph is then
--    ordered by account age, so it has no cycles, and two purchases can never lock two profiles in opposite orders
--    (purchase_access locks the buyer, then the buyer's inviter).
-- 2. referral_on_purchase: guard the re-read of the referral row, and pick the consumed rows in a separate statement.
--    `update ... where id in (select ... limit n for update)` may rescan the locking subquery; rows already updated
--    by the same command are then skipped and the limit reaches further rows, consuming more than n.

-- ---------------------------------------------------------------- attach
-- Body as in 20261112102120_referral_attach.sql, plus the age check (part of not_allowed; the precedence stays
-- disabled, invalid, self, not_allowed).
create or replace function public.referral_attach(p_code text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_inviter uuid;
  v_profile public.profiles%rowtype;
  v_inviter_name text;
begin
  if v_user is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not (select s.enabled from public.referral_settings s where s.id = 1) then
    return 'disabled';
  end if;
  select c.user_id into v_inviter from public.referral_codes c
   where c.code = private.normalize_referral_code(p_code)
     and not exists (select 1 from public.admins a where a.user_id = c.user_id);
  if v_inviter is null then
    return 'invalid';
  end if;
  if v_inviter = v_user then
    return 'self';
  end if;

  select * into v_profile from public.profiles p where p.id = v_user;
  if not found
     or v_profile.created_at <= now() - interval '24 hours'
     or (v_profile.terms_version is not null and v_profile.display_name is not null and v_profile.learning_mode is not null)
     or exists (select 1 from public.admins a where a.user_id = v_user)
     or exists (select 1 from public.referrals r where r.invitee_id = v_user)
     or exists (select 1 from public.access_orders o where o.user_id = v_user)
     or exists (select 1 from public.lesson_progress l where l.user_id = v_user)
     or exists (select 1 from public.consolidation_runs c where c.user_id = v_user)
     or not exists (select 1 from public.profiles ip where ip.id = v_inviter and ip.created_at < v_profile.created_at) then
    return 'not_allowed';
  end if;

  begin
    insert into public.referrals (inviter_id, invitee_id, invitee_first_name, state)
    values (v_inviter, v_user, private.first_name_of(v_profile.display_name), 'registered');
  exception when unique_violation then
    return 'not_allowed';
  end;

  select private.first_name_of(p.display_name) into v_inviter_name from public.profiles p where p.id = v_inviter;
  perform public.log_student_event(v_user, 'referral_joined', null, null, null,
    jsonb_build_object('inviter_first_name', v_inviter_name));
  return 'attached';
end;
$$;
revoke execute on function public.referral_attach(text) from public, anon, authenticated, service_role;
grant execute on function public.referral_attach(text) to authenticated;

-- ---------------------------------------------------------------- reward
-- Body as in 20261112102902_referral_rewards.sql with the two fixes above.
create or replace function private.referral_on_purchase(p_invitee uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_ref public.referrals;
  v_settings public.referral_settings;
  v_inviter_until timestamptz;
  v_months int;
  v_until timestamptz;
  v_entry bigint;
  v_n int;
  v_ids uuid[];
begin
  select * into v_ref from public.referrals r where r.invitee_id = p_invitee;
  if not found or v_ref.first_paid_at is not null or v_ref.state <> 'registered' then
    return;
  end if;
  -- Only the first approved order counts (a row attached after an earlier payment is never rewarded).
  if (select count(*) from public.access_orders o where o.user_id = p_invitee and o.status = 'approved') <> 1 then
    return;
  end if;

  -- Lock order: buyer (held by the caller), inviter profile, then the inviter's referral rows.
  select p.access_until into v_inviter_until from public.profiles p where p.id = v_ref.inviter_id for update;
  if not found then
    return;
  end if;
  select * into v_ref from public.referrals r where r.id = v_ref.id for update;
  if not found or v_ref.first_paid_at is not null then
    return;
  end if;

  update public.referrals r
     set first_paid_at = now(),
         invitee_first_name = private.first_name_of((select p.display_name from public.profiles p where p.id = p_invitee))
   where r.id = v_ref.id;

  select * into v_settings from public.referral_settings s where s.id = 1;
  -- Rule 11 (kill switch), and defensively rule 14 (admins neither invite nor are invited).
  if not coalesce(v_settings.enabled, false)
     or exists (select 1 from public.admins a where a.user_id in (v_ref.inviter_id, p_invitee)) then
    update public.referrals r set state = 'not_rewarded_disabled' where r.id = v_ref.id;
    return;
  end if;

  -- Rule 12: the cap counts already rewarded invitees (deleted ones included), with the current setting.
  select count(*) into v_n from public.referrals r
   where r.inviter_id = v_ref.inviter_id and r.id <> v_ref.id
     and r.state in ('pending', 'consumed_access', 'converted_credits');
  if v_n >= v_settings.max_rewarded then
    update public.referrals r set state = 'over_cap' where r.id = v_ref.id;
    return;
  end if;

  -- Rule 2: an inviter with access gets credits now.
  if v_inviter_until > now() then
    perform private.referral_credit(v_ref.id, v_ref.inviter_id, v_settings.credits_per_invitee);
    return;
  end if;

  -- Otherwise pending; rule 3: at most one access period per event once the threshold is reached.
  update public.referrals r set state = 'pending' where r.id = v_ref.id;
  select count(*) into v_n from public.referrals r where r.inviter_id = v_ref.inviter_id and r.state = 'pending';
  if v_n < v_settings.threshold then
    return;
  end if;

  select s.duration_months into v_months from public.access_settings s where s.id = 1;
  perform private.log_access_expiry(v_ref.inviter_id, v_inviter_until);
  v_until := private.extend_access(v_inviter_until, v_months, now());
  update public.profiles p set access_until = v_until where p.id = v_ref.inviter_id;
  insert into public.access_ledger (user_id, kind, months, until_before, until_after)
  values (v_ref.inviter_id, 'referral_reward', v_months, v_inviter_until, v_until)
  returning id into v_entry;

  -- The oldest threshold-many pending, chosen once (see the header).
  select array_agg(x.id) into v_ids from (
    select r.id from public.referrals r
     where r.inviter_id = v_ref.inviter_id and r.state = 'pending'
     order by r.first_paid_at, r.created_at, r.id
     limit v_settings.threshold
       for update) x;
  update public.referrals r set state = 'consumed_access', access_ledger_id = v_entry where r.id = any(v_ids);

  perform public.log_student_event(v_ref.inviter_id, 'referral_access', null, null, null,
    jsonb_build_object('months', v_months, 'until', v_until, 'invitees', v_settings.threshold));
end;
$$;
revoke execute on function private.referral_on_purchase(uuid) from public, anon, authenticated, service_role;
