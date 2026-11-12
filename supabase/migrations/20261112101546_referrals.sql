-- Referrals: every student has a code; a paying invitee rewards their inviter. This file holds the schema, the
-- code generator, settings and RLS. Clients only read; every write goes through security definer functions.

-- ---------------------------------------------------------------- settings
create table public.referral_settings (
  id int primary key check (id = 1),
  enabled boolean not null default false,
  threshold int not null default 5 check (threshold between 1 and 100),
  credits_per_invitee int not null default 40 check (credits_per_invitee between 0 and 10000),
  max_rewarded int not null default 100 check (max_rewarded between 1 and 10000)
);
insert into public.referral_settings (id) values (1);

-- ---------------------------------------------------------------- codes
create table public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[A-HJKMNP-Z2-9]{8}$')
);

-- 8 characters from a 31-letter alphabet without look-alikes (no I, L, O, 0, 1), from a cryptographic source.
create function private.new_referral_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  c_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_bytes bytea;
begin
  loop
    v_bytes := extensions.gen_random_bytes(8);
    v_code := '';
    for i in 0..7 loop
      v_code := v_code || substr(c_alphabet, (get_byte(v_bytes, i) % 31) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.referral_codes where code = v_code);
  end loop;
  return v_code;
end;
$$;
revoke execute on function private.new_referral_code() from public, anon, authenticated, service_role;

-- Gives every non-admin profile without a code one. Run once below; safe to rerun.
create function private.backfill_referral_codes()
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_row record;
  v_n int := 0;
begin
  for v_row in
    select p.id from public.profiles p
     where not exists (select 1 from public.admins a where a.user_id = p.id)
       and not exists (select 1 from public.referral_codes c where c.user_id = p.id)
  loop
    insert into public.referral_codes (user_id, code) values (v_row.id, private.new_referral_code());
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke execute on function private.backfill_referral_codes() from public, anon, authenticated, service_role;
select private.backfill_referral_codes();

-- ---------------------------------------------------------------- referrals
-- invitee_id becomes null when a paid invitee deletes their account; invitee_first_name is a snapshot (later
-- tasks refresh it).
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users (id) on delete cascade,
  invitee_id uuid unique references auth.users (id) on delete set null,
  invitee_first_name text not null default 'Coleg',
  created_at timestamptz not null default now(),
  first_paid_at timestamptz,
  state text not null default 'registered' check (state in (
    'registered', 'pending', 'consumed_access', 'converted_credits', 'over_cap', 'not_rewarded_disabled')),
  reward_credits int,
  access_ledger_id bigint,
  credit_ledger_id bigint
);
create index referrals_inviter_id_idx on public.referrals (inviter_id, created_at desc);

-- An unpaid referral disappears with its invitee; a paid one is kept (the FK nulls invitee_id). Runs before the
-- cascade on auth.users.
create function private.referrals_before_invitee_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.referrals where invitee_id = old.id and first_paid_at is null;
  return old;
end;
$$;
revoke execute on function private.referrals_before_invitee_delete() from public, anon, authenticated, service_role;
create trigger referrals_before_invitee_delete before delete on auth.users
  for each row execute function private.referrals_before_invitee_delete();

-- ---------------------------------------------------------------- RLS and grants
alter table public.referral_settings enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;

-- Students read none of the settings directly (a public settings RPC comes later).
create policy referral_settings_admin_select on public.referral_settings for select to authenticated
  using (public.is_admin());
create policy referral_codes_admin_select on public.referral_codes for select to authenticated
  using (public.is_admin());
create policy referral_codes_own_select on public.referral_codes for select to authenticated
  using (user_id = auth.uid());
create policy referrals_admin_select on public.referrals for select to authenticated
  using (public.is_admin());
create policy referrals_inviter_select on public.referrals for select to authenticated
  using (inviter_id = auth.uid());

revoke all on public.referral_settings, public.referral_codes, public.referrals from anon, authenticated;
grant select on public.referral_settings, public.referral_codes, public.referrals to authenticated;

-- ---------------------------------------------------------------- ledger kinds and timeline
alter table public.access_ledger drop constraint access_ledger_kind_check;
alter table public.access_ledger add constraint access_ledger_kind_check
  check (kind in ('purchase', 'admin_grant', 'admin_revoke', 'referral_reward'));
-- A reason is required only for admin actions.
alter table public.access_ledger drop constraint access_ledger_admin_reason;
alter table public.access_ledger add constraint access_ledger_admin_reason
  check (kind in ('purchase', 'referral_reward') or btrim(coalesce(reason, '')) <> '');

alter table public.credit_ledger drop constraint credit_ledger_kind_check;
alter table public.credit_ledger add constraint credit_ledger_kind_check
  check (kind in ('welcome', 'purchase', 'check', 'refund', 'admin', 'access_bonus', 'referral'));
alter table public.credit_ledger add column referral_id uuid references public.referrals (id) on delete set null;
create index credit_ledger_referral_id_idx on public.credit_ledger (referral_id) where referral_id is not null;

alter table public.student_events drop constraint student_events_kind_check;
alter table public.student_events add constraint student_events_kind_check check (kind in (
  'registered', 'welcome_credits', 'name_changed', 'mode_changed', 'app_opened',
  'lesson_started', 'lesson_finished', 'test_failed', 'consolidation_started', 'consolidation_finished',
  'check', 'check_refunded', 'check_blocked',
  'purchase', 'credits_adjusted',
  'suspended', 'reactivated', 'progress_reset',
  'access_purchased', 'access_granted', 'access_revoked', 'access_expired',
  'bac_started', 'bac_submitted', 'bac_graded', 'bac_grading_failed',
  'referral_joined', 'referral_access', 'referral_credits'));

-- A 'referral' ledger row (credits converted from the reward) appears on the timeline as referral_credits.
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
           when 'referral' then 'referral_credits'
         end,
         case p_entry.kind
           when 'check' then jsonb_build_object('cost', -p_entry.delta, 'target', p_entry.target)
           when 'admin' then jsonb_build_object('delta', p_entry.delta, 'reason', p_entry.reason)
           else jsonb_build_object('credits', p_entry.delta)
         end;
$$;

-- ---------------------------------------------------------------- settings RPC
-- The check constraints on referral_settings reject out-of-range values (23514).
create function public.admin_save_referral_settings(p_enabled boolean, p_threshold int, p_credits int, p_max int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.referral_settings
     set enabled = p_enabled, threshold = p_threshold, credits_per_invitee = p_credits, max_rewarded = p_max
   where id = 1;
end;
$$;
revoke execute on function public.admin_save_referral_settings(boolean, int, int, int)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_save_referral_settings(boolean, int, int, int) to authenticated;

-- ---------------------------------------------------------------- code for every new profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(btrim(left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'name'), '')),
      60)), '')
  );
  insert into public.referral_codes (user_id, code) values (new.id, private.new_referral_code());
  perform public.grant_welcome_credits(new.id, new.email);

  if btrim(coalesce(new.email, '')) <> '' then
    select b.reason into v_reason from public.blocked_emails b
     where b.email_hash = private.email_fingerprint(new.email);
    if found then
      update public.profiles
         set suspended_at = now(), suspended_reason = v_reason, suspended_by = null, reregistration_blocked = true
       where id = new.id;
      perform public.log_student_event(new.id, 'suspended', null, null, null,
        jsonb_build_object('reason', v_reason, 'blocked', true));
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
