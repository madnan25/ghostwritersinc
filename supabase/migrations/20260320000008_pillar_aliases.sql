-- Pillar normalization system (LIN-462)
-- Creates the pillar_aliases table and adds pillar_mapping_status to pillar-bearing tables.

-- =============================================================================
-- 1. pillar_aliases table
-- =============================================================================

create table pillar_aliases (
  id          uuid primary key default gen_random_uuid(),
  alias       text not null unique,
  pillar_id   uuid references content_pillars(id) on delete cascade,
  confidence  text not null default 'high'
                check (confidence in ('high', 'medium', 'low')),
  created_at  timestamptz not null default now()
);

-- RLS: read-only for org members (aliases are global seed data, no org scope needed)
alter table pillar_aliases enable row level security;

create policy "pillar_aliases are readable by authenticated users"
  on pillar_aliases for select
  using (auth.role() = 'authenticated');

-- =============================================================================
-- 2. Pre-seed aliases (org-agnostic slug → slug mapping resolved at query time)
--    We insert with pillar_id = null and resolve to the correct org pillar at
--    runtime in pillar-normalization.ts using the alias text.
--    This keeps aliases portable across orgs.
-- =============================================================================

insert into pillar_aliases (alias, pillar_id, confidence) values
  ('thought-leadership', null, 'high'),
  ('personal-story',     null, 'high'),
  ('software',           null, 'high'),
  ('ads',                null, 'high'),
  ('global-team',        null, 'high'),
  ('cross-border',       null, 'high'),
  ('ai',                 null, 'medium');

-- Store the target slug so we can resolve to org-specific pillar_id at runtime
alter table pillar_aliases add column target_slug text;

update pillar_aliases set target_slug = 'ai-agents-automation'    where alias = 'thought-leadership';
update pillar_aliases set target_slug = 'operators-playbook'      where alias = 'personal-story';
update pillar_aliases set target_slug = 'custom-software'         where alias = 'software';
update pillar_aliases set target_slug = 'advertising'             where alias = 'ads';
update pillar_aliases set target_slug = 'building-across-borders' where alias = 'global-team';
update pillar_aliases set target_slug = 'building-across-borders' where alias = 'cross-border';
update pillar_aliases set target_slug = 'ai-agents-automation'    where alias = 'ai';

-- =============================================================================
-- 3. pillar_mapping_status enum + column on pillar-bearing tables
-- =============================================================================

create type pillar_mapping_status as enum ('auto', 'manual', 'needs_review');

alter table research_pool
  add column pillar_mapping_status pillar_mapping_status not null default 'auto';

alter table briefs
  add column pillar_mapping_status pillar_mapping_status not null default 'auto';

alter table posts
  add column pillar_mapping_status pillar_mapping_status not null default 'auto';
