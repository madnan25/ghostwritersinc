-- LIN-262: Support rejected → pending_review transition for revise-and-resubmit
--
-- 1. Add 'revised' to the review_action enum
-- 2. Update status transition trigger to allow rejected → pending_review
-- 3. Update delete_scheduled_at guard to allow clearing on rejected → pending_review

-- 1. Extend review_action enum
alter type review_action add value if not exists 'revised';

-- 2. Update status transition trigger to include rejected → pending_review
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
    when 'rejected' then allowed := array['draft', 'pending_review'];
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

-- 3. Update delete_scheduled_at guard to allow clearing on rejected → pending_review
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

  -- Allow clearing delete_scheduled_at when reverting to 'draft' from 'rejected'
  if NEW.status = 'draft' and OLD.status = 'rejected' and NEW.delete_scheduled_at is null then
    return NEW;
  end if;

  -- Allow clearing delete_scheduled_at when resubmitting to 'pending_review' from 'rejected'
  if NEW.status = 'pending_review' and OLD.status = 'rejected' and NEW.delete_scheduled_at is null then
    return NEW;
  end if;

  -- Block all other modifications: reset to old value
  NEW.delete_scheduled_at := OLD.delete_scheduled_at;
  return NEW;
end;
$$;
