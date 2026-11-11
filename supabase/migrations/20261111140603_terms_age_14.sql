-- New terms version (2026-11-11): the minimum age drops from 16 to 14, and a student under 18 confirms a parent's or
-- guardian's consent for using the app and for payments. Every student accepts the new text through the terms gate.
-- age_confirmed_at keeps its name; from this version on it records the 14+ confirmation and, for a minor, the
-- parental consent declared in the same checkbox.
create or replace function public.current_terms_version()
returns text
language sql
stable
set search_path = ''
as $$ select '2026-11-11'::text $$;
