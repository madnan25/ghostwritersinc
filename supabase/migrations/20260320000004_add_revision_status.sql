-- LIN-413: Add `revision` status to post lifecycle
--
-- Closes the loophole where a draft can be approved while a user-requested
-- revision is in flight.
--
-- 1. Add 'revision' to the post_status enum
-- 2. Update status transition trigger to allow:
--    - pending_review -> revision
--    - revision -> pending_review

-- =============================================================================
-- 1. ADD revision to post_status enum
-- =============================================================================
alter type post_status add value if not exists 'revision' after 'rejected';

-- =============================================================================
-- 2. UPDATE status transition trigger to handle revision
-- =============================================================================
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
      allowed := array['approved', 'rejected', 'revision'];
    when 'approved' then
      allowed := array['scheduled', 'published', 'pending_review'];
    when 'rejected' then
      allowed := array['draft', 'pending_review'];
    when 'revision' then
      allowed := array['pending_review'];
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
