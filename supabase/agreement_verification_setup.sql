-- Public, privacy-safe agreement fingerprint verification.
-- Safe to run more than once.

create or replace function public.verify_agreement_record(p_public_id text,p_content_hash text)
returns table(
  matched boolean,
  public_id text,
  version integer,
  is_current boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    true,
    deal.public_id,
    agreement.version,
    agreement.version=greatest(deal.current_agreement_version,1),
    agreement.created_at
  from public.deals deal
  join public.agreement_versions agreement on agreement.deal_id=deal.id
  where deal.public_id=upper(trim(p_public_id))
    and (
      lower(agreement.canonical_hash)=lower(trim(p_content_hash))
      or lower(agreement.content_hash)=lower(trim(p_content_hash))
    )
    and trim(p_content_hash) ~ '^[A-Fa-f0-9]{64}$'
    and deal.status in ('published','accepted','completed','disputed')
  order by (agreement.version=greatest(deal.current_agreement_version,1)) desc,agreement.version desc
  limit 1;
$$;

revoke all on function public.verify_agreement_record(text,text) from public;
grant execute on function public.verify_agreement_record(text,text) to anon,authenticated;
