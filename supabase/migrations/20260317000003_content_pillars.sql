-- Content Pillars — first-class pillar entity + posts FK (LIN-85)

-- =============================================================================
-- NEW TABLE: content_pillars
-- =============================================================================

create table content_pillars (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  color text not null,
  weight_pct integer not null default 0,
  audience_summary text,
  example_hooks text[] not null default '{}',
  sort_order integer not null default 0,
  brief_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table content_pillars
  add constraint content_pillars_org_slug_unique unique (organization_id, slug);

create index idx_content_pillars_organization on content_pillars (organization_id);

-- updated_at trigger (reuse existing function)
create trigger content_pillars_updated_at
  before update on content_pillars
  for each row execute function update_updated_at();

-- =============================================================================
-- POSTS: add pillar_id FK + rotation health index
-- =============================================================================

-- DEPRECATED: posts.pillar (text) — kept for backward compat, use pillar_id going forward
comment on column posts.pillar is 'DEPRECATED — use pillar_id FK to content_pillars instead';

alter table posts
  add column pillar_id uuid references content_pillars(id) on delete set null;

create index idx_posts_pillar_id on posts (pillar_id);
create index idx_posts_org_suggested_publish on posts (organization_id, suggested_publish_at);

-- =============================================================================
-- ROW LEVEL SECURITY for content_pillars
-- =============================================================================

alter table content_pillars enable row level security;

create policy "Users can view org pillars"
  on content_pillars for select
  using (organization_id = public.user_organization_id());

create policy "Users can create pillars in their org"
  on content_pillars for insert
  with check (organization_id = public.user_organization_id());

create policy "Users can update org pillars"
  on content_pillars for update
  using (organization_id = public.user_organization_id());

create policy "Users can delete org pillars"
  on content_pillars for delete
  using (organization_id = public.user_organization_id());

-- =============================================================================
-- SEED DATA: 5 pillars from client brief (mohammad-dayem-adnan.md)
-- =============================================================================
-- Uses a CTE to grab the first org id for seeding (single-tenant for now).

with org as (
  select id from organizations limit 1
)
insert into content_pillars (organization_id, name, slug, description, color, weight_pct, audience_summary, example_hooks, sort_order, brief_ref)
select
  org.id,
  v.name, v.slug, v.description, v.color, v.weight_pct, v.audience_summary, v.example_hooks, v.sort_order, v.brief_ref
from org, (values
  (
    'AI Agents & Automation',
    'ai-agents-automation',
    'Demystify agentic AI for non-technical buyers. Real use cases, real ROI, real implementation paths. Lead pillar — highest market demand and strongest growth vector.',
    '#3b82f6',
    35,
    'Sarah, the Scaling SMB Owner — runs a B2B services company with 12 employees and $3M in revenue. Profitable but drowning in manual work. On LinkedIn every morning before her first meeting.',
    ARRAY[
      'AI agents replaced 40 hours/week of manual work for one of our clients. Here''s the exact setup.',
      'Stop asking ''should we use AI?'' Start asking ''which 3 workflows should we automate first?''',
      'Most companies are using AI wrong. They''re automating the easy stuff instead of the expensive stuff.',
      'Your VA costs $2K/mo. This AI agent costs $200. Here''s the comparison.',
      'You don''t need an AI team. You need 3 automations. Here''s where to start.'
    ],
    0,
    'briefs/mohammad-dayem-adnan.md#pillar-1'
  ),
  (
    'Custom Software',
    'custom-software',
    'Position NettaWorks as the anti-agency. Tactical content about team composition, delivery management, build vs. buy decisions. From almost 2 years running delivery.',
    '#10b981',
    20,
    'James, the Non-Technical Founder — fintech founder, 34, Austin. Series A closed, needs to rebuild backend and ship 3 major features by Q3. Burned by agencies before.',
    ARRAY[
      'You don''t need 10 engineers. You need the right 3. Here''s how to tell the difference.',
      'I ran delivery for almost 2 years. Here are the 5 red flags that predict a project will fail.',
      'The #1 reason startups get burned by dev agencies (and the question that prevents it).',
      'We put together teams that deliver expected outcomes. Here''s what ''expected'' actually means.'
    ],
    1,
    'briefs/mohammad-dayem-adnan.md#pillar-2'
  ),
  (
    'Advertising',
    'advertising',
    'Mohammad''s killer differentiator. $100M+ pipeline, cost-per-everything obsession, CMO experience at The Vertical. Advertising where every dollar is tracked to an outcome.',
    '#f59e0b',
    20,
    'Raj, the Founder Who''s Tried Everything — B2B SaaS, $4M ARR, Dubai. Spent $200K on marketing across 3 agencies. Can''t tell you cost per qualified lead for any of them.',
    ARRAY[
      '$100M+ in qualified pipeline. Every dollar had an owner. Here''s the system.',
      'Cost per sqft sold. Cost per deal won. Cost per qualified lead. If you can''t name yours, your marketing is broken.',
      '3.8x lead qualification rate. 26 deals closed. Here''s what we did differently.',
      'Forget brand awareness. Here''s how to build a pipeline where every dollar is accountable.'
    ],
    2,
    'briefs/mohammad-dayem-adnan.md#pillar-3'
  ),
  (
    'Building Across Borders',
    'building-across-borders',
    'Mohammad is now Managing Director for Asia & Middle East. Operating across cultures, building global delivery teams, expanding into new markets.',
    '#8b5cf6',
    15,
    'Global operators — agency owners and founders working across US, Europe, and Middle East who need partners that understand cross-border delivery.',
    ARRAY[
      'I just moved from Head of Delivery in the US to Managing Director for Asia & the Middle East. Here''s what changes (and what doesn''t).',
      'Building a team that delivers across 3 continents. The scheduling system that makes it work.',
      'The best talent I''ve found wasn''t where I expected. Here''s where agencies should be looking.',
      'Expanding into the Middle East as an agency. The 3 things nobody told me.'
    ],
    3,
    'briefs/mohammad-dayem-adnan.md#pillar-4'
  ),
  (
    'Operators Playbook',
    'operators-playbook',
    'Personal journey content. From Trek10 product manager to NettaWorks Managing Director. Customer discovery, product thinking, design research applied to running a business. Trust-builder.',
    '#ef4444',
    10,
    'Aspiring operators and founders who respect people that build. People who want to learn from someone in the trenches, not from motivational speakers.',
    ARRAY[
      'I conducted 45+ customer discovery interviews at Trek10. The #1 thing I learned about what customers actually want.',
      'From product manager to Head of Delivery to Managing Director. The skill that transferred to every role.',
      'Every week I document what I build, break down what works, and share what I learn. Here''s this week''s breakdown.',
      'Design thinking isn''t just for products. Here''s how I use it to run delivery.'
    ],
    4,
    'briefs/mohammad-dayem-adnan.md#pillar-5'
  )
) as v(name, slug, description, color, weight_pct, audience_summary, example_hooks, sort_order, brief_ref);

-- =============================================================================
-- BACKFILL: map existing posts.pillar text → pillar_id
-- =============================================================================
-- Mapping:
--   thought-leadership → ai-agents-automation (closest match to lead-with-authority content)
--   personal-story     → operators-playbook
--   industry-insight   → advertising (accountability / industry analysis)
--   how-to             → custom-software (tactical how-to content)
--   case-study         → ai-agents-automation (case studies are primary pillar proof points)

update posts
set pillar_id = cp.id
from content_pillars cp
where posts.organization_id = cp.organization_id
  and (
    (posts.pillar = 'thought-leadership' and cp.slug = 'ai-agents-automation')
    or (posts.pillar = 'personal-story' and cp.slug = 'operators-playbook')
    or (posts.pillar = 'industry-insight' and cp.slug = 'advertising')
    or (posts.pillar = 'how-to' and cp.slug = 'custom-software')
    or (posts.pillar = 'case-study' and cp.slug = 'ai-agents-automation')
  );
