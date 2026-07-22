-- Adds short item-video support to the existing public deal-media bucket. Safe to rerun.
update storage.buckets set file_size_limit=26214400,
allowed_mime_types=array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/webm']
where id='deal-media';
