-- Migration: Add source/priority to briefs, scout_context to strategy_config
-- Sprint 1: Human Post Requests + Scout Context Injection (LIN-421)

-- 1. Create enum types
create type brief_source as enum ('ai_generated', 'human_request');
create type brief_priority as enum ('normal', 'urgent');

-- 2. Add source column to briefs (default ai_generated for existing rows)
alter table briefs
  add column source brief_source not null default 'ai_generated';

-- 3. Add priority column to briefs (default normal for existing rows)
alter table briefs
  add column priority brief_priority not null default 'normal';

-- 4. Add scout_context to strategy_config
alter table strategy_config
  add column scout_context text;

-- 5. Add index for filtering briefs by source (human vs ai)
create index idx_briefs_source on briefs (organization_id, source);

-- 6. RLS policies already cover all columns on briefs and strategy_config.
--    Column-level additions inherit the existing row-level policies.
--    No new policies needed.

comment on column briefs.source is 'Whether the brief was AI-generated or human-requested';
comment on column briefs.priority is 'Priority level: normal or urgent';
comment on column strategy_config.scout_context is 'Free-text instructions injected into Scout heartbeat as current priorities';
