-- Student timeline: one append-only row per thing a student did (or an admin did to them), read only by admins.
-- Rows are written by triggers on the student tables and by a few functions; never by clients directly.
-- details never holds answers, verdicts, scores or typed text.

-- ---------------------------------------------------------------- table
create table public.student_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in (
    'registered', 'welcome_credits', 'name_changed', 'mode_changed', 'app_opened',
    'lesson_started', 'lesson_finished', 'test_failed', 'consolidation_started', 'consolidation_finished',
    'check', 'check_refunded', 'check_blocked',
    'purchase', 'credits_adjusted',
    'suspended', 'reactivated', 'progress_reset')),
  lesson_id uuid references public.lessons (id) on delete set null,
  exercise_id uuid references public.consolidation_exercises (id) on delete set null,
  admin_id uuid references auth.users (id) on delete set null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index student_events_user_id_idx on public.student_events (user_id, id desc);
create index student_events_user_created_idx on public.student_events (user_id, created_at);
create index student_events_lesson_id_idx on public.student_events (lesson_id) where lesson_id is not null;
create index student_events_exercise_id_idx on public.student_events (exercise_id) where exercise_id is not null;
create index student_events_admin_id_idx on public.student_events (admin_id) where admin_id is not null;

-- ---------------------------------------------------------------- RLS and grants
alter table public.student_events enable row level security;

-- Admins only; students do not see their own timeline.
create policy student_events_admin_select on public.student_events for select to authenticated
  using (public.is_admin());

-- Read-only for clients (select is needed for the admin policy) and for the service role; every write goes through
-- the security definer functions below.
revoke all on public.student_events from anon, authenticated, service_role;
revoke all on sequence public.student_events_id_seq from anon, authenticated, service_role;
grant select on public.student_events to authenticated, service_role;

