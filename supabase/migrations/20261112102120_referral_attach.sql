-- Referral lookup (public, rate limited) and attach (authenticated, during onboarding of a new account).

create function private.normalize_referral_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$ select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) $$;
revoke execute on function private.normalize_referral_code(text) from public, anon, authenticated, service_role;

-- First whitespace-separated word of a display name; 'Coleg' when there is none.
create function private.first_name_of(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$ select coalesce(nullif(split_part(btrim(coalesce(p_name, '')), ' ', 1), ''), 'Coleg') $$;
revoke execute on function private.first_name_of(text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- public settings
create function public.referral_public_settings()
returns table (enabled boolean, threshold int, credits_per_invitee int, duration_months int, max_rewarded int)
language sql
stable
security definer
set search_path = ''
as $$
  select r.enabled, r.threshold, r.credits_per_invitee, a.duration_months, r.max_rewarded
    from public.referral_settings r, public.access_settings a
   where r.id = 1 and a.id = 1;
$$;
revoke execute on function public.referral_public_settings() from public, anon, authenticated, service_role;
grant execute on function public.referral_public_settings() to anon, authenticated;

-- ---------------------------------------------------------------- lookup
-- Returns only validity and the inviter's first name. 30 calls per minute per client address (the first
-- x-forwarded-for entry PostgREST passes along); over the limit it answers valid = false.
create function public.referral_lookup(p_code text)
returns table (valid boolean, inviter_first_name text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_headers jsonb;
  v_ip text;
  v_inviter uuid;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;
  v_ip := coalesce(nullif(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''), 'unknown');
  if not public.consume_rate_limit('referral_lookup:' || v_ip, 30, 60) then
    return query select false, null::text;
    return;
  end if;
  if not (select s.enabled from public.referral_settings s where s.id = 1) then
    return query select false, null::text;
    return;
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
revoke execute on function public.referral_lookup(text) from public, anon, authenticated, service_role;
grant execute on function public.referral_lookup(text) to anon, authenticated;

-- ---------------------------------------------------------------- attach
-- 'attached' | 'invalid' | 'disabled' | 'not_allowed' | 'self'. Precedence: disabled, invalid, self, not_allowed.
-- "New account": profile under 24 hours old, onboarding (terms, name, mode) not complete, no order, no lesson or
-- consolidation activity, no inviter yet, not an admin.
create function public.referral_attach(p_code text)
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
     or exists (select 1 from public.consolidation_runs c where c.user_id = v_user) then
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
