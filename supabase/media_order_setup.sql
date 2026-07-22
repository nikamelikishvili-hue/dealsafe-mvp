-- Lets only the seller reorder media for their deal. Safe to rerun.
create or replace function public.reorder_deal_media(p_deal_id uuid,p_paths text[])
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.deals where id=p_deal_id and seller_id=auth.uid()) then raise exception 'Only the seller can reorder media';end if;
  if (select count(*) from public.deal_media where deal_id=p_deal_id)<>coalesce(array_length(p_paths,1),0) then raise exception 'Media list is incomplete';end if;
  if exists(select 1 from unnest(p_paths) path where not exists(select 1 from public.deal_media m where m.deal_id=p_deal_id and m.storage_path=path)) then raise exception 'Invalid media item';end if;
  update public.deal_media m set sort_order=ordered.position-1 from unnest(p_paths) with ordinality ordered(path,position)
  where m.deal_id=p_deal_id and m.storage_path=ordered.path;
  insert into public.audit_events(deal_id,actor_id,event_type) values(p_deal_id,auth.uid(),'media_reordered');
end; $$;
revoke all on function public.reorder_deal_media(uuid,text[]) from public;
grant execute on function public.reorder_deal_media(uuid,text[]) to authenticated;
