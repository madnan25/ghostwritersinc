-- Add agent_id FK to posts table for proper agent attribution.
-- Keep created_by_agent as denormalized display string.
-- Ref: LIN-150 Plan (Rev 4) — Section A4.

alter table public.posts
  add column if not exists agent_id uuid references public.agents(id) on delete set null;

-- Backfill: match posts.created_by_agent against agents.name within the same org.
-- Only populate where a unique match exists to avoid ambiguity.
update public.posts p
set agent_id = a.id
from (
  select a.id, a.name, a.organization_id
  from public.agents a
  inner join (
    select name, organization_id
    from public.agents
    group by name, organization_id
    having count(*) = 1
  ) uniq on uniq.name = a.name and uniq.organization_id = a.organization_id
) a
where p.created_by_agent = a.name
  and p.organization_id = a.organization_id
  and p.agent_id is null;

-- Index for querying posts by agent.
create index if not exists idx_posts_agent_id on public.posts(agent_id) where agent_id is not null;
