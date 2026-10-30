begin;
select plan(3);

select is(
  (select public from storage.buckets where id = 'images'),
  true, 'images bucket is public');
select is(
  (select file_size_limit from storage.buckets where id = 'images'),
  5242880::bigint, 'images bucket caps uploads at 5 MiB');
select is(
  (select array(select unnest(allowed_mime_types) order by 1) from storage.buckets where id = 'images'),
  array['image/jpeg', 'image/png', 'image/webp'], 'images bucket only accepts JPEG, PNG and WebP');

select * from finish();
rollback;
