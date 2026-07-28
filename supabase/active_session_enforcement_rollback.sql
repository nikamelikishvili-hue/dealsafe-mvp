-- Emergency enforcement rollback.
--
-- This keeps the validation helpers installed because protected Edge Functions
-- call the service-only helper. It removes the Data API pre-request hook and
-- the restrictive Storage policy, restoring the previous authorization path.

alter role authenticator reset pgrst.db_pre_request;

drop policy if exists "authenticated sessions must be active"
  on storage.objects;

notify pgrst, 'reload config';

