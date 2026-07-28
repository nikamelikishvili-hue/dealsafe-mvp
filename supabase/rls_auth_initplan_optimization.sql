-- DBP-001: evaluate the authenticated identity once per statement in the
-- remaining participant RLS policies. Authorization semantics are unchanged.

drop policy if exists "participants read media records" on public.deal_media;
create policy "participants read media records"
  on public.deal_media
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.deals deal
      where deal.id = deal_media.deal_id
        and (
          deal.seller_id = (select auth.uid())
          or deal.buyer_id = (select auth.uid())
        )
    )
  );

drop policy if exists "seller inserts media records" on public.deal_media;
create policy "seller inserts media records"
  on public.deal_media
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.deals deal
      where deal.id = deal_media.deal_id
        and deal.seller_id = (select auth.uid())
    )
  );

drop policy if exists "seller deletes media records" on public.deal_media;
create policy "seller deletes media records"
  on public.deal_media
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.deals deal
      where deal.id = deal_media.deal_id
        and deal.seller_id = (select auth.uid())
    )
  );

drop policy if exists "participants read meetings" on public.deal_meetings;
create policy "participants read meetings"
  on public.deal_meetings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.deals deal
      where deal.id = deal_meetings.deal_id
        and (
          deal.seller_id = (select auth.uid())
          or deal.buyer_id = (select auth.uid())
        )
    )
  );

drop policy if exists "participants read ratings" on public.ratings;
create policy "participants read ratings"
  on public.ratings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.deals deal
      where deal.id = ratings.deal_id
        and (
          deal.seller_id = (select auth.uid())
          or deal.buyer_id = (select auth.uid())
        )
    )
  );

drop policy if exists "participants read messages" on public.deal_messages;
create policy "participants read messages"
  on public.deal_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.deals deal
      where deal.id = deal_messages.deal_id
        and (
          deal.seller_id = (select auth.uid())
          or deal.buyer_id = (select auth.uid())
        )
    )
  );

drop policy if exists "participants read shipments" on public.deal_shipments;
create policy "participants read shipments"
  on public.deal_shipments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.deals deal
      where deal.id = deal_shipments.deal_id
        and (
          deal.seller_id = (select auth.uid())
          or deal.buyer_id = (select auth.uid())
        )
    )
  );

drop policy if exists "participants read deal disputes" on public.deal_disputes;
create policy "participants read deal disputes"
  on public.deal_disputes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.deals deal
      where deal.id = deal_disputes.deal_id
        and (
          deal.seller_id = (select auth.uid())
          or deal.buyer_id = (select auth.uid())
        )
    )
  );

drop policy if exists "participants upload deal evidence" on public.deal_evidence;

drop policy if exists "participants and admins read deal evidence"
  on public.deal_evidence;
drop policy if exists "participants and case admins read safe evidence"
  on public.deal_evidence;
create policy "participants and case admins read safe evidence"
  on public.deal_evidence
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.deals deal
      where deal.id = deal_evidence.deal_id
        and (
          deal.seller_id = (select auth.uid())
          or deal.buyer_id = (select auth.uid())
        )
    )
    or (
      (select public.is_dealsafe_admin())
      and exists (
        select 1
        from public.deal_disputes dispute
        where dispute.deal_id = deal_evidence.deal_id
      )
    )
  );
