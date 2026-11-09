-- BAC subjects: whole exam papers (sources and items in three sections) that a student with full access answers as
-- one attempt and submits for strict grading paid in credits. This file holds the content tables, the attempt table
-- (written only by the service role and save_bac_draft), RLS, the draft RPC, the service-role access helper and the
-- cron sweep that fails and refunds attempts stuck in grading.

-- ---------------------------------------------------------------- content tables
create table public.bac_subjects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> ''),
  year smallint not null check (year between 2000 and 2100),
  variant text not null default '',
  credit_cost smallint not null default 10 check (credit_cost between 1 and 50),
  published boolean not null default false,
  position int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz not null default now()
);
create trigger bac_subjects_set_updated_at
  before update on public.bac_subjects
  for each row execute function public.set_updated_at();

create table public.bac_sources (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.bac_subjects (id) on delete cascade,
  section smallint not null check (section between 1 and 3),
  title text,
  author text not null default '',
  work text not null default '',
  body text not null,
  position int not null default 0
);
create index bac_sources_subject_id_idx on public.bac_sources (subject_id);

-- The item number the student sees is its 1-based index within its section, ordered by position.
create table public.bac_items (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.bac_subjects (id) on delete cascade,
  section smallint not null check (section between 1 and 3),
  position int not null default 0,
  type text not null check (type in (
    'short_answer', 'multi_answer', 'source_info', 'source_letter', 'cause_effect',
    'facts', 'comparison', 'viewpoint', 'argument', 'essay')),
  prompt text not null,
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  points smallint not null check (points between 1 and 30),
  template_id uuid references public.solution_templates (id) on delete restrict
);
create index bac_items_subject_id_idx on public.bac_items (subject_id);
create index bac_items_template_id_idx on public.bac_items (template_id) where template_id is not null;

create table public.bac_item_sources (
  item_id uuid not null references public.bac_items (id) on delete cascade,
  label text not null check (label in ('A', 'B', 'C', 'D')),
  source_id uuid not null references public.bac_sources (id) on delete restrict,
  position int not null default 0,
  primary key (item_id, label)
);
create index bac_item_sources_source_id_idx on public.bac_item_sources (source_id);

-- Admin-only: the barem (reference answer and scoring) must not be readable by students. Shape: BacBarem (TS).
create table public.bac_item_barem (
  item_id uuid primary key references public.bac_items (id) on delete cascade,
  barem jsonb not null check (jsonb_typeof(barem) = 'object')
);

