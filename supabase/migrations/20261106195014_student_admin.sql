-- Student administration: per-student progress for admins, progress reset, the timeline reader and the extended
-- student list (provider, suspension, last activity, lessons finished, filters). Plus three suspension fixes:
-- a suspended student can't edit their profile, can't log a failed test, and reactivating an active student is a
-- no-op.

-- ---------------------------------------------------------------- admin_student_progress
-- One row per published lesson the student has progress or a consolidation run on. No answers or results.
create function public.admin_student_progress(p_user uuid)
returns table (lesson_id uuid, finished_at timestamptz, "position" jsonb, progress_updated_at timestamptz,
               cards_total int, questions_total int, run_index int, run_total int, run_finished_at timestamptz,
               run_updated_at timestamptz)
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
  if exists (select 1 from public.admins a where a.user_id = p_user) then
    raise exception 'cannot_target_admin' using errcode = 'P0001';
  end if;

  return query
    select l.id, lp.finished_at, lp.position, lp.updated_at,
           (select count(*)::int from public.cards c where c.lesson_id = l.id),
           (select count(*)::int from public.questions q where q.lesson_id = l.id),
           r.index, cardinality(r.exercise_ids),
           r.finished_at, r.updated_at
      from public.lessons l
      left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = p_user
      left join public.consolidation_runs r on r.lesson_id = l.id and r.user_id = p_user
     where l.status = 'published'
       and (lp.lesson_id is not null or r.lesson_id is not null)
     order by l.id;
end;
$$;
revoke execute on function public.admin_student_progress(uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_student_progress(uuid) to authenticated;

-- ---------------------------------------------------------------- admin_reset_progress
-- Deletes the progress, the run and the saved consolidation answers of one lesson (p_lesson) or of all lessons.
-- Never credits, the ledger, the profile or the learning mode.
create function public.admin_reset_progress(p_user uuid, p_lesson uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from public.admins a where a.user_id = p_user) then
    raise exception 'cannot_target_admin' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user) then
    raise exception 'student_not_found' using errcode = 'P0001';
  end if;
  if p_lesson is not null and not exists (select 1 from public.lessons l where l.id = p_lesson) then
    raise exception 'lesson_not_found' using errcode = 'P0001';
  end if;

  delete from public.consolidation_attempts a
   where a.user_id = p_user
     and (p_lesson is null
          or a.exercise_id in (select e.id from public.consolidation_exercises e where e.lesson_id = p_lesson));
  delete from public.consolidation_runs r
   where r.user_id = p_user and (p_lesson is null or r.lesson_id = p_lesson);
  delete from public.lesson_progress lp
   where lp.user_id = p_user and (p_lesson is null or lp.lesson_id = p_lesson);

  perform public.log_student_event(p_user, 'progress_reset', p_lesson, null, auth.uid(),
    jsonb_build_object('scope', case when p_lesson is null then 'all' else 'lesson' end));
