-- Research Pool — curated research items for content creation (LIN-302 Sprint 1)

create type research_pool_status as enum ('new', 'consumed');

create table research_pool (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  source_url text,
  source_type text not null default 'article',
  pillar_id uuid references content_pillars(id) on delete set null,
  relevance_score numeric(3,2) check (relevance_score >= 0 and relevance_score <= 1),
  raw_content text,
  status research_pool_status not null default 'new',
  created_by_agent_id uuid references agents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_research_pool_org on research_pool (organization_id);
create index idx_research_pool_pillar on research_pool (pillar_id);
create index idx_research_pool_status on research_pool (organization_id, status);
create index idx_research_pool_agent on research_pool (created_by_agent_id);

-- updated_at trigger
create trigger research_pool_updated_at
  before update on research_pool
  for each row execute function update_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY — org-scoped
-- =============================================================================

alter table research_pool enable row level security;

create policy "Users can view org research pool"
  on research_pool for select
  using (organization_id = public.user_organization_id());

create policy "Users can create research pool items in their org"
  on research_pool for insert
  with check (organization_id = public.user_organization_id());

create policy "Users can update org research pool items"
  on research_pool for update
  using (organization_id = public.user_organization_id());

create policy "Users can delete org research pool items"
  on research_pool for delete
  using (organization_id = public.user_organization_id());
