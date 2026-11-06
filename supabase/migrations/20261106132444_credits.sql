-- Credits for digital-teacher (AI) checks: a balance per profile, an append-only ledger, credit packages and
-- purchase orders, a per-exercise cost, and the functions that are the only writers of the balance and the ledger.

-- ---------------------------------------------------------------- balance and exercise cost
-- Students keep table-level select on profiles; their only update grant is the display_name column, so the balance
-- is read-only for them.
alter table public.profiles
  add column credit_balance int not null default 0 check (credit_balance >= 0);

alter table public.consolidation_exercises
  add column credit_cost smallint not null default 1 check (credit_cost between 1 and 5);
-- Type defaults for the existing exercises: comparison and argument cost 2, every other type 1.
update public.consolidation_exercises set credit_cost = 2
  where type in ('comparison', 'argument') and credit_cost <> 2;

-- ---------------------------------------------------------------- settings and packages
create table public.credit_settings (
  id int primary key check (id = 1),
  welcome_credits int not null default 12 check (welcome_credits between 0 and 1000)
);
insert into public.credit_settings (id) values (1);

-- Packages are never deleted, only deactivated (orders reference them with on delete restrict).
create table public.credit_packages (
  id uuid primary key default gen_random_uuid(),
  credits int not null check (credits between 1 and 10000),
  price_bani int not null check (price_bani between 1 and 10000000),
  featured bool not null default false,
  active bool not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
-- At most one featured package among the active ones.
create unique index credit_packages_one_featured_idx on public.credit_packages ((true)) where featured and active;

insert into public.credit_packages (credits, price_bani, featured, active, sort_order) values
  (20, 999, false, true, 0),
  (50, 1999, true, true, 1),
  (120, 3999, false, true, 2);

-- ---------------------------------------------------------------- orders and ledger
-- credits and price_bani are a snapshot of the package at purchase time. provider/provider_ref leave room for a
-- payment provider (card processor or app-store billing) later.
create table public.credit_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  package_id uuid not null references public.credit_packages (id) on delete restrict,
  credits int not null,
  price_bani int not null,
  status text not null check (status in ('pending', 'approved', 'failed')),
  provider text not null default 'none',
  provider_ref text,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create index credit_orders_user_id_idx on public.credit_orders (user_id, created_at desc);
create index credit_orders_package_id_idx on public.credit_orders (package_id);

-- target: 'exercise' | 'whole' | 'req:<requirementId>' (essay checks record which part was checked).
create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  delta int not null check (delta <> 0),
  balance_after int not null check (balance_after >= 0),
  kind text not null check (kind in ('welcome', 'purchase', 'check', 'refund', 'admin')),
  exercise_id uuid references public.consolidation_exercises (id) on delete set null,
  target text,
  order_id uuid references public.credit_orders (id) on delete set null,
  admin_id uuid references auth.users (id) on delete set null,
  refund_of bigint unique references public.credit_ledger (id),
  reason text,
  created_at timestamptz not null default now(),
  constraint credit_ledger_admin_reason check (kind <> 'admin' or btrim(coalesce(reason, '')) <> '')
);
create index credit_ledger_user_id_idx on public.credit_ledger (user_id, id desc);
-- The welcome grant is given at most once per account.
create unique index credit_ledger_one_welcome_idx on public.credit_ledger (user_id) where kind = 'welcome';
create index credit_ledger_exercise_id_idx on public.credit_ledger (exercise_id) where exercise_id is not null;
create index credit_ledger_order_id_idx on public.credit_ledger (order_id) where order_id is not null;
create index credit_ledger_admin_id_idx on public.credit_ledger (admin_id) where admin_id is not null;

-- ---------------------------------------------------------------- RLS and grants
alter table public.credit_settings enable row level security;
alter table public.credit_packages enable row level security;
alter table public.credit_orders enable row level security;
alter table public.credit_ledger enable row level security;

create policy credit_settings_admin_select on public.credit_settings for select to authenticated
  using (public.is_admin());
create policy credit_settings_admin_update on public.credit_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy credit_packages_admin_select on public.credit_packages for select to authenticated
  using (public.is_admin());
create policy credit_packages_student_select on public.credit_packages for select to authenticated
  using (active);

create policy credit_orders_admin_select on public.credit_orders for select to authenticated
  using (public.is_admin());
create policy credit_orders_own_select on public.credit_orders for select to authenticated
  using (user_id = auth.uid());

create policy credit_ledger_admin_select on public.credit_ledger for select to authenticated
  using (public.is_admin());
