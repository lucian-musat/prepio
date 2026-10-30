-- Restrict the public images bucket to web image formats and 5 MiB per file.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'],
    file_size_limit = 5242880
where id = 'images';
