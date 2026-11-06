-- Student suspension: an admin suspends a student with a reason the student sees. A suspended student can read their
-- own profile, own credit ledger and orders, and delete their account; every student-facing content and progress
-- table is closed to them by a restrictive policy. Deleted accounts can leave a blocked email fingerprint behind, so
-- signing up again with that email gives a suspended account.

-- ---------------------------------------------------------------- profiles
-- Students have no update grant on these columns (their only column grants are display_name and learning_mode).
alter table public.profiles
  add column suspended_at timestamptz,
  add column suspended_reason text,
  add column suspended_by uuid references auth.users (id) on delete set null,
  add column reregistration_blocked boolean not null default false,
  add constraint profiles_suspension_reason_check check ((suspended_at is null) = (suspended_reason is null)),
  add constraint profiles_suspension_reason_not_blank check (suspended_reason is null or btrim(suspended_reason) <> '');
create index profiles_suspended_by_idx on public.profiles (suspended_by) where suspended_by is not null;

-- Security definer so the check reads the profile without going through profiles RLS from inside other policies.
create function public.is_suspended()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.suspended_at is not null);
$$;
revoke execute on function public.is_suspended() from public, anon, service_role;
grant execute on function public.is_suspended() to authenticated;

-- ---------------------------------------------------------------- enforcement
-- Restrictive: combined with AND over the existing permissive policies. Admins are authenticated too and keep full
-- access. The service role bypasses RLS. Not on profiles, credit_ledger or credit_orders (the student still reads
-- those). The (select ...) wrappers make Postgres evaluate each function once per statement, not once per row.
do $$
declare
  t text;
begin
  foreach t in array array[
    'nodes', 'lessons', 'cards', 'questions', 'sources', 'solution_templates', 'consolidation_exercises',
    'consolidation_exercise_sources', 'lesson_progress', 'consolidation_attempts', 'consolidation_runs',
    'credit_packages', 'settings']
  loop
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated '
      'using ((select public.is_admin()) or not (select public.is_suspended())) '
      'with check ((select public.is_admin()) or not (select public.is_suspended()))',
      t || '_not_suspended', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------- blocked_emails
-- Keyed fingerprints (private.email_fingerprint, same pepper as welcome_grants) of emails whose new accounts start
-- suspended. No foreign key to users: the row must outlive the account.
create table public.blocked_emails (
  email_hash bytea primary key,
  reason text not null check (btrim(reason) <> ''),
  blocked_at timestamptz not null default now()
);
alter table public.blocked_emails enable row level security;
-- No policies: written and read only by the security definer functions below.
revoke all on public.blocked_emails from anon, authenticated, service_role;

-- ---------------------------------------------------------------- admin RPCs
-- Suspending an already suspended student replaces the reason (and the admin) and logs again.
create function public.admin_suspend_student(p_user uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
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

  update public.profiles
     set suspended_at = now(), suspended_reason = v_reason, suspended_by = auth.uid()
   where id = p_user;
  if not found then
    raise exception 'student_not_found' using errcode = 'P0001';
  end if;
  perform public.log_student_event(p_user, 'suspended', null, null, auth.uid(),
    jsonb_build_object('reason', v_reason));
end;
$$;
revoke execute on function public.admin_suspend_student(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_suspend_student(uuid, text) to authenticated;

-- Clears the suspension and the re-registration block, and forgets the email's fingerprint.
create function public.admin_reactivate_student(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.profiles
     set suspended_at = null, suspended_reason = null, suspended_by = null, reregistration_blocked = false
   where id = p_user;
  if not found then
    raise exception 'student_not_found' using errcode = 'P0001';
  end if;

  select u.email into v_email from auth.users u where u.id = p_user;
  if btrim(coalesce(v_email, '')) <> '' then
    delete from public.blocked_emails b where b.email_hash = private.email_fingerprint(v_email);
  end if;
  perform public.log_student_event(p_user, 'reactivated', null, null, auth.uid(), '{}'::jsonb);
end;
$$;
revoke execute on function public.admin_reactivate_student(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_reactivate_student(uuid) to authenticated;

-- ---------------------------------------------------------------- block_student_email (service role)
-- Called by the server right before it deletes an account. A user without an email (or unknown) is a no-op.
create function public.block_student_email(p_user uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_email text;
begin
  if v_reason = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  select u.email into v_email from auth.users u where u.id = p_user;
  if btrim(coalesce(v_email, '')) = '' then
    return;
  end if;
  insert into public.blocked_emails (email_hash, reason) values (private.email_fingerprint(v_email), v_reason)
    on conflict (email_hash) do update set reason = excluded.reason, blocked_at = now();
end;
$$;
revoke execute on function public.block_student_email(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.block_student_email(uuid, text) to service_role;

-- ---------------------------------------------------------------- sign-up trigger
-- Same body as in 20261106133031_welcome_credits.sql, plus: a blocked email gets an account that starts suspended.
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
