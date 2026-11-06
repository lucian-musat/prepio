-- Welcome credits, given once per account and once per email: deleting an account and signing up again with the
-- same email gives nothing. Emails are remembered only as a keyed hash (HMAC-SHA256 with a secret pepper), so the
-- list survives account deletion without keeping the address itself.

-- ---------------------------------------------------------------- private schema and the pepper
-- Not in the API's exposed schemas, and no client role gets usage on it.
create schema private;
revoke all on schema private from public, anon, authenticated, service_role;

create table private.secrets (
  name text primary key,
  value bytea not null
);
alter table private.secrets enable row level security;
revoke all on private.secrets from public, anon, authenticated, service_role;

-- Generated here so no manual production step is needed; it never leaves the database.
insert into private.secrets (name, value) values ('welcome_pepper', extensions.gen_random_bytes(32));

-- Normalised (trimmed, lower-case) email → HMAC-SHA256 with the pepper.
create function private.email_fingerprint(p_email text)
returns bytea
language sql
stable
set search_path = ''
as $$
  select extensions.hmac(convert_to(lower(btrim(p_email)), 'UTF8'), s.value, 'sha256')
    from private.secrets s
   where s.name = 'welcome_pepper';
$$;
revoke execute on function private.email_fingerprint(text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- welcome_grants
-- One row per email that has ever received (or been offered) the welcome grant. No foreign key to users: the row
-- must outlive the account.
create table public.welcome_grants (
  email_hash bytea primary key,
  granted_at timestamptz not null default now()
);
alter table public.welcome_grants enable row level security;
-- No policies: written and read only by grant_welcome_credits.
revoke all on public.welcome_grants from anon, authenticated, service_role;

-- ---------------------------------------------------------------- grant_welcome_credits (internal)
-- Returns true when credits were granted. A user who already has a welcome row gets nothing (and their new email is
-- not recorded). A null or blank email always grants; otherwise only the first account with that email does. With
-- welcome_credits = 0 the email is still recorded but nothing is granted.
create function public.grant_welcome_credits(p_user uuid, p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_amount int;
begin
  -- The profile lock serialises concurrent grants for the same user.
  perform 1 from public.profiles p where p.id = p_user for update;
  if not found then
    raise exception 'profile_not_found' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.credit_ledger l where l.user_id = p_user and l.kind = 'welcome') then
    return false;
  end if;

  if btrim(coalesce(p_email, '')) <> '' then
    insert into public.welcome_grants (email_hash) values (private.email_fingerprint(p_email))
      on conflict do nothing;
    if not found then
      return false;
    end if;
  end if;

  select s.welcome_credits into v_amount from public.credit_settings s where s.id = 1;
  if coalesce(v_amount, 0) <= 0 then
    return false;
  end if;

  perform 1 from public.credit_apply(p_user, v_amount, 'welcome', null, null, null, null, null, null);
  return true;
end;
$$;
revoke execute on function public.grant_welcome_credits(uuid, text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------- sign-up trigger
-- Same body as in 20261102094219_student_accounts.sql, plus the welcome grant once the profile exists.
create or replace function public.handle_new_user()
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
  perform public.grant_welcome_credits(new.id, new.email);
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------- backfill
-- Every existing account gets the welcome grant once (oldest account first when two share an email).
select public.grant_welcome_credits(u.id, u.email)
  from auth.users u
  join public.profiles p on p.id = u.id
 where not exists (select 1 from public.credit_ledger l where l.user_id = u.id and l.kind = 'welcome')
 order by u.created_at, u.id;

-- ---------------------------------------------------------------- defense in depth
-- The ledger and the orders are written only by the security definer functions (which run as their owner); the
-- service role calls those functions and never writes the tables directly.
revoke insert, update, delete, truncate on public.credit_ledger, public.credit_orders from service_role;
