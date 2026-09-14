-- The invoker pre-request hook must resolve the already-granted MFA helper.
-- USAGE grants name resolution only, not CREATE, table access, or new EXECUTE.
begin;
do $boundary$
begin
  if has_schema_privilege('anon', 'dealsafe_private', 'usage')
     or has_schema_privilege('authenticated', 'dealsafe_private', 'create')
     or exists (
       select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='dealsafe_private' and c.relkind in ('r','p','v','m','f')
         and has_table_privilege('authenticated', c.oid, 'select,insert,update,delete,truncate,references,trigger')
     )
     or exists (
       select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='dealsafe_private'
         and has_function_privilege('authenticated', p.oid, 'execute')
         and p.oid not in (
           'dealsafe_private.is_current_mfa_assurance_sufficient()'::regprocedure,
           'dealsafe_private.can_upload_evidence_quarantine(text)'::regprocedure
         )
     ) then
    raise exception 'Private helper access boundary differs from reviewed grants';
  end if;
end $boundary$;
grant usage on schema dealsafe_private to authenticated;
commit;

