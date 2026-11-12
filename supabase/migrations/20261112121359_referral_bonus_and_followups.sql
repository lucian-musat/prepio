-- Referrals, fix wave 2.
--  1. Owner decision (2026-11-12): the free access earned through referrals includes the same bonus credits as a
--     paid access (access_settings.bonus_credits, read at grant time). referral_on_purchase credits them to the inviter
--     with credit_apply kind 'access_bonus' in the same transaction; the ledger row's referral_id points at the oldest
--     invitee consumed by that grant, whose referrals.access_ledger_id points at the grant (credit row -> referral ->
--     access_ledger). No row when bonus_credits = 0. The referral_access event carries bonus_credits; access_bonus rows
--     map to no timeline event (student_event_of_ledger), so nothing is logged twice.
--  2. purchase_access: the referral step runs in its own subtransaction; any error there is logged (warning) and the
--     purchase goes on. A captured payment always grants access; the failed step leaves no half-written referral state.
--  3. referral_attach: rate limited per signed-in user (30 calls per 10 minutes, 'rate_limited' above that).
--  4. referrals_before_invitee_delete: locks the deleted user's profile first, the same order as purchase_access
--     (buyer profile, then referral rows).
--  5. my_referral_summary: + max_rewarded, cap_reached. referral_public_settings: + bonus_credits (explainer).
--     admin_credit_ledger: + referral_id, access_order_id (the admin names a referral bonus row).
--  6. referral_rows / admin_referral_context use private.first_name_of instead of repeating it.

-- ---------------------------------------------------------------- 1. reward with bonus credits
-- Body as in 20261112103709_referral_attach_acyclic.sql; only the grant step changed (bonus credits, event detail).
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
  v_bonus int;
  v_until timestamptz;
  v_entry bigint;
  v_credit bigint;
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

  -- The offer as it is now: the same duration and bonus credits as a purchase made at this moment.
  select s.duration_months, s.bonus_credits into v_months, v_bonus from public.access_settings s where s.id = 1;
  perform private.log_access_expiry(v_ref.inviter_id, v_inviter_until);
  v_until := private.extend_access(v_inviter_until, v_months, now());
  update public.profiles p set access_until = v_until where p.id = v_ref.inviter_id;
  insert into public.access_ledger (user_id, kind, months, until_before, until_after)
  values (v_ref.inviter_id, 'referral_reward', v_months, v_inviter_until, v_until)
  returning id into v_entry;

  -- The oldest threshold-many pending, chosen once (see 20261112103709); v_ids[1] is the oldest.
  select array_agg(x.id order by x.first_paid_at, x.created_at, x.id) into v_ids from (
    select r.id, r.first_paid_at, r.created_at from public.referrals r
     where r.inviter_id = v_ref.inviter_id and r.state = 'pending'
     order by r.first_paid_at, r.created_at, r.id
     limit v_settings.threshold
       for update) x;
  update public.referrals r set state = 'consumed_access', access_ledger_id = v_entry where r.id = any(v_ids);

  -- The bonus credits of the free access, linked to the grant through the oldest consumed invitee.
  if v_bonus > 0 then
    select a.entry_id into v_credit
      from public.credit_apply(v_ref.inviter_id, v_bonus, 'access_bonus', null, null, null, null, null, null) a;
    update public.credit_ledger l set referral_id = v_ids[1] where l.id = v_credit;
  end if;

  perform public.log_student_event(v_ref.inviter_id, 'referral_access', null, null, null,
    jsonb_build_object('months', v_months, 'until', v_until, 'invitees', v_settings.threshold,
                       'bonus_credits', greatest(coalesce(v_bonus, 0), 0)));