-- ---------------------------------------------------------------- attempts
-- A student has at most one open attempt (draft, grading or failed) per subject; graded attempts are history.
-- Students only read their rows; the draft RPC and the service role write them.
create table public.bac_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id uuid not null references public.bac_subjects (id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'grading', 'graded', 'failed')),
  answers jsonb not null default '{}',
  position jsonb,
  submitted_at timestamptz,
  graded_at timestamptz,
  points smallint,
  grade numeric(4, 2),
  results jsonb,
  ledger_entry bigint references public.credit_ledger (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index bac_attempts_open_uidx on public.bac_attempts (user_id, subject_id)
  where status in ('draft', 'grading', 'failed');
create index bac_attempts_subject_id_idx on public.bac_attempts (subject_id);
create index bac_attempts_ledger_entry_idx on public.bac_attempts (ledger_entry) where ledger_entry is not null;
create index bac_attempts_grading_idx on public.bac_attempts (submitted_at) where status = 'grading';
create trigger bac_attempts_set_updated_at
  before update on public.bac_attempts
  for each row execute function public.set_updated_at();

-- Seeded with the default text later; the admin edits it in the AI settings.
alter table public.ai_settings add column bac_rules text not null default '';

-- ---------------------------------------------------------------- timeline
alter table public.student_events drop constraint student_events_kind_check;
alter table public.student_events add constraint student_events_kind_check check (kind in (
  'registered', 'welcome_credits', 'name_changed', 'mode_changed', 'app_opened',
  'lesson_started', 'lesson_finished', 'test_failed', 'consolidation_started', 'consolidation_finished',
  'check', 'check_refunded', 'check_blocked',
  'purchase', 'credits_adjusted',
  'suspended', 'reactivated', 'progress_reset',
  'access_purchased', 'access_granted', 'access_revoked', 'access_expired',
  'bac_started', 'bac_submitted', 'bac_graded', 'bac_grading_failed'));

-- The server logs the events only it can see: check_blocked, and the BAC submit/grade/fail events.
create or replace function public.log_student_event_service(p_user uuid, p_kind text, p_exercise uuid, p_details jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_kind is null or p_kind not in (
    'check_blocked', 'bac_started', 'bac_submitted', 'bac_graded', 'bac_grading_failed') then
    raise exception 'bad_kind' using errcode = 'P0001';
  end if;
  perform public.log_student_event(p_user, p_kind, null, p_exercise, null, p_details);
end;
$$;

-- ---------------------------------------------------------------- RLS
alter table public.bac_subjects enable row level security;
alter table public.bac_sources enable row level security;
alter table public.bac_items enable row level security;
alter table public.bac_item_sources enable row level security;
alter table public.bac_item_barem enable row level security;
alter table public.bac_attempts enable row level security;

create policy bac_subjects_admin_all on public.bac_subjects for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy bac_sources_admin_all on public.bac_sources for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy bac_items_admin_all on public.bac_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy bac_item_sources_admin_all on public.bac_item_sources for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy bac_item_barem_admin_all on public.bac_item_barem for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy bac_attempts_admin_all on public.bac_attempts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Students: published subjects only. No student policy on bac_item_barem.
create policy bac_subjects_student_select on public.bac_subjects for select to authenticated
  using (published);
create policy bac_sources_student_select on public.bac_sources for select to authenticated
  using (exists (select 1 from public.bac_subjects s where s.id = bac_sources.subject_id and s.published));
create policy bac_items_student_select on public.bac_items for select to authenticated
  using (exists (select 1 from public.bac_subjects s where s.id = bac_items.subject_id and s.published));
create policy bac_item_sources_student_select on public.bac_item_sources for select to authenticated
  using (exists (
    select 1 from public.bac_items i
      join public.bac_subjects s on s.id = i.subject_id
     where i.id = bac_item_sources.item_id and s.published));
create policy bac_attempts_own_select on public.bac_attempts for select to authenticated
  using (user_id = auth.uid());

-- Trial accounts see the subject list but not the papers: restrictive, so ANDed with the policies above.
create policy bac_sources_access on public.bac_sources as restrictive for select to authenticated
  using ((select public.access_open_all()));
create policy bac_items_access on public.bac_items as restrictive for select to authenticated
  using ((select public.access_open_all()));
create policy bac_item_sources_access on public.bac_item_sources as restrictive for select to authenticated
  using ((select public.access_open_all()));
create policy bac_attempts_access on public.bac_attempts as restrictive for select to authenticated
  using ((select public.access_open_all()));

-- Suspended students: same pattern as the other student-facing tables (admins are exempt).
do $$
declare
  t text;
begin
  foreach t in array array['bac_subjects', 'bac_sources', 'bac_items', 'bac_item_sources', 'bac_attempts']
  loop
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated '
      'using ((select public.is_admin()) or not (select public.is_suspended())) '
      'with check ((select public.is_admin()) or not (select public.is_suspended()))',
      t || '_not_suspended', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------- grants
revoke all on public.bac_subjects, public.bac_sources, public.bac_items, public.bac_item_sources,
  public.bac_item_barem, public.bac_attempts from anon, authenticated;
-- Content tables: RLS decides who may write (admins only).
grant select, insert, update, delete on public.bac_subjects, public.bac_sources, public.bac_items,
  public.bac_item_sources, public.bac_item_barem to authenticated;
-- Attempts: read only. Writes go through save_bac_draft and the service role.
grant select on public.bac_attempts to authenticated;

-- ---------------------------------------------------------------- functions
-- Autosave of the student's answers. Creates the open attempt on first use and reopens a failed one as a draft.
create function public.save_bac_draft(p_subject uuid, p_answers jsonb, p_position jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_attempt public.bac_attempts;
  v_id uuid;
  v_first boolean;
begin
  if v_user is null or not (public.access_open_all() and not public.is_suspended()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.bac_subjects s where s.id = p_subject and s.published) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Serialise this student's drafts of the subject.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || p_subject::text, 0));

  select * into v_attempt
    from public.bac_attempts a
   where a.user_id = v_user and a.subject_id = p_subject and a.status in ('draft', 'grading', 'failed')
   for update;
  if found then
    if v_attempt.status = 'grading' then
      raise exception 'grading' using errcode = 'P0001';
    end if;
    update public.bac_attempts
       set answers = coalesce(p_answers, '{}'::jsonb), position = p_position, status = 'draft'
     where id = v_attempt.id;
    return v_attempt.id;
  end if;

  v_first := not exists (
    select 1 from public.bac_attempts a where a.user_id = v_user and a.subject_id = p_subject);
  insert into public.bac_attempts (user_id, subject_id, answers, position)
  values (v_user, p_subject, coalesce(p_answers, '{}'::jsonb), p_position)
  returning id into v_id;
  if v_first then
    perform public.log_student_event(v_user, 'bac_started', null, null, null,
      jsonb_build_object('subject_id', p_subject));
  end if;
  return v_id;
end;
$$;
revoke execute on function public.save_bac_draft(uuid, jsonb, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.save_bac_draft(uuid, jsonb, jsonb) to authenticated;

-- For the API routes (service role bypasses RLS): may this user take a BAC subject? Admins and accounts with
-- full access, never a suspended account. Does not check the subject.
create function public.can_open_bac_for(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (exists (select 1 from public.admins a where a.user_id = p_user)
          or exists (select 1 from public.profiles p where p.id = p_user and p.access_until > now()))
     and not exists (select 1 from public.profiles p where p.id = p_user and p.suspended_at is not null);
$$;
revoke execute on function public.can_open_bac_for(uuid) from public, anon, authenticated, service_role;
grant execute on function public.can_open_bac_for(uuid) to service_role;

-- Attempts stuck in grading (the API crashed or timed out): give the credits back and let the student retry.
create function private.fail_stale_bac_grading()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select a.id, a.user_id, a.subject_id, a.ledger_entry
      from public.bac_attempts a
     where a.status = 'grading' and a.submitted_at < now() - interval '5 minutes'
     order by a.submitted_at
       for update skip locked
  loop
    if r.ledger_entry is not null then
      perform public.refund_credits(r.ledger_entry);
    end if;
    update public.bac_attempts set status = 'failed' where id = r.id;
    perform public.log_student_event(r.user_id, 'bac_grading_failed', null, null, null,
      jsonb_build_object('subject_id', r.subject_id));
  end loop;
end;
$$;
revoke execute on function private.fail_stale_bac_grading() from public, anon, authenticated, service_role;

select cron.schedule('fail-stale-bac-grading', '*/5 * * * *', $$select private.fail_stale_bac_grading()$$);
