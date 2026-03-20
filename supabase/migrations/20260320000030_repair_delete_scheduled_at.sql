-- LIN-567: Repair missing delete_scheduled_at column and post status triggers
--
-- Migration 20260319000024 was recorded as applied but the column was never
-- created. Migration 20260319000025 created the guard functions but never
-- attached the triggers. This migration re-applies both idempotently and
-- also syncs the status-transition trigger with the current workflow.ts
-- allowed transitions.

-- =============================================================================
-- 1. ADD MISSING COLUMN (idempotent)
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'posts' and column_name = 'delete_scheduled_at'
  ) then
    alter table posts add column delete_scheduled_at timestamptz;
  end if;
end;
$$;

-- 2. Index for the cleanup query (idempotent)
create index if not exists idx_posts_delete_scheduled
  on posts (delete_scheduled_at)
  where delete_scheduled_at is not null and status = 'rejected';

-- =============================================================================
-- 3. CLEANUP FUNCTION (re-create idempotently)
-- =============================================================================

create or replace function cleanup_rejected_posts()
returns integer
language plpgsql
security definer
as $$
declare
  deleted_count integer;
begin
  delete from posts
  where delete_scheduled_at < now()
    and status = 'rejected';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- =============================================================================
-- 4. SYNC enforce_post_status_transition WITH workflow.ts
-- =============================================================================
-- Adds missing transitions: scheduled → pending_review, publish_failed → pending_review

create or replace function enforce_post_status_transition()
returns trigger
language plpgsql
as $$
declare
  allowed text[];
begin
  -- Skip if status hasn't changed
  if old.status = new.status then
    return new;
  end if;

  -- Define allowed transitions (mirrors workflow.ts ALLOWED_TRANSITIONS)
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
      allowed := array['published', 'approved', 'publish_failed', 'pending_review'];
    when 'published' then
      allowed := array[]::text[];
    when 'publish_failed' then
      allowed := array['scheduled', 'draft', 'pending_review'];
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
$$;

-- =============================================================================
-- 5. RE-CREATE protect_delete_scheduled_at (now that column exists)
-- =============================================================================

create or replace function protect_delete_scheduled_at()
returns trigger
language plpgsql
as $$
begin
  -- Allow if the column value hasn't changed
  if NEW.delete_scheduled_at is not distinct from OLD.delete_scheduled_at then
    return NEW;
  end if;

  -- Allow service role unconditionally
  if current_setting('role', true) = 'service_role' then
    return NEW;
  end if;

  -- Allow setting delete_scheduled_at when transitioning to 'rejected'
  if NEW.status = 'rejected' and OLD.status != 'rejected' and NEW.delete_scheduled_at is not null then
    return NEW;
  end if;

  -- Allow clearing delete_scheduled_at when reverting to 'draft' or 'pending_review'
  if NEW.status in ('draft', 'pending_review') and OLD.status = 'rejected' and NEW.delete_scheduled_at is null then
    return NEW;
  end if;

  -- Block all other modifications: reset to old value
  NEW.delete_scheduled_at := OLD.delete_scheduled_at;
  return NEW;
end;
$$;

-- =============================================================================
-- 6. ATTACH TRIGGERS (idempotent via DROP IF EXISTS)
-- =============================================================================

drop trigger if exists trg_enforce_post_status_transition on posts;
create trigger trg_enforce_post_status_transition
  before update on posts
  for each row
  execute function enforce_post_status_transition();

drop trigger if exists trg_protect_delete_scheduled_at on posts;
create trigger trg_protect_delete_scheduled_at
  before update on posts
  for each row
  execute function protect_delete_scheduled_at();

-- =============================================================================
-- 7. NOTIFY PostgREST to reload schema cache
-- =============================================================================

notify pgrst, 'reload schema';
