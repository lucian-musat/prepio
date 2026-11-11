-- Terms of service acceptance and the 16+ confirmation. The columns have no update grant: the only way to set
-- them is accept_terms(), which accepts the current version only. A suspended student may still call it (the
-- suspended-edit trigger only watches display_name and learning_mode, and the gate doesn't apply to them).
alter table public.profiles
  add column age_confirmed_at timestamptz,
  add column terms_version text;

create function public.current_terms_version()
returns text
language sql
immutable
set search_path = ''
as $$ select '2026-11-10'::text $$;
revoke execute on function public.current_terms_version() from public, anon;
grant execute on function public.current_terms_version() to authenticated;

create function public.accept_terms(p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_version is distinct from public.current_terms_version() then
    raise exception 'terms_version_mismatch';
  end if;
  update public.profiles
     set age_confirmed_at = now(), terms_version = p_version
   where id = auth.uid();
end;
$$;
revoke execute on function public.accept_terms(text) from public, anon;
grant execute on function public.accept_terms(text) to authenticated;
