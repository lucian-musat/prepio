-- Admins who use the student app show up in the student list, flagged with is_admin, and their progress and
-- timeline can be read. Every account action (credits, access, suspension, reset, delete) still refuses admins.

-- ---------------------------------------------------------------- admin_students
-- An admin is listed once they have a lesson, a consolidation run or a BAC subject started. Admins always have
-- full access, so the trial filter leaves them out and the full access filter lists them.
drop function public.admin_students(text, int, int, uuid, text);
create function public.admin_students(
  p_search text, p_limit int, p_offset int, p_id uuid default null, p_filter text default 'all')
returns table (id uuid, display_name text, email text, credit_balance int, created_at timestamptz, total bigint,
               provider text, suspended_at timestamptz, suspended_reason text, reregistration_blocked boolean,
               last_activity_at timestamptz, lessons_finished int, access_until timestamptz, is_admin boolean)
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
  if v_filter not in ('all', 'suspended', 'active_today', 'trial', 'full') then
    raise exception 'bad_filter' using errcode = 'P0001';
  end if;
  -- Treat the search as plain text: escape the like wildcards.
  v_pattern := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
    with accounts as (
      select p.id, p.display_name, p.credit_balance, p.created_at, p.suspended_at, p.suspended_reason,
             p.reregistration_blocked, p.access_until,
             exists (select 1 from public.admins a where a.user_id = p.id) as admin
        from public.profiles p
    )
    select p.id, p.display_name, u.email::text, p.credit_balance, p.created_at, count(*) over (),
           u.raw_app_meta_data ->> 'provider', p.suspended_at, p.suspended_reason, p.reregistration_blocked,
           -- access_expired has no admin either, but it is not something the student did.
           coalesce((select max(e.created_at) from public.student_events e
                      where e.user_id = p.id and e.admin_id is null and e.kind <> 'access_expired'),
                    u.last_sign_in_at),
           (select count(*)::int from public.lesson_progress lp
              join public.lessons l on l.id = lp.lesson_id and l.status = 'published'
             where lp.user_id = p.id and lp.finished_at is not null),
           p.access_until,
           p.admin
      from accounts p
      join auth.users u on u.id = p.id
     where (not p.admin
            or exists (select 1 from public.lesson_progress lp where lp.user_id = p.id)
            or exists (select 1 from public.consolidation_runs r where r.user_id = p.id)
            or exists (select 1 from public.bac_attempts b where b.user_id = p.id))
       and (p_id is null or p.id = p_id)
       and (v_search is null or p.display_name ilike v_pattern or u.email ilike v_pattern)
       and (v_filter <> 'suspended' or p.suspended_at is not null)
       and (v_filter <> 'active_today'
            or exists (select 1 from public.student_events e
                        where e.user_id = p.id and e.admin_id is null and e.kind <> 'access_expired'
                          and e.created_at >= v_today))
       and (v_filter <> 'trial' or (not p.admin and (p.access_until is null or p.access_until <= now())))
       and (v_filter <> 'full' or p.admin or p.access_until > now())
     order by p.created_at desc, p.id
     limit least(greatest(coalesce(p_limit, 50), 1), 200)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
revoke execute on function public.admin_students(text, int, int, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_students(text, int, int, uuid, text) to authenticated;

-- ---------------------------------------------------------------- admin_student_progress
-- Same as before, without refusing admins (reading is not an account action).
create or replace function public.admin_student_progress(p_user uuid)
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

-- ---------------------------------------------------------------- admin_student_events
-- Same as before, without refusing admins.
create or replace function public.admin_student_events(p_user uuid, p_limit int, p_before bigint default null)
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
