-- Private storage for dispute evidence. Run after evidence_dispute_setup.sql.
-- Evidence files are never exposed through a public URL.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'deal-evidence',
  'deal-evidence',
  false,
  52428800,
  array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/webm']
)
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "participants upload deal evidence files" on storage.objects;
create policy "participants upload deal evidence files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id='deal-evidence'
    and (storage.foldername(name))[1]=auth.uid()::text
    and exists (
      select 1 from public.deals d
      where d.id=(storage.foldername(name))[2]::uuid
        and (d.seller_id=auth.uid() or d.buyer_id=auth.uid())
    )
  );

drop policy if exists "participants read deal evidence files" on storage.objects;
create policy "participants read deal evidence files" on storage.objects
  for select to authenticated
  using (
    bucket_id='deal-evidence'
    and exists (
      select 1 from public.deals d
      where d.id=(storage.foldername(name))[2]::uuid
        and (d.seller_id=auth.uid() or d.buyer_id=auth.uid())
    )
  );

-- There are deliberately no update or delete policies for authenticated users.
-- Evidence is append-only; service-role/admin workflows can remove files if needed.
