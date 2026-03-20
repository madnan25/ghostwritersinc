-- LIN-509: Add staleness_flagged notification type and update process_post_freshness
-- to create notifications when time-sensitive posts go stale.

-- =============================================================================
-- 1. ADD staleness_flagged TO notification_type ENUM
-- =============================================================================

alter type notification_type add value if not exists 'staleness_flagged';

-- =============================================================================
-- 2. UPDATE process_post_freshness() TO INSERT NOTIFICATIONS
-- =============================================================================
-- When time_sensitive posts pass their expiry_date, insert a notification
-- for the post owner so they can take action.

create or replace function process_post_freshness()
returns table(
  auto_archived_count integer,
  stale_time_sensitive_count integer
)
language plpgsql
security definer
as $$
declare
  v_archived integer;
  v_stale    integer;
  r          record;
begin
  -- Auto-archive date_locked posts whose expiry_date has passed
  update posts
  set archived_at = now()
  where freshness_type = 'date_locked'
    and expiry_date is not null
    and expiry_date < now()
    and archived_at is null;

  get diagnostics v_archived = row_count;

  -- Count stale time_sensitive posts (flagged but not auto-archived)
  select count(*)::integer
  into v_stale
  from posts
  where freshness_type = 'time_sensitive'
    and expiry_date is not null
    and expiry_date < now()
    and archived_at is null;

  -- Create notifications for newly stale time_sensitive posts
  -- (only if no staleness_flagged notification exists yet for this post)
  for r in
    select p.id as post_id,
           p.organization_id,
           p.user_id,
           coalesce(p.title, p.angle, 'Untitled') as post_title,
           extract(day from now() - p.expiry_date)::integer as days_past
    from posts p
    where p.freshness_type = 'time_sensitive'
      and p.expiry_date is not null
      and p.expiry_date < now()
      and p.archived_at is null
      and not exists (
        select 1 from notifications n
        where n.post_id = p.id
          and n.type = 'staleness_flagged'
      )
  loop
    insert into notifications (organization_id, user_id, type, title, body, post_id)
    values (
      r.organization_id,
      r.user_id,
      'staleness_flagged',
      'Draft going stale',
      r.post_title || ' — ' || r.days_past || ' day(s) past expiry'
      , r.post_id
    );
  end loop;

  return query select v_archived, v_stale;
end;
$$;
