-- Public image bucket: anyone reads, only admins write.
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do update set public = true;

create policy images_public_select on storage.objects for select
  using (bucket_id = 'images');
create policy images_auth_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'images');
create policy images_auth_update on storage.objects for update to authenticated
  using (bucket_id = 'images') with check (bucket_id = 'images');
create policy images_auth_delete on storage.objects for delete to authenticated
  using (bucket_id = 'images');

-- Atomic fixed-window rate limiter. Returns true while the caller is within the limit.
create function consume_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into rate_limits as r (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set window_start = case
          when r.window_start <= now() - make_interval(secs => p_window_seconds) then now()
          else r.window_start
        end,
        count = case
          when r.window_start <= now() - make_interval(secs => p_window_seconds) then 1
          else r.count + 1
        end
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;

revoke execute on function consume_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function consume_rate_limit(text, int, int) to service_role;
