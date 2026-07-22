-- Explainable, rules-based Deal Link risk signals. Safe to rerun.
create or replace function public.get_deal_risk_assessment(p_public_id text)
returns table(risk_score integer,risk_level text,signals text[])
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_deal public.deals%rowtype;
  v_verification public.verification_status;
  v_member_since timestamptz;
  v_media_count integer;
  v_report_count integer;
  v_score integer := 0;
  v_signals text[] := '{}';
  v_text text;
begin
  select d.* into v_deal
  from public.deals d
  where d.public_id=upper(trim(p_public_id))
    and d.status in ('published','accepted','completed')
    and not exists(
      select 1 from public.deal_moderation dm
      where dm.deal_id=d.id and dm.status='hidden'
    );

  if not found then return; end if;

  select p.verification_status,p.created_at
  into v_verification,v_member_since
  from public.profiles p where p.id=v_deal.seller_id;

  select count(*)::integer into v_media_count
  from public.deal_media where deal_id=v_deal.id;

  select count(*)::integer into v_report_count
  from public.reports where deal_id=v_deal.id and status='open';

  if v_verification<>'verified' then
    v_score:=v_score+18;
    v_signals:=array_append(v_signals,'unverified_seller');
  end if;

  if v_member_since>now()-interval '7 days' then
    v_score:=v_score+20;
    v_signals:=array_append(v_signals,'new_account');
  elsif v_member_since>now()-interval '30 days' then
    v_score:=v_score+10;
    v_signals:=array_append(v_signals,'limited_history');
  end if;

  if v_media_count=0 then
    v_score:=v_score+20;
    v_signals:=array_append(v_signals,'no_photos');
  elsif v_media_count=1 then
    v_score:=v_score+8;
    v_signals:=array_append(v_signals,'single_photo');
  end if;

  if v_deal.serial_last_four is null
     and v_deal.title~*'(iphone|phone|smartphone|macbook|laptop|camera|gpu|watch|tablet|console)'
  then
    v_score:=v_score+10;
    v_signals:=array_append(v_signals,'missing_serial');
  end if;

  v_text:=coalesce(v_deal.title,'')||' '||coalesce(v_deal.description,'');
  if v_text~*'(gift[ -]?card|bitcoin|crypto|wire transfer|western union|telegram|whatsapp|deposit only|pay outside)' then
    v_score:=v_score+25;
    v_signals:=array_append(v_signals,'payment_language');
  end if;

  if v_report_count>0 then
    v_score:=v_score+least(30,v_report_count*15);
    v_signals:=array_append(v_signals,'community_reports');
  end if;

  v_score:=least(100,v_score);
  if cardinality(v_signals)=0 then v_signals:=array['no_flags']; end if;

  return query select v_score,
    case when v_score>=60 then 'high' when v_score>=30 then 'medium' else 'low' end,
    v_signals;
end;
$$;

revoke all on function public.get_deal_risk_assessment(text) from public;
grant execute on function public.get_deal_risk_assessment(text) to anon,authenticated;
