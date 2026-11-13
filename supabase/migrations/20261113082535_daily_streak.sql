-- Daily streak: one row per student per Europe/Bucharest day on which they did something.
-- Written only by mark_active_today (and later by server-side triggers); clients can read their own rows.

create table public.student_active_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.student_active_days enable row level security;

create policy student_active_days_select_own on public.student_active_days for select to authenticated
  using (user_id = auth.uid());

revoke all on public.student_active_days from anon, authenticated, service_role;
grant select on public.student_active_days to authenticated, service_role;

-- ---------------------------------------------------------------- summary
-- current: consecutive days ending today, or yesterday when today is not done yet (the streak is alive until midnight).
-- record: longest run ever. week: worked days of the Monday-Sunday week containing p_today.
create function private.streak_summary(p_user uuid, p_today date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with d as (
    select day from public.student_active_days where user_id = p_user
  ),
  runs as (
    select day, day - (row_number() over (order by day))::int as grp from d
  ),
  islands as (
    select grp, count(*)::int as len, max(day) as last_day from runs group by grp
  ),
  anchor as (
    select case
             when exists (select 1 from d where day = p_today) then p_today
             when exists (select 1 from d where day = p_today - 1) then p_today - 1
           end as day
  )
  select jsonb_build_object(
    'current', coalesce((select i.len from islands i, anchor a where i.last_day = a.day), 0),
    'record', coalesce((select max(len) from islands), 0),
    'today_done', exists (select 1 from d where day = p_today),
    'week', coalesce((
      select jsonb_agg(to_char(day, 'YYYY-MM-DD') order by day) from d
       where day >= date_trunc('week', p_today::timestamp)::date
         and day < date_trunc('week', p_today::timestamp)::date + 7), '[]'::jsonb));
$$;
revoke execute on function private.streak_summary(uuid, date) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- client RPCs (act on auth.uid() only)
create function public.my_streak()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  return private.streak_summary(v_uid, (now() at time zone 'Europe/Bucharest')::date);
end;
$$;
revoke execute on function public.my_streak() from public, anon, authenticated, service_role;
grant execute on function public.my_streak() to authenticated;

create function public.mark_active_today()
returns jsonb
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
  insert into public.student_active_days (user_id, day)
  values (v_uid, (now() at time zone 'Europe/Bucharest')::date)
  on conflict do nothing;
  return private.streak_summary(v_uid, (now() at time zone 'Europe/Bucharest')::date);
end;
$$;
revoke execute on function public.mark_active_today() from public, anon, authenticated, service_role;
grant execute on function public.mark_active_today() to authenticated;
