-- Separates the owner's two roles: lucian@musat.dev stays the admin (e-mail + password), lucian.m91@gmail.com becomes a
-- plain student account (Google), with its referral code. One Supabase user is one e-mail, so the two roles need two
-- e-mails. The helper refuses unless the replacement exists and is an admin, so the project can never be left without
-- the admin the owner signs in with. Other admins are not touched.

create function private.demote_admin_to_student(p_email text, p_replacement_email text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_user uuid;
  v_replacement uuid;
begin
  select u.id into v_replacement from auth.users u where lower(u.email) = lower(p_replacement_email);
  if v_replacement is null
     or lower(p_email) = lower(p_replacement_email)
     or not exists (select 1 from public.admins a where a.user_id = v_replacement) then
    return 'replacement_not_admin';
  end if;

  select u.id into v_user from auth.users u where lower(u.email) = lower(p_email);
  if v_user is null then
    return 'user_not_found';
  end if;
  if not exists (select 1 from public.admins a where a.user_id = v_user) then
    return 'not_admin';
  end if;

  delete from public.admins where user_id = v_user;
  -- Admins have no referral code (the backfill skips them): the new student gets one now.
  perform private.backfill_referral_codes();
  return 'demoted';
end;
$$;
revoke execute on function private.demote_admin_to_student(text, text) from public, anon, authenticated, service_role;

-- Local and test databases have neither account: the call is a no-op there ('replacement_not_admin' or
-- 'user_not_found').
select private.demote_admin_to_student('lucian.m91@gmail.com', 'lucian@musat.dev');
