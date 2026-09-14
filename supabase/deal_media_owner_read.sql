-- Owner SELECT is required for Storage listing and effective owner deletion.
-- Existing restrictive active-session and MFA policies continue to apply.
begin;
create policy "owners read deal media" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'deal-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
commit;
