-- Reusable AI instruction templates (admin-only) and their links to consolidation exercises.

create table public.ai_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null check (type in ('facts', 'comparison', 'viewpoint', 'argument', 'essay_requirement')),
  criteria text not null,
  keywords text not null default '',
  response_format text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz not null default now()
);

create trigger ai_templates_set_updated_at
  before update on public.ai_templates
  for each row execute function public.set_updated_at();

-- requirement_id '' = the exercise's main instruction; otherwise the requirement's id.
create table public.consolidation_ai_template_links (
  exercise_id uuid not null references public.consolidation_exercises(id) on delete cascade,
  requirement_id text not null default '',
  template_id uuid not null references public.ai_templates(id) on delete restrict,
  primary key (exercise_id, requirement_id)
);
create index consolidation_ai_template_links_template_idx on public.consolidation_ai_template_links (template_id);

alter table public.ai_templates enable row level security;
alter table public.consolidation_ai_template_links enable row level security;

-- Admin-only: no student policies, so non-admins see no rows.
create policy ai_templates_admin_all on public.ai_templates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy consolidation_ai_template_links_admin_all on public.consolidation_ai_template_links for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.ai_templates, public.consolidation_ai_template_links from anon, authenticated;
grant select, insert, update, delete on public.ai_templates, public.consolidation_ai_template_links to authenticated;
