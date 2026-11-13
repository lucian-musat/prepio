-- Editable UI texts: admin overrides of the code-default texts (the defaults live in packages/shared/src/texts).
create table public.ui_texts (
  key text primary key check (key ~ '^[a-z][a-zA-Z0-9]*(\.[a-z0-9][a-zA-Z0-9]*)+$'),
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.ui_texts enable row level security;

create policy ui_texts_public_select on public.ui_texts for select to anon, authenticated using (true);
create policy ui_texts_admin_insert on public.ui_texts for insert to authenticated with check (public.is_admin());
create policy ui_texts_admin_update on public.ui_texts for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy ui_texts_admin_delete on public.ui_texts for delete to authenticated using (public.is_admin());

grant select on public.ui_texts to anon, authenticated;
grant insert, update, delete on public.ui_texts to authenticated;

create trigger ui_texts_set_updated_at
  before update on public.ui_texts
  for each row execute function public.set_updated_at();

-- Keep a welcome message edited in the old settings row (an empty one stays hidden).
insert into public.ui_texts (key, value)
select 'home.hero.welcome', welcome_message from public.settings
 where id = 1 and welcome_message is distinct from 'Bine ai venit în Prepio! Aici te pregătești pentru proba de istorie de la Bacalaureat. Alege o lecție din programă, citește cardurile cu ce trebuie să știi și răspunde la câteva întrebări. Apoi exersează cu exerciții ca la BAC. Când scrii un răspuns, profesorul digital îți spune pe loc ce poți îmbunătăți. Spor la învățat!';
