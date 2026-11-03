-- Typed lesson cards: each card has a type and a type-specific JSON content.
-- Legacy body/image columns are copied into content, then dropped.

alter table cards
  add column type text not null default 'text'
    check (type in ('text', 'images', 'video', 'timeline', 'schema', 'link')),
  add column content jsonb not null default '{}'
    check (jsonb_typeof(content) = 'object');

update cards set
  type = 'images',
  content = jsonb_build_object(
    'images', jsonb_build_array(jsonb_build_object(
      'path', image_path,
      'alt', coalesce(title, 'Ilustrație'),
      'credit', image_credit)),
    'display', 'single',
    'text', nullif(btrim(body), ''))
where image_path is not null;

update cards set
  type = 'text',
  content = jsonb_build_object('text', body)
where image_path is null;

alter table cards
  drop column body,
  drop column image_path,
  drop column image_credit;