create policy credit_ledger_own_select on public.credit_ledger for select to authenticated
  using (user_id = auth.uid());

-- Clients only read; every write goes through the functions below (packages are saved with
-- admin_save_credit_settings, the welcome credits too or with a direct admin update).
revoke all on public.credit_settings, public.credit_packages, public.credit_orders, public.credit_ledger
  from anon, authenticated;
revoke all on sequence public.credit_ledger_id_seq from anon, authenticated;
grant select on public.credit_settings, public.credit_packages, public.credit_orders, public.credit_ledger
  to authenticated;
grant update (welcome_credits) on public.credit_settings to authenticated;

-- ---------------------------------------------------------------- credit_apply (internal)
-- The only writer of profiles.credit_balance and credit_ledger. Locks the profile row, then applies the delta with
-- one conditional update. When the result would be negative nothing is written and it returns (null, balance).
create function public.credit_apply(
  p_user uuid, p_delta int, p_kind text, p_exercise uuid, p_target text,
  p_order uuid, p_admin uuid, p_reason text, p_refund_of bigint)
returns table (entry_id bigint, balance int)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_current int;
  v_new int;
  v_entry bigint;
begin
  select p.credit_balance into v_current from public.profiles p where p.id = p_user for update;
  if not found then
    raise exception 'profile_not_found' using errcode = 'P0001';
  end if;

  update public.profiles p set credit_balance = p.credit_balance + p_delta
   where p.id = p_user and p.credit_balance + p_delta >= 0
  returning p.credit_balance into v_new;

  if not found then
    entry_id := null;
    balance := v_current;
    return next;
    return;
  end if;

  insert into public.credit_ledger
    (user_id, delta, balance_after, kind, exercise_id, target, order_id, admin_id, reason, refund_of)
  values (p_user, p_delta, v_new, p_kind, p_exercise, p_target, p_order, p_admin, p_reason, p_refund_of)
  returning id into v_entry;

  entry_id := v_entry;
  balance := v_new;
  return next;
end;
$$;
revoke execute on function public.credit_apply(uuid, int, text, uuid, text, uuid, uuid, text, bigint)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- service-role functions
-- Charges a check. Returns (null, balance) without charging when the balance is too low.
create function public.spend_credits(p_user uuid, p_amount int, p_exercise uuid, p_target text)
returns table (entry_id bigint, balance int)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'bad_amount' using errcode = 'P0001';
  end if;
  return query
    select a.entry_id, a.balance
      from public.credit_apply(p_user, -p_amount, 'check', p_exercise, p_target, null, null, null, null) a;
end;
$$;
revoke execute on function public.spend_credits(uuid, int, uuid, text) from public, anon, authenticated;
grant execute on function public.spend_credits(uuid, int, uuid, text) to service_role;

-- Gives a check back. Idempotent: a second call for the same entry inserts nothing and returns the balance.
create function public.refund_credits(p_entry bigint)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orig public.credit_ledger;
  v_balance int;
begin
  select * into v_orig from public.credit_ledger l where l.id = p_entry;
  if not found then
    raise exception 'entry_not_found' using errcode = 'P0001';
  end if;
  if v_orig.kind <> 'check' then
    raise exception 'not_refundable' using errcode = 'P0001';
  end if;

  -- The profile lock serialises concurrent refunds of the same entry.
  select p.credit_balance into v_balance from public.profiles p where p.id = v_orig.user_id for update;
  if exists (select 1 from public.credit_ledger l where l.refund_of = p_entry) then
    return v_balance;
  end if;

  select a.balance into v_balance
    from public.credit_apply(v_orig.user_id, -v_orig.delta, 'refund', v_orig.exercise_id, v_orig.target,
                             null, null, null, p_entry) a;
  return v_balance;
end;
$$;
revoke execute on function public.refund_credits(bigint) from public, anon, authenticated;
grant execute on function public.refund_credits(bigint) to service_role;

-- Buys a package. No payment yet: the order is approved at once from a snapshot of the package.
create function public.purchase_credit_package(p_user uuid, p_package uuid)
returns table (order_id uuid, credits int, balance int)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_pkg public.credit_packages;
  v_order uuid;
  v_balance int;
begin
  select * into v_pkg from public.credit_packages k where k.id = p_package and k.active for share;
  if not found then
    raise exception 'package_unavailable' using errcode = 'P0001';
  end if;

  insert into public.credit_orders (user_id, package_id, credits, price_bani, status, approved_at)
  values (p_user, v_pkg.id, v_pkg.credits, v_pkg.price_bani, 'approved', now())
  returning id into v_order;

  select a.balance into v_balance
    from public.credit_apply(p_user, v_pkg.credits, 'purchase', null, null, v_order, null, null, null) a;

  order_id := v_order;
  credits := v_pkg.credits;
  balance := v_balance;
  return next;
