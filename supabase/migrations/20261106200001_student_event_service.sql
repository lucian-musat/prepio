-- The server (service role) logs the timeline events only it can see. For now that is check_blocked: a check refused
-- for lack of credits (402), which never reaches the ledger.
-- Also: in admin_students, last activity and the active_today filter count only the student's own events.

-- ---------------------------------------------------------------- log_student_event_service
create function public.log_student_event_service(p_user uuid, p_kind text, p_exercise uuid, p_details jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_kind is distinct from 'check_blocked' then
    raise exception 'bad_kind' using errcode = 'P0001';
  end if;
  perform public.log_student_event(p_user, p_kind, null, p_exercise, null, p_details);
end;
$$;
revoke execute on function public.log_student_event_service(uuid, text, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.log_student_event_service(uuid, text, uuid, jsonb) to service_role;

-- ---------------------------------------------------------------- admin_students
-- Same as in 20261106195014_student_admin.sql, plus: events written by an admin (admin_id set: credit adjustments,
-- suspensions, resets, ...) are not the student's activity.
create or replace function public.admin_students(
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
           coalesce((select max(e.created_at) from public.student_events e
                      where e.user_id = p.id and e.admin_id is null),
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
            or exists (select 1 from public.student_events e
                        where e.user_id = p.id and e.admin_id is null and e.created_at >= v_today))
     order by p.created_at desc, p.id
     limit least(greatest(coalesce(p_limit, 50), 1), 200)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
