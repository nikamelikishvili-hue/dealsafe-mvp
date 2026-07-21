-- Run once in Supabase SQL Editor. Safe to rerun.
create or replace function public.request_identity_verification()
returns public.verification_status
language plpgsql security definer set search_path=public as $$
declare v_status public.verification_status;
begin
  update public.profiles
  set verification_status=case when verification_status='verified' then 'verified'::public.verification_status else 'pending'::public.verification_status end,
      verification_provider=case when verification_status='verified' then verification_provider else 'provider_not_connected' end
  where id=auth.uid()
  returning verification_status into v_status;
  if not found then raise exception 'Profile not found'; end if;
  return v_status;
end; $$;
revoke all on function public.request_identity_verification() from public;
grant execute on function public.request_identity_verification() to authenticated;