end;
$$;
revoke execute on function public.admin_reset_progress(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.admin_reset_progress(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------- admin_students (extended)
-- p_filter: 'all' | 'suspended' | 'active_today' (an event on the current Europe/Bucharest day).
-- total counts the rows after the search and the filter.
drop function public.admin_students(text, int, int, uuid);

create function public.admin_students(
  p_search text, p_limit int, p_offset int, p_id uuid default null, p_filter text default 'all')
returns table (id uuid, display_name text, email text, credit_balance int, created_at timestamptz, total bigint,
               provider text, suspended_at timestamptz, suspended_reason text, reregistration_blocked boolean,
               last_activity_at timestamptz, lessons_finished int)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_filter text := coalesce(p_filter, 'all');
  v_pattern text;
  v_today timestamptz := date_trunc('day', now() at time zone 'Europe/Bucharest') at time zone 'Europe/Bucharest';
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_filter not in ('all', 'suspended', 'active_today') then
    raise exception 'bad_filter' using errcode = 'P0001';
  end if;
  -- Treat the search as plain text: escape the like wildcards.
  v_pattern := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
    select p.id, p.display_name, u.email::text, p.credit_balance, p.created_at, count(*) over (),
           u.raw_app_meta_data ->> 'provider', p.suspended_at, p.suspended_reason, p.reregistration_blocked,
           coalesce((select max(e.created_at) from public.student_events e where e.user_id = p.id),
                    u.last_sign_in_at),
           (select count(*)::int from public.lesson_progress lp
              join public.lessons l on l.id = lp.lesson_id and l.status = 'published'
             where lp.user_id = p.id and lp.finished_at is not null)
      from public.profiles p
      join auth.users u on u.id = p.id
     where not exists (select 1 from public.admins a where a.user_id = p.id)
       and (p_id is null or p.id = p_id)
       and (v_search is null or p.display_name ilike v_pattern or u.email ilike v_pattern)
       and (v_filter <> 'suspended' or p.suspended_at is not null)
       and (v_filter <> 'active_today'
            or exists (select 1 from public.student_events e where e.user_id = p.id and e.created_at >= v_today))
     order by p.created_at desc, p.id
     limit least(greatest(coalesce(p_limit, 50), 1), 200)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
revoke execute on function public.admin_students(text, int, int, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_students(text, int, int, uuid, text) to authenticated;

-- ---------------------------------------------------------------- admin_student_events
-- One student's timeline, newest first, paged with p_before (the last id already shown).
create function public.admin_student_events(p_user uuid, p_limit int, p_before bigint default null)
returns table (id bigint, kind text, details jsonb, created_at timestamptz, lesson_id uuid, lesson_title text,
               exercise_type text, exercise_prompt text, admin_email text)
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
  if exists (select 1 from public.admins a where a.user_id = p_user) then
    raise exception 'cannot_target_admin' using errcode = 'P0001';
  end if;

  return query
    select ev.id, ev.kind, ev.details, ev.created_at, ev.lesson_id, l.title, x.type, x.prompt, a.email::text
      from public.student_events ev
      left join public.lessons l on l.id = ev.lesson_id
      left join public.consolidation_exercises x on x.id = ev.exercise_id
      left join auth.users a on a.id = ev.admin_id
     where ev.user_id = p_user
       and (p_before is null or ev.id < p_before)
     order by ev.id desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;
revoke execute on function public.admin_student_events(uuid, int, bigint) from public, anon, authenticated, service_role;
grant execute on function public.admin_student_events(uuid, int, bigint) to authenticated;

-- ---------------------------------------------------------------- suspended students can't edit their profile
-- Their only column grants are display_name and learning_mode. Updates by admins, the service role and definer
-- functions that only touch other columns (suspension, credits) pass.
create function public.profiles_block_suspended_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_suspended() and not public.is_admin() then
    raise exception 'suspended' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.profiles_block_suspended_edit() from public, anon, authenticated, service_role;

create trigger profiles_block_suspended_edit
  before update on public.profiles
  for each row
  when (old.display_name is distinct from new.display_name or old.learning_mode is distinct from new.learning_mode)
  execute function public.profiles_block_suspended_edit();

-- ---------------------------------------------------------------- log_test_failed
-- Same as in 20261106193652_student_events.sql, plus: a suspended student is refused.
create or replace function public.log_test_failed(p_lesson uuid)
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
  if public.is_suspended() then
    raise exception 'suspended' using errcode = '42501';
  end if;
  if not exists (select 1 from public.lessons l where l.id = p_lesson and l.status = 'published')
     or not exists (select 1 from public.lesson_progress lp where lp.user_id = v_uid and lp.lesson_id = p_lesson) then
    raise exception 'bad_lesson' using errcode = 'P0001';
  end if;
  perform public.log_student_event(v_uid, 'test_failed', p_lesson, null, null, '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------- admin_reactivate_student
-- Same as in 20261106194440_student_suspension.sql, plus: a student who is neither suspended nor blocked is left
-- alone and nothing is logged.
create or replace function public.admin_reactivate_student(p_user uuid)
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
  if not exists (select 1 from public.profiles p where p.id = p_user) then
    raise exception 'student_not_found' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles p
                  where p.id = p_user and (p.suspended_at is not null or p.reregistration_blocked)) then
    return;
  end if;

  update public.profiles
     set suspended_at = null, suspended_reason = null, suspended_by = null, reregistration_blocked = false
   where id = p_user;

  select u.email into v_email from auth.users u where u.id = p_user;
  if btrim(coalesce(v_email, '')) <> '' then
    delete from public.blocked_emails b where b.email_hash = private.email_fingerprint(v_email);
  end if;
  perform public.log_student_event(p_user, 'reactivated', null, null, auth.uid(), '{}'::jsonb);
end;
$$;