end;
$$;
revoke execute on function public.purchase_credit_package(uuid, uuid) from public, anon, authenticated;
grant execute on function public.purchase_credit_package(uuid, uuid) to service_role;

-- ---------------------------------------------------------------- admin functions
-- Manual adjustment with a mandatory reason; never takes the balance below 0.
create function public.admin_adjust_credits(p_user uuid, p_delta int, p_reason text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry bigint;
  v_balance int;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  if coalesce(p_delta, 0) = 0 then
    raise exception 'bad_delta' using errcode = 'P0001';
  end if;

  select a.entry_id, a.balance into v_entry, v_balance
    from public.credit_apply(p_user, p_delta, 'admin', null, null, null, auth.uid(), btrim(p_reason), null) a;
  if v_entry is null then
    raise exception 'insufficient_balance' using errcode = 'P0001';
  end if;
  return v_balance;
end;
$$;
revoke execute on function public.admin_adjust_credits(uuid, int, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_adjust_credits(uuid, int, text) to authenticated;

-- Saves the welcome credits and the packages in one transaction. p_packages is an array of
-- {id?, credits, price_bani, featured, active}; the array index becomes sort_order. Rows with an id are updated,
-- rows without one are inserted, nothing is deleted. The featured flag is cleared on every package first, so the
-- one-featured index never trips mid-save (a package left out of the array loses its featured flag).
create function public.admin_save_credit_settings(p_welcome int, p_packages jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pkg jsonb;
  v_idx int;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_packages is null or jsonb_typeof(p_packages) <> 'array' then
    raise exception 'bad_packages' using errcode = 'P0001';
  end if;

  update public.credit_settings set welcome_credits = p_welcome where id = 1;
  update public.credit_packages set featured = false where featured;

  for v_pkg, v_idx in
    select e.value, (e.ordinality - 1)::int from jsonb_array_elements(p_packages) with ordinality e
  loop
    if nullif(v_pkg ->> 'id', '') is not null then
      update public.credit_packages
         set credits = (v_pkg ->> 'credits')::int,
             price_bani = (v_pkg ->> 'price_bani')::int,
             featured = coalesce((v_pkg ->> 'featured')::boolean, false),
             active = coalesce((v_pkg ->> 'active')::boolean, true),
             sort_order = v_idx
       where id = (v_pkg ->> 'id')::uuid;
      if not found then
        raise exception 'package_not_found' using errcode = 'P0001';
      end if;
    else
      insert into public.credit_packages (credits, price_bani, featured, active, sort_order)
      values ((v_pkg ->> 'credits')::int, (v_pkg ->> 'price_bani')::int,
              coalesce((v_pkg ->> 'featured')::boolean, false), coalesce((v_pkg ->> 'active')::boolean, true), v_idx);
    end if;
  end loop;
end;
$$;
revoke execute on function public.admin_save_credit_settings(int, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.admin_save_credit_settings(int, jsonb) to authenticated;

-- Students (every profile that is not an admin) with their email, newest first. p_search matches part of the name
-- or the email; p_id fetches one student. total is the number of matches before limit/offset.
create function public.admin_students(p_search text, p_limit int, p_offset int, p_id uuid default null)
returns table (id uuid, display_name text, email text, credit_balance int, created_at timestamptz, total bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_pattern text;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- Treat the search as plain text: escape the like wildcards.
  v_pattern := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
    select p.id, p.display_name, u.email::text, p.credit_balance, p.created_at, count(*) over ()
      from public.profiles p
      join auth.users u on u.id = p.id
     where not exists (select 1 from public.admins a where a.user_id = p.id)
       and (p_id is null or p.id = p_id)
       and (v_search is null or p.display_name ilike v_pattern or u.email ilike v_pattern)
     order by p.created_at desc, p.id
     limit least(greatest(coalesce(p_limit, 50), 1), 200)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
revoke execute on function public.admin_students(text, int, int, uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_students(text, int, int, uuid) to authenticated;

-- One student's ledger, newest first, paged with p_before (the last id already shown).
create function public.admin_credit_ledger(p_user uuid, p_limit int, p_before bigint default null)
returns table (id bigint, delta int, balance_after int, kind text, target text, reason text, created_at timestamptz,
               exercise_id uuid, exercise_type text, exercise_prompt text, admin_email text)
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
           l.exercise_id, e.type, e.prompt, a.email::text
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
