-- Learning mode (guided / free) on the profile, plus per-student lesson progress.

alter table public.profiles
  add column learning_mode text check (learning_mode in ('guided', 'free'));
grant update (learning_mode) on public.profiles to authenticated;

create table public.lesson_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  finished_at timestamptz,
  position jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
alter table public.lesson_progress enable row level security;

create policy lesson_progress_own_select on public.lesson_progress for select to authenticated
  using (user_id = auth.uid());
create policy lesson_progress_own_insert on public.lesson_progress for insert to authenticated
  with check (user_id = auth.uid());
create policy lesson_progress_own_update on public.lesson_progress for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- user_id comes from the default. lesson_id is updatable because PostgREST upserts
-- (ON CONFLICT DO UPDATE) set every payload column; the primary key makes a change a no-op in practice.
revoke all on public.lesson_progress from anon, authenticated;
grant select, insert (lesson_id, finished_at, position), update (lesson_id, finished_at, position)
  on public.lesson_progress to authenticated;

create trigger lesson_progress_set_updated_at
  before update on public.lesson_progress
  for each row execute function public.set_updated_at();
