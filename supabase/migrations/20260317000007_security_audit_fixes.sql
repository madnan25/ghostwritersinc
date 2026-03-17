-- Security audit fixes (LIN-122/123/124)
-- 1. Block direct INSERT/UPDATE/DELETE on review_events (LIN-123)
-- 2. Scope storage policies to org folder (LIN-124 finding 1)

-- =============================================================================
-- FIX: review_events INSERT/UPDATE/DELETE policies (LIN-123)
-- =============================================================================
-- Only the service role (admin client) should insert review events.
-- Block anon/authenticated inserts at the DB level.

create policy "Block direct insert on review_events"
  on review_events for insert
  with check (false);

create policy "Block direct update on review_events"
  on review_events for update
  using (false);

create policy "Block direct delete on review_events"
  on review_events for delete
  using (false);

-- =============================================================================
-- FIX: Scope storage policies to org folder (LIN-124 finding 1)
-- =============================================================================
-- Replace open storage policies with org-scoped ones.

drop policy if exists "Authenticated users can upload research files" on storage.objects;
drop policy if exists "Users can read research files from their bucket" on storage.objects;

create policy "Users can upload to their org folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'research'
    and (storage.foldername(name))[1] = (select organization_id::text from public.users where id = auth.uid())
  );

create policy "Users can read from their org folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'research'
    and (storage.foldername(name))[1] = (select organization_id::text from public.users where id = auth.uid())
  );
