-- Legacy bucket bootstrap. The governed upload/read workflow is defined by
-- evidence_file_security.sql. This file must never restore direct browser
-- access to final evidence objects.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'deal-evidence',
  'deal-evidence',
  false,
  52428800,
  array[
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "participants upload deal evidence files" on storage.objects;
drop policy if exists "participants read deal evidence files" on storage.objects;
drop policy if exists "participants and admins read deal evidence files" on storage.objects;

-- There are deliberately no authenticated INSERT/SELECT/UPDATE/DELETE policies
-- for the final bucket. The Edge Function uses the service role only after
-- authorization, byte-signature validation, and malware scanning.
