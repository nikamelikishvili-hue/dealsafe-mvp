-- Rollback-only SEC-003 production proof.

begin;

do $sec_003_boundary$
declare
  helper_oid oid := 'dealsafe_private.is_current_mfa_assurance_sufficient()'::regprocedure::oid;
  helper_definition text := pg_get_functiondef(helper_oid);
  hook_definition text := pg_get_functiondef('public.enforce_active_auth_session()'::regprocedure);
begin
  if not (select prosecdef from pg_proc where oid = helper_oid)
     or not exists (
       select 1
       from pg_proc function_record
       cross join lateral unnest(coalesce(function_record.proconfig, array[]::text[])) setting
       where function_record.oid = helper_oid
         and setting like 'search_path=%'
     )
     or has_function_privilege('public', helper_oid, 'execute')
     or has_function_privilege('anon', helper_oid, 'execute')
     or not has_function_privilege('authenticated', helper_oid, 'execute')
     or not has_function_privilege('service_role', helper_oid, 'execute') then
    raise exception 'SEC-003 private assurance helper boundary is not exact';
  end if;

  if helper_definition !~ 'auth\.mfa_factors'
     or helper_definition !~ 'status = ''verified'''
     or helper_definition !~ '''support'', ''compliance'', ''admin'''
     or helper_definition !~ 'request_aal = ''aal2''' then
    raise exception 'SEC-003 role/factor assurance logic changed unexpectedly';
  end if;

  if hook_definition !~ 'DEALIVRA_MFA_REQUIRED'
     or hook_definition !~ '''status'', 403'
     or hook_definition !~ 'is_current_mfa_assurance_sufficient' then
    raise exception 'SEC-003 Data API fail-closed response is missing';
  end if;
end
$sec_003_boundary$;

do $sec_003_storage$
begin
  if not exists (
    select 1
    from pg_policy policy_record
    join pg_class table_record on table_record.oid = policy_record.polrelid
    join pg_namespace namespace_record on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'storage'
      and table_record.relname = 'objects'
      and policy_record.polname = 'MFA assurance required for protected accounts'
      and policy_record.polpermissive = false
      and policy_record.polroles = array['authenticated'::regrole::oid]
      and pg_get_expr(policy_record.polqual, policy_record.polrelid)
        ~ 'is_current_mfa_assurance_sufficient'
      and pg_get_expr(policy_record.polwithcheck, policy_record.polrelid)
        ~ 'is_current_mfa_assurance_sufficient'
  ) then
    raise exception 'SEC-003 restrictive Storage assurance policy is missing';
  end if;
end
$sec_003_storage$;

-- Exercise the real invoker role, not just function definitions or postgres calls.
do $hook_setup$
declare
  member_id uuid;
  privileged_id uuid;
  member_session uuid := gen_random_uuid();
  privileged_session uuid := gen_random_uuid();
begin
  select p.id into member_id from public.profiles p
    where p.app_role='member' and not exists (
      select 1 from auth.mfa_factors f where f.user_id=p.id and f.status='verified'
    ) order by p.id limit 1;
  select id into privileged_id from public.profiles
    where app_role in ('support','compliance','admin') order by id limit 1;
  if member_id is null or privileged_id is null then
    raise exception 'Hook proof requires member and privileged fixtures';
  end if;
  insert into auth.sessions(id,user_id,created_at,updated_at,not_after) values
    (member_session,member_id,now(),now(),now()+interval '5 minutes'),
    (privileged_session,privileged_id,now(),now(),now()+interval '5 minutes');
  perform set_config('dealivra.test_member_claims', jsonb_build_object(
    'sub',member_id,'session_id',member_session,'role','authenticated','aal','aal1')::text,true);
  perform set_config('dealivra.test_privileged_claims', jsonb_build_object(
    'sub',privileged_id,'session_id',privileged_session,'role','authenticated','aal','aal1')::text,true);
  -- Transaction-only metadata fixtures; no Storage blobs are created.
  perform set_config('dealivra.test_media_basename','rls-proof-' || gen_random_uuid()::text || '.png',true);
  insert into storage.objects(bucket_id,name,owner_id) values
    ('deal-media',member_id::text || '/' || current_setting('dealivra.test_media_basename'),member_id::text),
    ('deal-media',privileged_id::text || '/' || current_setting('dealivra.test_media_basename'),privileged_id::text);
end $hook_setup$;

set local role authenticated;
do $hook_calls$
declare detail_text text;
begin
  if not has_schema_privilege(current_user,'dealsafe_private','usage')
     or has_schema_privilege(current_user,'dealsafe_private','create')
     or has_schema_privilege('anon','dealsafe_private','usage') then
    raise exception 'Invoker helper schema boundary is incorrect';
  end if;
  perform set_config('request.jwt.claims',current_setting('dealivra.test_member_claims'),true);
  perform public.enforce_active_auth_session();
  if (select count(*) from storage.objects where bucket_id='deal-media'
      and name like '%/' || current_setting('dealivra.test_media_basename')) <> 1 then
    raise exception 'Storage owner must see exactly their own probe';
  end if;
  perform set_config('request.jwt.claims',current_setting('dealivra.test_privileged_claims'),true);
  begin
    perform public.enforce_active_auth_session();
    raise exception 'Password-only privileged session was accepted';
  exception when sqlstate 'PGRST' then
    get stacked diagnostics detail_text=pg_exception_detail;
    if sqlerrm::jsonb->>'code' <> 'DEALIVRA_MFA_REQUIRED' or detail_text::jsonb->>'status' <> '403' then
      raise exception 'Incorrect privileged denial';
    end if;
  end;
  perform set_config('request.jwt.claims',
    (current_setting('dealivra.test_privileged_claims')::jsonb || '{"aal":"aal2"}'::jsonb)::text,true);
  perform public.enforce_active_auth_session();
  perform set_config('request.jwt.claims',
    (current_setting('dealivra.test_member_claims')::jsonb || jsonb_build_object('session_id',gen_random_uuid()))::text,true);
  begin
    perform public.enforce_active_auth_session();
    raise exception 'Absent session was accepted';
  exception when sqlstate 'PGRST' then
    get stacked diagnostics detail_text=pg_exception_detail;
    if sqlerrm::jsonb->>'code' <> 'DEALIVRA_SESSION_REVOKED' or detail_text::jsonb->>'status' <> '401' then
      raise exception 'Incorrect session denial';
    end if;
  end;
  if exists(select 1 from storage.objects where bucket_id='deal-media'
      and name like '%/' || current_setting('dealivra.test_media_basename')) then
    raise exception 'Absent session read Storage probes';
  end if;
end $hook_calls$;
reset role;
rollback;
