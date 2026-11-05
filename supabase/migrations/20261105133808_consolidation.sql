-- Consolidation exercises: sources, solution templates, exercises (+ admin-only AI context), student attempts and
-- runs. The old writing_exercises become essay consolidation exercises and the table is dropped.

-- ---------------------------------------------------------------- content tables
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  title text,
  author text not null default '',
  work text not null default '',
  body text not null,
  position int not null default 0,
  created_at timestamptz default now()
);
create index sources_lesson_id_idx on public.sources (lesson_id);

create table public.solution_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  exercise_type text check (exercise_type in (
    'short_answer', 'multi_answer', 'source_info', 'source_letter', 'cause_effect',
    'facts', 'comparison', 'viewpoint', 'argument', 'essay')),
  points text not null default '',
  body text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz not null default now()
);
create trigger solution_templates_set_updated_at
  before update on public.solution_templates
  for each row execute function public.set_updated_at();

create table public.consolidation_exercises (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  position int not null default 0,
  type text not null check (type in (
    'short_answer', 'multi_answer', 'source_info', 'source_letter', 'cause_effect',
    'facts', 'comparison', 'viewpoint', 'argument', 'essay')),
  prompt text not null,
  content jsonb not null default '{}' check (jsonb_typeof(content) = 'object'),
  template_id uuid references public.solution_templates (id) on delete restrict,
  created_at timestamptz default now()
);
create index consolidation_exercises_lesson_id_idx on public.consolidation_exercises (lesson_id);

create table public.consolidation_exercise_sources (
  exercise_id uuid not null references public.consolidation_exercises (id) on delete cascade,
  source_id uuid not null references public.sources (id) on delete restrict,
  label text not null check (label in ('A', 'B', 'C', 'D')),
  position int not null default 0,
  primary key (exercise_id, label)
);
create index consolidation_exercise_sources_source_id_idx on public.consolidation_exercise_sources (source_id);

-- Admin-only: the reference facts must not be readable by students before they answer.
create table public.consolidation_ai_context (
  exercise_id uuid primary key references public.consolidation_exercises (id) on delete cascade,
  context jsonb not null check (jsonb_typeof(context) = 'object')
);

-- ---------------------------------------------------------------- student tables
create table public.consolidation_attempts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.consolidation_exercises (id) on delete cascade,
  answer jsonb not null,
  verdict text check (verdict in ('ok', 'almost', 'no')),
  feedback jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);
create index consolidation_attempts_exercise_id_idx on public.consolidation_attempts (exercise_id);
create trigger consolidation_attempts_set_updated_at
  before update on public.consolidation_attempts
  for each row execute function public.set_updated_at();

create table public.consolidation_runs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  exercise_ids uuid[] not null,
  index int not null default 0 check (index >= 0),
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index consolidation_runs_lesson_id_idx on public.consolidation_runs (lesson_id);
create trigger consolidation_runs_set_updated_at
  before update on public.consolidation_runs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- RLS
alter table public.sources enable row level security;
alter table public.solution_templates enable row level security;
alter table public.consolidation_exercises enable row level security;
alter table public.consolidation_exercise_sources enable row level security;
alter table public.consolidation_ai_context enable row level security;
alter table public.consolidation_attempts enable row level security;
alter table public.consolidation_runs enable row level security;

create policy sources_admin_all on public.sources for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy solution_templates_admin_all on public.solution_templates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy consolidation_exercises_admin_all on public.consolidation_exercises for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy consolidation_exercise_sources_admin_all on public.consolidation_exercise_sources for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy consolidation_ai_context_admin_all on public.consolidation_ai_context for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Students: published content only. No policy on consolidation_ai_context, so non-admins see no rows.
create policy sources_student_select on public.sources for select to authenticated
  using (exists (select 1 from public.lessons l where l.id = sources.lesson_id and l.status = 'published'));
create policy solution_templates_student_select on public.solution_templates for select to authenticated using (true);
create policy consolidation_exercises_student_select on public.consolidation_exercises for select to authenticated
  using (exists (select 1 from public.lessons l where l.id = consolidation_exercises.lesson_id and l.status = 'published'));
