-- Run once in Supabase SQL Editor. Published item photos are intentionally public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deal-media', 'deal-media', true, 26214400, array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/webm'])
on conflict (id) do update set public=excluded.public, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "owners upload deal media" on storage.objects;
drop policy if exists "owners update deal media" on storage.objects;
drop policy if exists "owners delete deal media" on storage.objects;
drop policy if exists "participants read media records" on public.deal_media;
drop policy if exists "seller inserts media records" on public.deal_media;

create policy "owners upload deal media" on storage.objects for insert to authenticated
with check (bucket_id='deal-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "owners update deal media" on storage.objects for update to authenticated
using (bucket_id='deal-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "owners delete deal media" on storage.objects for delete to authenticated
using (bucket_id='deal-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "participants read media records" on public.deal_media for select to authenticated
using (exists (select 1 from public.deals d where d.id=deal_media.deal_id and (d.seller_id=auth.uid() or d.buyer_id=auth.uid())));
create policy "seller inserts media records" on public.deal_media for insert to authenticated
with check (exists (select 1 from public.deals d where d.id=deal_media.deal_id and d.seller_id=auth.uid()));

drop function if exists public.get_public_deal(text);
create function public.get_public_deal(p_public_id text)
returns table (id uuid, public_id text, title text, description text, price_cents bigint,
currency char(3), condition text, serial_last_four text, delivery_method text,
status public.deal_status, agreement_version integer, seller_name text,
seller_verification public.verification_status, created_at timestamptz, media_paths text[])
language sql stable security definer set search_path=public as $$
select d.id,d.public_id,d.title,d.description,d.price_cents,d.currency,d.condition,d.serial_last_four,
d.delivery_method,d.status,greatest(d.current_agreement_version,1),p.display_name,p.verification_status,d.created_at,
coalesce(array_agg(m.storage_path order by m.sort_order) filter(where m.id is not null),'{}')
from public.deals d join public.profiles p on p.id=d.seller_id left join public.deal_media m on m.deal_id=d.id
where d.public_id=p_public_id and d.status in ('published','accepted','completed')
group by d.id,p.display_name,p.verification_status;
$$;
revoke all on function public.get_public_deal(text) from public;
grant execute on function public.get_public_deal(text) to anon,authenticated;
