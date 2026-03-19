-- Security hardening for posts table (LIN-255 Findings 1 & 3)
--
-- 1. BEFORE UPDATE trigger enforcing valid status transitions at DB level,
--    preventing bypass via direct Supabase REST API calls.
-- 2. Protect delete_scheduled_at from direct user modification — only
--    service-role (security definer functions) can write this column.

-- Guard 1: Enforce valid status transitions at the database level
create or replace function enforce_post_status_transition()
returns trigger
language plpgsql
as $$
declare
  allowed text[];
begin
  -- If status hasn't changed, allow the update (non-status field edits)
  if NEW.status = OLD.status then
    return NEW;
  end if;

  -- Define the allowed transitions (mirrors workflow.ts ALLOWED_TRANSITIONS)
  case OLD.status
    when 'draft' then allowed := array['pending_review'];
    when 'pending_review' then allowed := array['approved', 'rejected'];
    when 'approved' then allowed := array['scheduled', 'published'];
    when 'rejected' then allowed := array['draft'];
    when 'scheduled' then allowed := array['published'];
    when 'published' then allowed := array[]::text[];
    else allowed := array[]::text[];
  end case;

  if NEW.status = any(allowed) then
    return NEW;
  end if;

  raise exception 'Invalid status transition from "%" to "%"', OLD.status, NEW.status
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists trg_enforce_post_status_transition on posts;
create trigger trg_enforce_post_status_transition
  before update on posts
  for each row
  execute function enforce_post_status_transition();

-- Guard 2: Protect delete_scheduled_at from arbitrary writes.
-- Only allow changes to delete_scheduled_at in two legitimate scenarios:
--   a) Post is being rejected (status → 'rejected'): set the timer
--   b) Post is being reverted to draft (status → 'draft'): clear the timer
-- All other attempts to modify delete_scheduled_at are silently blocked.
-- This prevents direct Supabase REST API abuse (LIN-255 Finding 1).
create or replace function protect_delete_scheduled_at()
returns trigger
language plpgsql
as $$
begin
  -- Allow if the column value hasn't changed
  if NEW.delete_scheduled_at is not distinct from OLD.delete_scheduled_at then
    return NEW;
  end if;

  -- Allow service role unconditionally (admin client, pg_cron, edge functions)
  if current_setting('role', true) = 'service_role' then
    return NEW;
  end if;

  -- Allow setting delete_scheduled_at when transitioning to 'rejected'
  if NEW.status = 'rejected' and OLD.status != 'rejected' and NEW.delete_scheduled_at is not null then
    return NEW;
  end if;

  -- Allow clearing delete_scheduled_at when reverting to 'draft'
  if NEW.status = 'draft' and OLD.status = 'rejected' and NEW.delete_scheduled_at is null then
    return NEW;
  end if;

  -- Block all other modifications: reset to old value
  NEW.delete_scheduled_at := OLD.delete_scheduled_at;
  return NEW;
end;
$$;

drop trigger if exists trg_protect_delete_scheduled_at on posts;
create trigger trg_protect_delete_scheduled_at
  before update on posts
  for each row
  execute function protect_delete_scheduled_at();