create policy consolidation_exercise_sources_student_select on public.consolidation_exercise_sources for select to authenticated
  using (exists (
    select 1 from public.consolidation_exercises e
      join public.lessons l on l.id = e.lesson_id
     where e.id = consolidation_exercise_sources.exercise_id and l.status = 'published'));

create policy consolidation_attempts_own_select on public.consolidation_attempts for select to authenticated
  using (user_id = auth.uid());
create policy consolidation_attempts_own_insert on public.consolidation_attempts for insert to authenticated
  with check (user_id = auth.uid());
create policy consolidation_attempts_own_update on public.consolidation_attempts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy consolidation_runs_own_select on public.consolidation_runs for select to authenticated
  using (user_id = auth.uid());
create policy consolidation_runs_own_insert on public.consolidation_runs for insert to authenticated
  with check (user_id = auth.uid());
create policy consolidation_runs_own_update on public.consolidation_runs for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------- grants
revoke all on public.sources, public.solution_templates, public.consolidation_exercises,
  public.consolidation_exercise_sources, public.consolidation_ai_context,
  public.consolidation_attempts, public.consolidation_runs from anon, authenticated;

-- Content tables: RLS decides who may write (admins only).
grant select, insert, update, delete on public.sources, public.solution_templates, public.consolidation_exercises,
  public.consolidation_exercise_sources, public.consolidation_ai_context to authenticated;

-- user_id comes from the default. exercise_id / lesson_id are updatable because PostgREST upserts
-- (ON CONFLICT DO UPDATE) set every payload column; the primary key makes a change a no-op in practice.
grant select, insert (exercise_id, answer, verdict, feedback), update (exercise_id, answer, verdict, feedback)
  on public.consolidation_attempts to authenticated;
grant select, insert (lesson_id, exercise_ids, index, finished_at), update (lesson_id, exercise_ids, index, finished_at)
  on public.consolidation_runs to authenticated;

-- ---------------------------------------------------------------- writing_exercises -> essay exercises
-- Kept after the migration so pgTAP can test the conversion; nobody can call it through the API.
create function public.essay_from_writing_exercise(p_lesson uuid, p_prompt text, p_criteria text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_id uuid;
begin
  if char_length(p_prompt) <= 80 then
    v_title := p_prompt;
  else
    v_title := left(p_prompt, 80);
    -- Cut at a word boundary unless the 80th character already ends a word.
    if substr(p_prompt, 81, 1) !~ '\s' and v_title ~ '\s' then
      v_title := regexp_replace(v_title, '\s+\S*$', '');
    end if;
    v_title := rtrim(v_title, E' ,;:') || '…';
  end if;

  insert into public.consolidation_exercises (lesson_id, position, type, prompt, content)
  values (
    p_lesson,
    coalesce((select max(position) from public.consolidation_exercises where lesson_id = p_lesson), -1) + 1,
    'essay',
    v_title,
    jsonb_build_object(
      'requirements', jsonb_build_array(jsonb_build_object(
        'id', 'r1', 'text', p_prompt, 'modelAnswer', null, 'templateId', null, 'argument', false)),
      'modelAnswer', null,
      'explanation', null)
  )
  returning id into v_id;

  insert into public.consolidation_ai_context (exercise_id, context)
  values (v_id, jsonb_build_object('main', '', 'requirements', jsonb_build_object('r1', p_criteria)));

  return v_id;
end;
$$;
revoke execute on function public.essay_from_writing_exercise(uuid, text, text)
  from public, anon, authenticated, service_role;

do $$
declare
  r record;
begin
  for r in select lesson_id, prompt, criteria from public.writing_exercises order by lesson_id, position loop
    perform public.essay_from_writing_exercise(r.lesson_id, r.prompt, r.criteria);
  end loop;
end;
$$;

drop table public.writing_exercises;

-- source_id is ON DELETE RESTRICT, which is checked immediately and would block a lesson delete (the cascade reaches
-- sources before the exercises' link rows). Removing the lesson's exercises first (their links cascade) avoids that.
create function public.consolidation_before_lesson_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.consolidation_exercises where lesson_id = old.id;
  return old;
end;
$$;
revoke execute on function public.consolidation_before_lesson_delete() from public, anon, authenticated, service_role;

create trigger lessons_consolidation_before_delete
  before delete on public.lessons
  for each row execute function public.consolidation_before_lesson_delete();
