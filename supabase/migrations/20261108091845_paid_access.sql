-- Paid access: accounts start in a trial (first lesson only); a one-off payment opens every lesson until
-- profiles.access_until and adds bonus credits. This file holds the schema and the money functions; lesson access
-- and RLS enforcement are appended further down.
-- profiles.access_until is written only by the security definer functions below, which also write access_ledger.

-- ---------------------------------------------------------------- offer
create table public.access_settings (
  id int primary key check (id = 1),
  price_bani int not null default 15000 check (price_bani between 1 and 10000000),
  bonus_credits int not null default 100 check (bonus_credits between 0 and 10000),
  duration_months int not null default 3 check (duration_months between 1 and 24)
);
insert into public.access_settings (id) values (1);

-- Students keep table-level select on profiles and only a column-level update grant (display_name), so
-- access_until is read-only for them.
alter table public.profiles add column access_until timestamptz;

-- ---------------------------------------------------------------- orders and ledger
-- price_bani, bonus_credits and duration_months are a snapshot of the offer at purchase time.
create table public.access_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  price_bani int not null,
  bonus_credits int not null,
  duration_months int not null,
  status text not null check (status in ('pending', 'approved', 'failed')),
  provider text not null default 'none',
  provider_ref text,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create index access_orders_user_id_idx on public.access_orders (user_id, created_at desc);
create unique index access_orders_provider_ref_idx on public.access_orders (provider, provider_ref)
  where provider_ref is not null;

create table public.access_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('purchase', 'admin_grant', 'admin_revoke')),
  months int,
  until_before timestamptz,
  until_after timestamptz not null,
  order_id uuid references public.access_orders (id) on delete set null,
  admin_id uuid references auth.users (id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  constraint access_ledger_admin_reason check (kind = 'purchase' or btrim(coalesce(reason, '')) <> '')
);
create index access_ledger_user_id_idx on public.access_ledger (user_id, id desc);
create index access_ledger_order_id_idx on public.access_ledger (order_id) where order_id is not null;
create index access_ledger_admin_id_idx on public.access_ledger (admin_id) where admin_id is not null;

-- ---------------------------------------------------------------- RLS and grants
alter table public.access_settings enable row level security;
alter table public.access_orders enable row level security;
alter table public.access_ledger enable row level security;

-- Every signed-in user reads the offer (the paywall shows it).
create policy access_settings_select on public.access_settings for select to authenticated
  using (true);

create policy access_orders_admin_select on public.access_orders for select to authenticated
  using (public.is_admin());
create policy access_orders_own_select on public.access_orders for select to authenticated
  using (user_id = auth.uid());

create policy access_ledger_admin_select on public.access_ledger for select to authenticated
  using (public.is_admin());
create policy access_ledger_own_select on public.access_ledger for select to authenticated
  using (user_id = auth.uid());

-- Clients only read; every write goes through the functions below.
revoke all on public.access_settings, public.access_orders, public.access_ledger from anon, authenticated;
revoke all on sequence public.access_ledger_id_seq from anon, authenticated;
grant select on public.access_settings, public.access_orders, public.access_ledger to authenticated;

-- ---------------------------------------------------------------- credit ledger and timeline
alter table public.credit_ledger drop constraint credit_ledger_kind_check;
alter table public.credit_ledger add constraint credit_ledger_kind_check
  check (kind in ('welcome', 'purchase', 'check', 'refund', 'admin', 'access_bonus'));
alter table public.credit_ledger add column access_order_id uuid references public.access_orders (id) on delete set null;
create index credit_ledger_access_order_id_idx on public.credit_ledger (access_order_id) where access_order_id is not null;

alter table public.student_events drop constraint student_events_kind_check;
alter table public.student_events add constraint student_events_kind_check check (kind in (
  'registered', 'welcome_credits', 'name_changed', 'mode_changed', 'app_opened',
  'lesson_started', 'lesson_finished', 'test_failed', 'consolidation_started', 'consolidation_finished',
  'check', 'check_refunded', 'check_blocked',
  'purchase', 'credits_adjusted',
  'suspended', 'reactivated', 'progress_reset',
  'access_purchased', 'access_granted', 'access_revoked', 'access_expired'));

-- An access_bonus ledger row has no timeline event of its own: purchase_access logs access_purchased. The ledger
-- trigger (student_events_on_ledger_insert) already skips rows whose kind is null.
create or replace function public.student_event_of_ledger(p_entry public.credit_ledger)
returns table (kind text, details jsonb)
language sql
stable
set search_path = ''
as $$
  select case p_entry.kind
           when 'welcome' then 'welcome_credits'
           when 'check' then 'check'
           when 'refund' then 'check_refunded'
           when 'purchase' then 'purchase'
           when 'admin' then 'credits_adjusted'
           when 'access_bonus' then null
         end,
         case p_entry.kind
           when 'check' then jsonb_build_object('cost', -p_entry.delta, 'target', p_entry.target)
           when 'admin' then jsonb_build_object('delta', p_entry.delta, 'reason', p_entry.reason)
           else jsonb_build_object('credits', p_entry.delta)
         end;