end;
$$;
revoke execute on function private.referral_on_purchase(uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- 2. purchase never rolled back by the referral step
-- Body as in 20261112102902_referral_rewards.sql; the two referral calls now run in a subtransaction.
create or replace function public.purchase_access(p_user uuid, p_price_bani int, p_bonus int, p_months int)
returns table (order_id uuid, access_until timestamptz, bonus int, balance int)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_offer public.access_settings;
  v_current timestamptz;
  v_until timestamptz;
  v_order uuid;
  v_entry bigint;
  v_balance int;
begin
  select * into v_offer from public.access_settings s where s.id = 1 for share;
  if v_offer.price_bani is distinct from p_price_bani
     or v_offer.bonus_credits is distinct from p_bonus
     or v_offer.duration_months is distinct from p_months then
    raise exception 'offer_changed' using errcode = 'P0001';
  end if;

  -- The profile lock serialises concurrent purchases and grants for the same account.
  select p.access_until, p.credit_balance into v_current, v_balance
    from public.profiles p where p.id = p_user for update;
  if not found then
    raise exception 'profile_not_found' using errcode = 'P0001';
  end if;

  perform private.log_access_expiry(p_user, v_current);
  v_until := private.extend_access(v_current, v_offer.duration_months, now());

  insert into public.access_orders (user_id, price_bani, bonus_credits, duration_months, status, approved_at)
  values (p_user, v_offer.price_bani, v_offer.bonus_credits, v_offer.duration_months, 'approved', now())
  returning id into v_order;

  update public.profiles p set access_until = v_until where p.id = p_user;

  insert into public.access_ledger (user_id, kind, months, until_before, until_after, order_id)
  values (p_user, 'purchase', v_offer.duration_months, v_current, v_until, v_order);

  if v_offer.bonus_credits > 0 then
    select a.entry_id, a.balance into v_entry, v_balance
      from public.credit_apply(p_user, v_offer.bonus_credits, 'access_bonus', null, null, null, null, null, null) a;
    update public.credit_ledger l set access_order_id = v_order where l.id = v_entry;
  end if;

  perform public.log_student_event(p_user, 'access_purchased', null, null, null,
    jsonb_build_object('months', v_offer.duration_months, 'until', v_until,
                       'price_bani', v_offer.price_bani, 'credits', v_offer.bonus_credits));

  -- A payment that went through must always grant access: a failure in the referral step (a bug, a deadlock with a
  -- concurrent account deletion, ...) rolls back only that step's writes and is logged; the purchase stands.
  begin
    perform private.referral_convert_pending(p_user);
    perform private.referral_on_purchase(p_user);
  exception when others then
    raise warning 'purchase_access: referral step skipped for %: % (%)', p_user, sqlerrm, sqlstate;
  end;
  select p.credit_balance into v_balance from public.profiles p where p.id = p_user;

  order_id := v_order;
  access_until := v_until;
  bonus := v_offer.bonus_credits;
  balance := v_balance;
  return next;
end;
$$;
revoke execute on function public.purchase_access(uuid, int, int, int) from public, anon, authenticated, service_role;
grant execute on function public.purchase_access(uuid, int, int, int) to service_role;

-- ---------------------------------------------------------------- 3. attach, rate limited per user
-- Body as in 20261112103709_referral_attach_acyclic.sql, plus the per-user limit after the programme check (an off
-- programme writes nothing).
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
  if not public.consume_rate_limit('referral_attach:' || v_user::text, 30, 600) then
    raise exception 'rate_limited' using errcode = 'P0001';
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

-- ---------------------------------------------------------------- 4. invitee deletion lock order
create or replace function private.referrals_before_invitee_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Profile first, like purchase_access (buyer profile, then referral rows), so the two never wait on each other in
  -- opposite orders.
  perform 1 from public.profiles p where p.id = old.id for update;
  delete from public.referrals where invitee_id = old.id and first_paid_at is null;
  return old;
end;
$$;
revoke execute on function private.referrals_before_invitee_delete() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- 5. read surfaces
drop function public.my_referral_summary();
create function public.my_referral_summary()
returns table (
  code text, enabled boolean, threshold int, credits_per_invitee int, duration_months int, has_access boolean,
  pending_count int, invitee_count int, credits_earned int, free_periods_earned int, max_rewarded int, cap_reached boolean
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
         (select count(*)::int from public.access_ledger l where l.user_id = auth.uid() and l.kind = 'referral_reward'),
         s.max_rewarded,
         -- The same count the cap uses at payment time (referral_on_purchase, rule 12).
         (select count(*) from public.referrals r
           where r.inviter_id = auth.uid() and r.state in ('pending', 'consumed_access', 'converted_credits'))
           >= s.max_rewarded
    from public.referral_settings s, public.access_settings a
   where s.id = 1 and a.id = 1;
$$;
revoke execute on function public.my_referral_summary() from public, anon, authenticated, service_role;
grant execute on function public.my_referral_summary() to authenticated;

drop function public.referral_public_settings();
create function public.referral_public_settings()
returns table (enabled boolean, threshold int, credits_per_invitee int, duration_months int, max_rewarded int,
               bonus_credits int)
language sql
stable
security definer
set search_path = ''
as $$
  select r.enabled, r.threshold, r.credits_per_invitee, a.duration_months, r.max_rewarded, a.bonus_credits
    from public.referral_settings r, public.access_settings a
   where r.id = 1 and a.id = 1;
$$;
revoke execute on function public.referral_public_settings() from public, anon, authenticated, service_role;
grant execute on function public.referral_public_settings() to anon, authenticated;

-- Body as in 20261106132444_credits.sql, plus the two links at the end of the row.
drop function public.admin_credit_ledger(uuid, int, bigint);
create function public.admin_credit_ledger(p_user uuid, p_limit int, p_before bigint default null)
returns table (id bigint, delta int, balance_after int, kind text, target text, reason text, created_at timestamptz,
               exercise_id uuid, exercise_type text, exercise_prompt text, admin_email text,
               referral_id uuid, access_order_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select l.id, l.delta, l.balance_after, l.kind, l.target, l.reason, l.created_at,
           l.exercise_id, e.type, e.prompt, a.email::text, l.referral_id, l.access_order_id
      from public.credit_ledger l
      left join public.consolidation_exercises e on e.id = l.exercise_id
      left join auth.users a on a.id = l.admin_id
     where l.user_id = p_user
       and (p_before is null or l.id < p_before)
     order by l.id desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;
revoke execute on function public.admin_credit_ledger(uuid, int, bigint) from public, anon, authenticated, service_role;
grant execute on function public.admin_credit_ledger(uuid, int, bigint) to authenticated;

-- ---------------------------------------------------------------- 6. one first-name rule
create or replace function private.referral_rows(p_inviter uuid)
returns table (
  id uuid, first_name text, email text, state text, created_at timestamptz, first_paid_at timestamptz,
  reward_credits int, account_deleted boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id,
         case when r.invitee_id is null then r.invitee_first_name else private.first_name_of(p.display_name) end,
         u.email::text,
         r.state,
         r.created_at,
         r.first_paid_at,
         case when r.state = 'converted_credits' then r.reward_credits end,
         r.invitee_id is null
    from public.referrals r
    left join public.profiles p on p.id = r.invitee_id
    left join auth.users u on u.id = r.invitee_id
   where r.inviter_id = p_inviter
   order by r.created_at desc, r.id;
$$;
revoke execute on function private.referral_rows(uuid) from public, anon, authenticated, service_role;

create or replace function public.admin_referral_context(p_user uuid)
returns table (code text, inviter_id uuid, inviter_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select c.code, r.inviter_id, private.first_name_of(p.display_name)
      from public.referrals r
      left join public.referral_codes c on c.user_id = r.inviter_id
      left join public.profiles p on p.id = r.inviter_id
     where r.invitee_id = p_user;
end;
$$;
revoke execute on function public.admin_referral_context(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_referral_context(uuid) to authenticated;
