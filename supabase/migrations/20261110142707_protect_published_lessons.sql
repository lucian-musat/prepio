-- Published lessons can only be deleted by the service role. The trigger also fires for rows
-- removed by an ON DELETE CASCADE from nodes, so deleting a node that holds a published lesson
-- is refused too. The admin maps the message `published_lesson_delete`.
create function public.lessons_block_published_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' and coalesce(nullif(auth.role(), ''), current_user) <> 'service_role' then
    raise exception 'published_lesson_delete';
  end if;
  return old;
end;
$$;

create trigger lessons_block_published_delete
  before delete on public.lessons
  for each row execute function public.lessons_block_published_delete();
