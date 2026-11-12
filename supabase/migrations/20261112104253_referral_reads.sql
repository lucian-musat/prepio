-- Referrals: read functions for the student screen and the admin student page. All are security definer and
-- filter on auth.uid() (student) or require an admin, so nobody needs direct read access to other users' rows.

-- Shared row builder: referrals of one inviter, newest first. Not callable by clients.
create function private.referral_rows(p_inviter uuid)
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
         case when r.invitee_id is null then r.invitee_first_name
              else coalesce(nullif(split_part(btrim(coalesce(p.display_name, '')), ' ', 1), ''), 'Coleg') end,
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

create function public.my_referral_summary()
returns table (
  code text, enabled boolean, threshold int, credits_per_invitee int, duration_months int, has_access boolean,
  pending_count int, invitee_count int, credits_earned int, free_periods_earned int
)
language sql
stable
security definer
set search_path = ''
as $$
  select (select c.code from public.referral_codes c where c.user_id = auth.uid()),
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
revoke execute on function public.my_referral_summary() from public, anon, authenticated, service_role;
grant execute on function public.my_referral_summary() to authenticated;

create function public.my_referrals()
returns table (
  id uuid, first_name text, email text, state text, created_at timestamptz, first_paid_at timestamptz,
  reward_credits int, account_deleted boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from private.referral_rows(auth.uid());
$$;
revoke execute on function public.my_referrals() from public, anon, authenticated, service_role;
grant execute on function public.my_referrals() to authenticated;

create function public.admin_referrals(p_user uuid)
returns table (
  id uuid, first_name text, email text, state text, created_at timestamptz, first_paid_at timestamptz,
  reward_credits int, account_deleted boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from private.referral_rows(p_user);
end;
$$;
revoke execute on function public.admin_referrals(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_referrals(uuid) to authenticated;

-- Who invited this student: the inviter and the code they used (the inviter's code). No row when nobody did.
create function public.admin_referral_context(p_user uuid)
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
    select c.code, r.inviter_id,
           coalesce(nullif(split_part(btrim(coalesce(p.display_name, '')), ' ', 1), ''), 'Coleg')
      from public.referrals r
      left join public.referral_codes c on c.user_id = r.inviter_id
      left join public.profiles p on p.id = r.inviter_id
     where r.invitee_id = p_user;
end;
$$;
revoke execute on function public.admin_referral_context(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_referral_context(uuid) to authenticated;
