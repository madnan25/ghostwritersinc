-- Briefs — content briefs linking pillars to posts (LIN-302 Sprint 1)

create type brief_status as enum ('pending', 'in_review', 'revision_requested', 'done');

create table briefs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  pillar_id uuid references content_pillars(id) on delete set null,
  angle text not null,
  research_refs uuid[] not null default '{}',
  voice_notes text,
  publish_at timestamptz,
  status brief_status not null default 'pending',
  revision_count integer not null default 0,
  revision_notes text,
  assigned_agent_id uuid references agents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_briefs_org on briefs (organization_id);
create index idx_briefs_pillar on briefs (pillar_id);
create index idx_briefs_status on briefs (organization_id, status);
create index idx_briefs_agent on briefs (assigned_agent_id);

-- updated_at trigger
create trigger briefs_updated_at
  before update on briefs
  for each row execute function update_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY — org-scoped
-- =============================================================================

alter table briefs enable row level security;

create policy "Users can view org briefs"
  on briefs for select
  using (organization_id = public.user_organization_id());

create policy "Users can create briefs in their org"
  on briefs for insert
  with check (organization_id = public.user_organization_id());

create policy "Users can update org briefs"
  on briefs for update
  using (organization_id = public.user_organization_id());

create policy "Users can delete org briefs"
  on briefs for delete
  using (organization_id = public.user_organization_id());
