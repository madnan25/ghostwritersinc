-- LIN-497: Post freshness columns, staleness check, and archive support
--
-- Adds freshness metadata to posts:
--   - freshness_type: evergreen | time_sensitive | date_locked
--   - expiry_date: when a post becomes stale/should be archived
--   - archived_at: soft-archive timestamp (content preserved)
--
-- Staleness processing:
--   - time_sensitive posts past expiry_date: identified by process_post_freshness()
--   - date_locked posts past expiry_date: auto-archived by process_post_freshness()
--
-- RLS: new columns live on posts table; existing policies already cover them.

-- =============================================================================
-- 1. CREATE freshness_type ENUM
-- =============================================================================

create type freshness_type as enum ('evergreen', 'time_sensitive', 'date_locked');

-- =============================================================================
-- 2. ADD COLUMNS TO posts
-- =============================================================================

alter table posts
  add column freshness_type freshness_type not null default 'evergreen';

alter table posts
  add column expiry_date timestamptz;

alter table posts
  add column archived_at timestamptz;

-- =============================================================================
-- 3. INDEXES
-- =============================================================================

-- Staleness cron: find expired posts efficiently
create index idx_posts_expiry
  on posts (expiry_date)
  where expiry_date is not null and archived_at is null;

-- Archive filter: exclude archived posts from standard queries
create index idx_posts_archived
  on posts (organization_id, archived_at)
  where archived_at is not null;

-- =============================================================================
-- 4. STALENESS PROCESSING FUNCTION
-- =============================================================================
-- Runs on a schedule (pg_cron) or via POST /api/cron/staleness.
--
-- For time_sensitive posts: returns them as "stale" but does NOT archive them —
--   the application layer decides what to do (notification, label, etc.).
-- For date_locked posts: sets archived_at = now() automatically.

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

  return query select v_archived, v_stale;
end;
$$;

-- =============================================================================
-- 5. SCHEDULE VIA pg_cron (hourly)
-- =============================================================================

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'process-post-freshness',
      '0 * * * *',
      'select * from process_post_freshness()'
    );
  end if;
end;
$$;
