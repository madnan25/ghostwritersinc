-- LIN-465: Fix TOCTOU race condition on 3-revision cap
--
-- The application-level count check in targeted-revision/route.ts is not atomic:
-- two concurrent requests can both read count=2, both pass the guard, and both
-- insert — resulting in 4+ targeted revisions.
--
-- Fix: a BEFORE INSERT trigger that counts existing targeted revisions inside
-- the same transaction, raising an exception if the cap would be exceeded.
-- The trigger runs atomically, so no concurrent INSERT can slip past it.

-- =============================================================================
-- 1. Trigger function
-- =============================================================================
create or replace function enforce_targeted_revision_cap()
returns trigger
language plpgsql
as $$
declare
  existing_count integer;
begin
  -- Only enforce for targeted revisions
  if NEW.revision_type <> 'targeted' then
    return NEW;
  end if;

  select count(*)
    into existing_count
    from post_revisions
   where post_id = NEW.post_id
     and revision_type = 'targeted';

  if existing_count >= 3 then
    raise exception 'max_targeted_revisions_exceeded'
      using errcode = 'P0001',
            detail  = 'Maximum targeted revisions (3) reached for this draft';
  end if;

  return NEW;
end;
$$;

-- =============================================================================
-- 2. Attach trigger to post_revisions (fires before every INSERT)
-- =============================================================================
create trigger trg_targeted_revision_cap
  before insert on post_revisions
  for each row
  execute function enforce_targeted_revision_cap();

comment on function enforce_targeted_revision_cap() is
  'Atomically enforces a max of 3 targeted revisions per post, preventing TOCTOU races in the API layer.';
