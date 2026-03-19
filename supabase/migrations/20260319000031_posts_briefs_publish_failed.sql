-- Add revision_count, brief_id to posts + publish_failed enum value (LIN-302 Sprint 1)

-- =============================================================================
-- 1. ADD publish_failed to post_status enum
-- =============================================================================
-- Postgres doesn't support ALTER TYPE ... ADD VALUE inside a transaction in
-- older versions, but Supabase uses PG 15+ which allows it.
alter type post_status add value if not exists 'publish_failed' after 'published';

-- =============================================================================
-- 2. ADD columns to posts
-- =============================================================================

alter table posts
  add column revision_count integer not null default 0;

alter table posts
  add column brief_id uuid references briefs(id) on delete set null;

create index idx_posts_brief on posts (brief_id);

-- =============================================================================
-- 3. UPDATE status transition trigger to handle publish_failed
-- =============================================================================
-- The application-level workflow.ts handles transitions, but we also add a
-- database-level check constraint via the existing trigger if present.
-- The trigger in 20260319000027_revise_and_resubmit.sql validates transitions;
-- we need to update it to allow scheduled → publish_failed and
-- publish_failed → scheduled.

-- Replace the transition validation trigger function to include publish_failed
create or replace function enforce_post_status_transition()
returns trigger as $$
declare
  allowed text[];
begin
  -- Skip if status hasn't changed
  if old.status = new.status then
    return new;
  end if;

  -- Define allowed transitions
  case old.status::text
    when 'draft' then
      allowed := array['pending_review'];
    when 'pending_review' then
      allowed := array['approved', 'rejected'];
    when 'approved' then
      allowed := array['scheduled', 'published', 'pending_review'];
    when 'rejected' then
      allowed := array['draft', 'pending_review'];
    when 'scheduled' then
      allowed := array['published', 'approved', 'publish_failed'];
    when 'published' then
      allowed := array[]::text[];
    when 'publish_failed' then
      allowed := array['scheduled', 'draft'];
    else
      allowed := array[]::text[];
  end case;

  if not (new.status::text = any(allowed)) then
    raise exception 'Invalid status transition from % to %', old.status, new.status;
  end if;

  -- Auto-increment revision_count on agent rejection
  if old.status::text = 'pending_review' and new.status::text = 'rejected' then
    new.revision_count := old.revision_count + 1;
  end if;

  -- Reset revision_count when human reopens (rejected → draft or pending_review)
  if old.status::text = 'rejected' and new.status::text in ('draft', 'pending_review') then
    new.revision_count := 0;
  end if;

  return new;
end;
$$ language plpgsql;