$$;

-- ---------------------------------------------------------------- private helpers
-- The one extension rule: from the later of now and the current end, add whole calendar months (UTC).
create function private.extend_access(p_until timestamptz, p_months int, p_now timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select greatest(p_now, coalesce(p_until, p_now)) + p_months * interval '1 month';
$$;
revoke execute on function private.extend_access(timestamptz, int, timestamptz)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- purchase (service role)
-- Sells access. No payment yet: the order is approved at once from a snapshot of the offer. The caller passes the
-- offer it showed the student; any difference from access_settings raises offer_changed and writes nothing.
create function public.purchase_access(p_user uuid, p_price_bani int, p_bonus int, p_months int)
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

  order_id := v_order;
  access_until := v_until;
  bonus := v_offer.bonus_credits;
  balance := v_balance;
  return next;
end;
$$;
revoke execute on function public.purchase_access(uuid, int, int, int) from public, anon, authenticated, service_role;
grant execute on function public.purchase_access(uuid, int, int, int) to service_role;

-- ---------------------------------------------------------------- admin functions
-- Gives a student free months (same extension rule as a purchase, no credits).
create function public.admin_grant_access(p_user uuid, p_months int, p_reason text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_current timestamptz;
  v_until timestamptz;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_reason = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  if p_months is null or p_months < 1 or p_months > 24 then
    raise exception 'bad_months' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.admins a where a.user_id = p_user) then
    raise exception 'cannot_target_admin' using errcode = 'P0001';
  end if;

  select p.access_until into v_current from public.profiles p where p.id = p_user for update;
  if not found then
    raise exception 'student_not_found' using errcode = 'P0001';
  end if;

  v_until := private.extend_access(v_current, p_months, now());
  update public.profiles p set access_until = v_until where p.id = p_user;
  insert into public.access_ledger (user_id, kind, months, until_before, until_after, admin_id, reason)
  values (p_user, 'admin_grant', p_months, v_current, v_until, auth.uid(), v_reason);
  perform public.log_student_event(p_user, 'access_granted', null, null, auth.uid(),
    jsonb_build_object('months', p_months, 'until', v_until, 'reason', v_reason));
  return v_until;
end;
$$;
revoke execute on function public.admin_grant_access(uuid, int, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_grant_access(uuid, int, text) to authenticated;

-- Ends full access now (back to the trial). Credits are kept.
create function public.admin_revoke_access(p_user uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_current timestamptz;
  v_until timestamptz := now();
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_reason = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.admins a where a.user_id = p_user) then
    raise exception 'cannot_target_admin' using errcode = 'P0001';
  end if;

  select p.access_until into v_current from public.profiles p where p.id = p_user for update;
  if not found then
    raise exception 'student_not_found' using errcode = 'P0001';
  end if;

  update public.profiles p set access_until = v_until where p.id = p_user;
  insert into public.access_ledger (user_id, kind, until_before, until_after, admin_id, reason)
  values (p_user, 'admin_revoke', v_current, v_until, auth.uid(), v_reason);
  perform public.log_student_event(p_user, 'access_revoked', null, null, auth.uid(),
    jsonb_build_object('reason', v_reason, 'until', v_until));
end;
$$;
revoke execute on function public.admin_revoke_access(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_revoke_access(uuid, text) to authenticated;

-- The check constraints on access_settings reject out-of-range values (23514).
create function public.admin_save_access_settings(p_price_bani int, p_bonus int, p_months int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.access_settings
     set price_bani = p_price_bani, bonus_credits = p_bonus, duration_months = p_months
   where id = 1;
end;
$$;
revoke execute on function public.admin_save_access_settings(int, int, int) from public, anon, authenticated, service_role;
grant execute on function public.admin_save_access_settings(int, int, int) to authenticated;

-- ---------------------------------------------------------------- expiry log
-- One access_expired event per expiry, dated at the moment access ended. Skips an expiry that an admin revoke
-- already logged (the revoke event carries the same until). Idempotent: runs every 10 minutes.
create function private.log_access_expiries()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  with expired as (
    select p.id, p.access_until
      from public.profiles p
     where p.access_until <= now()
       and not exists (select 1 from public.admins a where a.user_id = p.id)
       and not exists (
         select 1 from public.student_events e
          where e.user_id = p.id
            and e.kind in ('access_expired', 'access_revoked')
            and (e.details ->> 'until')::timestamptz = p.access_until)
  ), ins as (
    insert into public.student_events (user_id, kind, details, created_at)
    select x.id, 'access_expired', jsonb_build_object('until', x.access_until), x.access_until
      from expired x
    returning 1
  )
  select count(*)::int into v_count from ins;
  return v_count;
end;
$$;
revoke execute on function private.log_access_expiries() from public, anon, authenticated, service_role;

create extension if not exists pg_cron;
select cron.schedule('log-access-expiries', '*/10 * * * *', $$select private.log_access_expiries()$$);
