-- Student accounts: admins are listed explicitly, every other signed-in user is a student.
-- Students read published content; only admins write. Anonymous visitors read nothing.

-- ---------------------------------------------------------------- admins
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;
-- No policies: readable only through is_admin() and the service role.
revoke all on public.admins from anon, authenticated;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke execute on function public.is_admin() from public, anon, service_role;
grant execute on function public.is_admin() to authenticated;

-- Sign-up was closed until now, so every existing user is an admin.
insert into public.admins (user_id) select id from auth.users on conflict do nothing;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(btrim(display_name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy profiles_own_select on public.profiles for select to authenticated
  using (id = auth.uid());
create policy profiles_own_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Rows are created by the auth trigger and removed by the cascade; clients may only change the name.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Name from Google metadata (full_name, else name; blanks skipped), trimmed and capped at 60 chars; null when absent.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Existing users (all admins) predate the trigger: give them a profile row too.
insert into public.profiles (id) select id from auth.users on conflict do nothing;

-- ---------------------------------------------------------------- content policies
drop policy nodes_anon_select on public.nodes;
drop policy settings_anon_select on public.settings;
drop policy lessons_anon_select on public.lessons;
drop policy cards_anon_select on public.cards;
drop policy questions_anon_select on public.questions;
drop policy writing_exercises_anon_select on public.writing_exercises;

drop policy nodes_auth_all on public.nodes;
drop policy lessons_auth_all on public.lessons;
drop policy cards_auth_all on public.cards;
drop policy questions_auth_all on public.questions;
drop policy writing_exercises_auth_all on public.writing_exercises;
drop policy settings_auth_all on public.settings;
drop policy ai_settings_auth_all on public.ai_settings;

-- Admins: full access to content and settings.
create policy nodes_admin_all on public.nodes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy lessons_admin_all on public.lessons for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy cards_admin_all on public.cards for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy questions_admin_all on public.questions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy writing_exercises_admin_all on public.writing_exercises for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy settings_admin_all on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy ai_settings_admin_all on public.ai_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Students (any signed-in user): read-only access to published content, same rules anon had before.
create policy nodes_student_select on public.nodes for select to authenticated using (true);
create policy settings_student_select on public.settings for select to authenticated using (true);
create policy lessons_student_select on public.lessons for select to authenticated using (status = 'published');
create policy cards_student_select on public.cards for select to authenticated
  using (exists (select 1 from public.lessons l where l.id = cards.lesson_id and l.status = 'published'));
create policy questions_student_select on public.questions for select to authenticated
  using (exists (select 1 from public.lessons l where l.id = questions.lesson_id and l.status = 'published'));
create policy writing_exercises_student_select on public.writing_exercises for select to authenticated
  using (exists (select 1 from public.lessons l where l.id = writing_exercises.lesson_id and l.status = 'published'));

-- ---------------------------------------------------------------- storage: only admins write images
drop policy images_auth_insert on storage.objects;
drop policy images_auth_update on storage.objects;
drop policy images_auth_delete on storage.objects;

create policy images_auth_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and public.is_admin());
create policy images_auth_update on storage.objects for update to authenticated
  using (bucket_id = 'images' and public.is_admin()) with check (bucket_id = 'images' and public.is_admin());
create policy images_auth_delete on storage.objects for delete to authenticated
  using (bucket_id = 'images' and public.is_admin());
