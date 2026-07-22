-- Allows only the deal seller to remove their media records. Safe to rerun.
drop policy if exists "seller deletes media records" on public.deal_media;
create policy "seller deletes media records" on public.deal_media for delete to authenticated
using(exists(select 1 from public.deals d where d.id=deal_media.deal_id and d.seller_id=auth.uid()));
