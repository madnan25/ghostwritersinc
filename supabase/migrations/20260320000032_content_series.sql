-- LIN-530: content_series table, series CRUD + lifecycle API
-- Sprint 6 — Content Series Management
--
-- Changes:
--   1. series_cadence enum ('weekly' | 'biweekly' | 'monthly')
--   2. series_status enum ('planning' | 'active' | 'paused' | 'cancelled' | 'completed')
--   3. brief_status extended with 'pending_strategist'
--   4. brief_source extended with 'series_generated'
--   5. content_series table with RLS (org-scoped)
--   6. series_id + series_part_number added to briefs
--   7. series_id added to posts
--
-- Breaking API changes: none

-- =============================================================================
-- 1. series_cadence enum
-- =============================================================================
do $$ begin
  create type series_cadence as enum ('weekly', 'biweekly', 'monthly');
exception when duplicate_object then null;
end $$;

-- =============================================================================
-- 2. series_status enum
-- =============================================================================
do $$ begin
  create type series_status as enum ('planning', 'active', 'paused', 'cancelled', 'completed');
exception when duplicate_object then null;
end $$;

-- =============================================================================
-- 3. Extend brief_status with pending_strategist
-- =============================================================================
alter type brief_status add value if not exists 'pending_strategist';

-- =============================================================================
-- 4. Extend brief_source with series_generated
-- =============================================================================
alter type brief_source add value if not exists 'series_generated';

-- =============================================================================
-- 5. content_series table
-- =============================================================================
create table if not exists content_series (
  id             uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id        uuid references users(id) on delete set null,
  title          text not null,
  description    text,
  total_parts    integer not null check (total_parts >= 2 and total_parts <= 8),
  cadence        series_cadence not null default 'weekly',
  status         series_status not null default 'planning',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  completed_at   timestamptz,
  debrief        jsonb
);

create index if not exists idx_content_series_org
  on content_series (organization_id);

create index if not exists idx_content_series_status
  on content_series (organization_id, status);

create trigger content_series_updated_at
  before update on content_series
  for each row execute function update_updated_at();

-- =============================================================================
-- 6. RLS on content_series — org-scoped
-- =============================================================================
alter table content_series enable row level security;

create policy "Users can view org content series"
  on content_series for select
  using (organization_id = public.user_organization_id());

create policy "Users can create content series in their org"
  on content_series for insert
  with check (organization_id = public.user_organization_id());

create policy "Users can update org content series"
  on content_series for update
  using (organization_id = public.user_organization_id());

create policy "Users can delete org content series"
  on content_series for delete
  using (organization_id = public.user_organization_id());

-- =============================================================================
-- 7. Add series columns to briefs
-- =============================================================================
alter table briefs
  add column if not exists series_id uuid references content_series(id) on delete set null;

alter table briefs
  add column if not exists series_part_number integer;

create index if not exists idx_briefs_series
  on briefs (series_id) where series_id is not null;

-- =============================================================================
-- 8. Add series column to posts
-- =============================================================================
alter table posts
  add column if not exists series_id uuid references content_series(id) on delete set null;

create index if not exists idx_posts_series
  on posts (series_id) where series_id is not null;

comment on column briefs.series_id          is 'Series this brief belongs to (null if standalone)';
comment on column briefs.series_part_number is 'Part number within the series (1-based)';
comment on column posts.series_id           is 'Series this post belongs to (null if standalone)';