-- ---------------------------------------------------------------- log_student_event (internal)
-- The single writer. Called by the triggers below and by other security definer functions (which run as the owner).
create function public.log_student_event(
  p_user uuid, p_kind text, p_lesson uuid, p_exercise uuid, p_admin uuid, p_details jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.student_events (user_id, kind, lesson_id, exercise_id, admin_id, details)
  values (p_user, p_kind, p_lesson, p_exercise, p_admin, coalesce(p_details, '{}'::jsonb));
end;
$$;
revoke execute on function public.log_student_event(uuid, text, uuid, uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;

-- How a credit_ledger row appears on the timeline. Shared by the ledger trigger and the backfill.
create function public.student_event_of_ledger(p_entry public.credit_ledger)
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
         end,
         case p_entry.kind
           when 'check' then jsonb_build_object('cost', -p_entry.delta, 'target', p_entry.target)
           when 'admin' then jsonb_build_object('delta', p_entry.delta, 'reason', p_entry.reason)
           else jsonb_build_object('credits', p_entry.delta)
         end;
$$;
revoke execute on function public.student_event_of_ledger(public.credit_ledger)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- backfill
-- History that can be reconstructed from the existing tables, in chronological order so ids follow time.
-- Runs before the triggers exist, so nothing is logged twice.
insert into public.student_events (user_id, kind, lesson_id, exercise_id, admin_id, details, created_at)
select b.user_id, b.kind, b.lesson_id, b.exercise_id, b.admin_id, b.details, b.created_at
  from (
    select u.id as user_id, 'registered'::text as kind, null::uuid as lesson_id, null::uuid as exercise_id,
           null::uuid as admin_id,
           jsonb_strip_nulls(jsonb_build_object('provider', u.raw_app_meta_data ->> 'provider')) as details,
           coalesce(u.created_at, p.created_at) as created_at, 0 as seq
      from auth.users u
      join public.profiles p on p.id = u.id
    union all
    select lp.user_id, 'lesson_finished', lp.lesson_id, null, null, '{}'::jsonb, lp.finished_at, 1
      from public.lesson_progress lp
     where lp.finished_at is not null
    union all
    select r.user_id, 'consolidation_finished', r.lesson_id, null, null, '{}'::jsonb, r.finished_at, 1
      from public.consolidation_runs r
     where r.finished_at is not null
    union all
    select l.user_id, m.kind, null, l.exercise_id, l.admin_id, m.details, l.created_at, 1 + l.id
      from public.credit_ledger l
      cross join lateral public.student_event_of_ledger(l) m
  ) b
 where not exists (
   select 1 from public.student_events e
    where e.user_id = b.user_id and e.kind = b.kind and e.created_at = b.created_at)
 order by b.created_at, b.seq;

-- ---------------------------------------------------------------- profiles
create function public.student_events_on_profile_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.log_student_event(new.id, 'registered', null, null, null,
    jsonb_strip_nulls(jsonb_build_object('provider',
      (select u.raw_app_meta_data ->> 'provider' from auth.users u where u.id = new.id))));
  return null;
end;
$$;
revoke execute on function public.student_events_on_profile_insert() from public, anon, authenticated, service_role;

create trigger profiles_log_insert
  after insert on public.profiles
  for each row execute function public.student_events_on_profile_insert();

-- A first name (old value null) is part of onboarding, not a rename.
create function public.student_events_on_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.display_name is not null and new.display_name is distinct from old.display_name then
    perform public.log_student_event(new.id, 'name_changed', null, null, null, '{}'::jsonb);
  end if;
  if new.learning_mode is distinct from old.learning_mode then
    perform public.log_student_event(new.id, 'mode_changed', null, null, null,
      jsonb_strip_nulls(jsonb_build_object('mode', new.learning_mode)));
  end if;
  return null;
end;
$$;
revoke execute on function public.student_events_on_profile_update() from public, anon, authenticated, service_role;

-- The when clause skips the frequent balance-only updates.
create trigger profiles_log_update
  after update on public.profiles
  for each row
  when (old.display_name is distinct from new.display_name or old.learning_mode is distinct from new.learning_mode)
  execute function public.student_events_on_profile_update();

-- ---------------------------------------------------------------- lesson_progress
create function public.student_events_on_lesson_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_student_event(new.user_id, 'lesson_started', new.lesson_id, null, null, '{}'::jsonb);
  end if;
  if new.finished_at is not null and (tg_op = 'INSERT' or old.finished_at is null) then
    perform public.log_student_event(new.user_id, 'lesson_finished', new.lesson_id, null, null, '{}'::jsonb);
  end if;
  return null;
end;
$$;
revoke execute on function public.student_events_on_lesson_progress() from public, anon, authenticated, service_role;

create trigger lesson_progress_log
  after insert or update of finished_at on public.lesson_progress
  for each row execute function public.student_events_on_lesson_progress();

-- ---------------------------------------------------------------- consolidation_runs
create function public.student_events_on_consolidation_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_student_event(new.user_id, 'consolidation_started', new.lesson_id, null, null, '{}'::jsonb);
  end if;
  if new.finished_at is not null and (tg_op = 'INSERT' or old.finished_at is null) then
    perform public.log_student_event(new.user_id, 'consolidation_finished', new.lesson_id, null, null, '{}'::jsonb);
  end if;
  return null;
end;
$$;
revoke execute on function public.student_events_on_consolidation_run() from public, anon, authenticated, service_role;

create trigger consolidation_runs_log
  after insert or update of finished_at on public.consolidation_runs
  for each row execute function public.student_events_on_consolidation_run();

-- ---------------------------------------------------------------- credit_ledger
create function public.student_events_on_ledger_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_details jsonb;
begin
  select m.kind, m.details into v_kind, v_details from public.student_event_of_ledger(new) m;
  if v_kind is not null then
    perform public.log_student_event(new.user_id, v_kind, null, new.exercise_id, new.admin_id, v_details);
  end if;
  return null;
end;
$$;
revoke execute on function public.student_events_on_ledger_insert() from public, anon, authenticated, service_role;

create trigger credit_ledger_log
  after insert on public.credit_ledger
  for each row execute function public.student_events_on_ledger_insert();

-- ---------------------------------------------------------------- client RPCs (act on auth.uid() only)
-- At most one app_opened per student per Europe/Bucharest day. The advisory lock serialises concurrent opens.
create function public.log_app_open()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('app_opened:' || v_uid::text, 0));
  -- Same as (created_at at time zone 'Europe/Bucharest')::date = today, written so the (user_id, created_at)
  -- index applies.
  if exists (
    select 1 from public.student_events e
     where e.user_id = v_uid and e.kind = 'app_opened'
       and e.created_at >= (date_trunc('day', now() at time zone 'Europe/Bucharest') at time zone 'Europe/Bucharest')
  ) then
    return;
  end if;
  perform public.log_student_event(v_uid, 'app_opened', null, null, null, '{}'::jsonb);
end;
$$;
revoke execute on function public.log_app_open() from public, anon, authenticated, service_role;
grant execute on function public.log_app_open() to authenticated;

-- A failed lesson test, on a published lesson. Nothing about the answers is stored.
create function public.log_test_failed(p_lesson uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.lessons l where l.id = p_lesson and l.status = 'published') then
    raise exception 'bad_lesson' using errcode = 'P0001';
  end if;
  perform public.log_student_event(v_uid, 'test_failed', p_lesson, null, null, '{}'::jsonb);
end;
$$;
revoke execute on function public.log_test_failed(uuid) from public, anon, authenticated, service_role;
grant execute on function public.log_test_failed(uuid) to authenticated;
