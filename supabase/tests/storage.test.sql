begin;
select plan(5);

select is(
  (select public from storage.buckets where id = 'images'),
  true, 'images bucket is public');
select is(
  (select file_size_limit from storage.buckets where id = 'images'),
  5242880::bigint, 'images bucket caps uploads at 5 MiB');
select is(
  (select array(select unnest(allowed_mime_types) order by 1) from storage.buckets where id = 'images'),
  array['image/jpeg', 'image/png', 'image/webp'], 'images bucket only accepts JPEG, PNG and WebP');

-- Card images stay publicly readable even though anon no longer reads content tables.
-- Student/admin write rules are covered in accounts.test.sql.
insert into storage.objects (bucket_id, name) values ('images', 'test/storage-fixture.png');
set local role anon;
select is(
  (select count(*)::int from storage.objects where bucket_id = 'images' and name = 'test/storage-fixture.png'),
  1, 'anon still reads objects in images');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('images', 'test/anon.png') $$,
  '42501', null, 'anon cannot upload to images');

select * from finish();
rollback;
