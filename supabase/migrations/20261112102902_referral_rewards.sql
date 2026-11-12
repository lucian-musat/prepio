-- Referral rewards, decided inside purchase_access (the only trigger; admin grants never reward).
--
-- Locks: purchase_access holds the buyer's profile; the invitee path then locks the inviter's profile, then that
-- inviter's referral rows. The inviter path (converting the buyer's own pending invitees) only touches the buyer's
-- profile and the buyer's referral rows, never an invitee's profile. Every state change of an inviter's referral
-- rows (after registration) happens under that inviter's profile lock, so counts taken under it are stable.

-- ---------------------------------------------------------------- helpers
-- Credits one referral to its inviter: a credit_ledger row of kind 'referral' linked both ways (its timeline event,
-- referral_credits, comes from the ledger trigger), the value snapshotted on the referral. No ledger row for 0.
create function private.referral_credit(p_referral uuid, p_inviter uuid, p_credits int)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_entry bigint;
begin
  if p_credits > 0 then
    select a.entry_id into v_entry
      from public.credit_apply(p_inviter, p_credits, 'referral', null, null, null, null, null, null) a;
    update public.credit_ledger l set referral_id = p_referral where l.id = v_entry;
  end if;
  update public.referrals r
     set state = 'converted_credits', reward_credits = p_credits, credit_ledger_id = v_entry
   where r.id = p_referral;
end;
$$;
revoke execute on function private.referral_credit(uuid, uuid, int) from public, anon, authenticated, service_role;

-- Rule 4: the inviter bought access, so every pending invitee converts to credits. The caller holds the inviter's
-- profile lock. Nothing happens while referrals are disabled (kill switch) or for an admin.
create function private.referral_convert_pending(p_inviter uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_settings public.referral_settings;
  v_id uuid;
begin
  select * into v_settings from public.referral_settings s where s.id = 1;
  if not coalesce(v_settings.enabled, false)
     or exists (select 1 from public.admins a where a.user_id = p_inviter) then
    return;
  end if;
  for v_id in
    select r.id from public.referrals r
     where r.inviter_id = p_inviter and r.state = 'pending'
     order by r.first_paid_at, r.created_at, r.id
       for update
  loop
    perform private.referral_credit(v_id, p_inviter, v_settings.credits_per_invitee);
  end loop;
end;
$$;
revoke execute on function private.referral_convert_pending(uuid) from public, anon, authenticated, service_role;

-- Rules 1-3, 11, 12: the invitee's first approved order rewards their inviter. first_paid_at is set exactly once
-- and is the idempotency guard: a renewal or a retry finds it set and changes nothing.
create function private.referral_on_purchase(p_invitee uuid)
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
  if v_ref.first_paid_at is not null then
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

  update public.referrals r set state = 'consumed_access', access_ledger_id = v_entry
   where r.id in (
     select x.id from public.referrals x
      where x.inviter_id = v_ref.inviter_id and x.state = 'pending'
      order by x.first_paid_at, x.created_at, x.id
      limit v_settings.threshold
        for update);

  perform public.log_student_event(v_ref.inviter_id, 'referral_access', null, null, null,
    jsonb_build_object('months', v_months, 'until', v_until, 'invitees', v_settings.threshold));
end;
$$;
revoke execute on function private.referral_on_purchase(uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- purchase (service role)
-- Body as in 20261108091845_paid_access.sql, plus the referral step after the purchase is recorded: first the
-- buyer's own pending invitees convert to credits (the buyer now has access), then the buyer as an invitee.
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

  perform private.referral_convert_pending(p_user);
  perform private.referral_on_purchase(p_user);
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
