alter table nodes enable row level security;
alter table lessons enable row level security;
alter table cards enable row level security;
alter table questions enable row level security;
alter table writing_exercises enable row level security;
alter table settings enable row level security;
alter table ai_settings enable row level security;
alter table rate_limits enable row level security;

-- Students (anon): read-only access to published content.
create policy nodes_anon_select on nodes for select to anon using (true);
create policy settings_anon_select on settings for select to anon using (true);
create policy lessons_anon_select on lessons for select to anon using (status = 'published');
create policy cards_anon_select on cards for select to anon
  using (exists (select 1 from lessons l where l.id = cards.lesson_id and l.status = 'published'));
create policy questions_anon_select on questions for select to anon
  using (exists (select 1 from lessons l where l.id = questions.lesson_id and l.status = 'published'));
create policy writing_exercises_anon_select on writing_exercises for select to anon
  using (exists (select 1 from lessons l where l.id = writing_exercises.lesson_id and l.status = 'published'));

-- Admin (authenticated): full access to content and settings.
create policy nodes_auth_all on nodes for all to authenticated using (true) with check (true);
create policy lessons_auth_all on lessons for all to authenticated using (true) with check (true);
create policy cards_auth_all on cards for all to authenticated using (true) with check (true);
create policy questions_auth_all on questions for all to authenticated using (true) with check (true);
create policy writing_exercises_auth_all on writing_exercises for all to authenticated using (true) with check (true);
create policy settings_auth_all on settings for all to authenticated using (true) with check (true);
create policy ai_settings_auth_all on ai_settings for all to authenticated using (true) with check (true);

-- rate_limits: service role only (no policies, no grants for API roles).
revoke all on rate_limits from anon, authenticated;
