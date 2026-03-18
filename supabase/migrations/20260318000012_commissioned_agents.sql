-- Commissioned agent platform
-- First-class agents, explicit permission grants, strategy documents,
-- and agent/audit columns for existing content surfaces.

alter table public.organizations
  add column if not exists context_sharing_enabled boolean not null default false;

alter table public.agent_keys
  add column if not exists user_id uuid references public.users(id) on delete cascade,
  add column if not exists allow_shared_context boolean not null default false,
  add column if not exists commissioned_by uuid references public.users(id) on delete set null;

update public.agent_keys ak
set
  user_id = (
    select users.id
    from public.users
    where users.organization_id = ak.organization_id
    order by users.is_platform_admin desc, users.created_at asc
    limit 1
  ),
  commissioned_by = coalesce(
    ak.commissioned_by,
    (
      select users.id
      from public.users
      where users.organization_id = ak.organization_id
      order by users.is_platform_admin desc, users.created_at asc
      limit 1
    )
  )
where ak.user_id is null;

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  slug text not null,
  provider text not null default 'ghostwriters',
  provider_agent_ref text,
  agent_type text not null,
  status text not null default 'active',
  allow_shared_context boolean not null default false,
  commissioned_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  last_used_by_route text,
  revoked_at timestamptz,
  revoked_by uuid references public.users(id) on delete set null,
  constraint agents_status_check check (status in ('active', 'inactive', 'revoked')),
  constraint agents_org_user_unique_slug unique (organization_id, user_id, slug)
);

create index if not exists idx_agents_org_user on public.agents (organization_id, user_id);
create index if not exists idx_agents_status on public.agents (status);

create table if not exists public.agent_permissions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  permission text not null,
  created_at timestamptz not null default now(),
  constraint agent_permissions_unique unique (agent_id, permission)
);

create index if not exists idx_agent_permissions_agent on public.agent_permissions (agent_id);
create index if not exists idx_agent_permissions_permission on public.agent_permissions (permission);

alter table public.agent_keys
  add column if not exists agent_id uuid references public.agents(id) on delete cascade;

create index if not exists idx_agent_keys_agent_id on public.agent_keys (agent_id);
drop index if exists idx_agent_keys_org_agent;
drop index if exists idx_agent_keys_org_user_agent;
create index if not exists idx_agent_keys_org_user_agent
  on public.agent_keys (organization_id, user_id, agent_name);

create table if not exists public.strategy_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  title text not null,
  body text not null default '',
  summary text,
  pillar_id uuid references public.content_pillars(id) on delete set null,
  created_by_agent_id uuid references public.agents(id) on delete set null,
  updated_by_agent_id uuid references public.agents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_strategy_documents_org on public.strategy_documents (organization_id, created_at desc);
create index if not exists idx_strategy_documents_user on public.strategy_documents (user_id, created_at desc);
create index if not exists idx_strategy_documents_pillar on public.strategy_documents (pillar_id);

alter table public.research_uploads
  add column if not exists agent_id uuid references public.agents(id) on delete set null,
  add column if not exists title text,
  add column if not exists summary text,
  add column if not exists source_kind text not null default 'upload',
  add column if not exists last_accessed_at timestamptz;

alter table public.review_events
  add column if not exists agent_id uuid references public.agents(id) on delete set null;

alter table public.post_comments
  add column if not exists agent_id uuid references public.agents(id) on delete set null;

create or replace function public.update_agent_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists agents_updated_at on public.agents;
create trigger agents_updated_at
  before update on public.agents
  for each row execute function public.update_agent_updated_at();

drop trigger if exists strategy_documents_updated_at on public.strategy_documents;
create trigger strategy_documents_updated_at
  before update on public.strategy_documents
  for each row execute function public.update_updated_at();

alter table public.agents enable row level security;
alter table public.agent_permissions enable row level security;
alter table public.strategy_documents enable row level security;

drop policy if exists "Platform admins can view agents" on public.agents;
create policy "Platform admins can view agents"
  on public.agents for select
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.is_platform_admin = true
    )
  );

drop policy if exists "Platform admins can manage agents" on public.agents;
create policy "Platform admins can manage agents"
  on public.agents for all
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.is_platform_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.is_platform_admin = true
    )
  );

drop policy if exists "Platform admins can view agent permissions" on public.agent_permissions;
create policy "Platform admins can view agent permissions"
  on public.agent_permissions for select
  using (
    exists (
      select 1
      from public.agents
      join public.users on users.id = auth.uid()
      where agents.id = public.agent_permissions.agent_id
        and users.is_platform_admin = true
    )
  );

drop policy if exists "Platform admins can manage agent permissions" on public.agent_permissions;
create policy "Platform admins can manage agent permissions"
  on public.agent_permissions for all
  using (
    exists (
      select 1
      from public.agents
      join public.users on users.id = auth.uid()
      where agents.id = public.agent_permissions.agent_id
        and users.is_platform_admin = true
    )
  )
  with check (
    exists (
      select 1
      from public.agents
      join public.users on users.id = auth.uid()
      where agents.id = public.agent_permissions.agent_id
        and users.is_platform_admin = true
    )
  );

drop policy if exists "Users can view strategy documents in their org" on public.strategy_documents;
create policy "Users can view strategy documents in their org"
  on public.strategy_documents for select
  using (
    exists (
      select 1
      from public.users
      where users.id = auth.uid()
        and users.organization_id = public.strategy_documents.organization_id
    )
  );

drop policy if exists "Users can manage strategy documents in their org" on public.strategy_documents;
create policy "Users can manage strategy documents in their org"
  on public.strategy_documents for all
  using (
    exists (
      select 1
      from public.users
      where users.id = auth.uid()
        and users.organization_id = public.strategy_documents.organization_id
    )
  )
  with check (
    exists (
      select 1
      from public.users
      where users.id = auth.uid()
        and users.organization_id = public.strategy_documents.organization_id
    )
  );

-- Backfill: create commissioned agents for existing agent keys.
with inserted_agents as (
  insert into public.agents (
    organization_id,
    user_id,
    name,
    slug,
    provider,
    agent_type,
    status,
    allow_shared_context,
    commissioned_by,
    created_at,
    updated_at
  )
  select
    ak.organization_id,
    ak.user_id,
    initcap(ak.agent_name),
    lower(regexp_replace(ak.agent_name, '[^a-zA-Z0-9]+', '-', 'g')),
    'ghostwriters',
    ak.agent_name,
    'active',
    coalesce(ak.allow_shared_context, false),
    ak.commissioned_by,
    ak.created_at,
    ak.created_at
  from public.agent_keys ak
  where ak.user_id is not null
    and not exists (
      select 1
      from public.agents agents
      where agents.organization_id = ak.organization_id
        and agents.user_id = ak.user_id
        and agents.agent_type = ak.agent_name
    )
  returning id, organization_id, user_id, agent_type
)
update public.agent_keys ak
set agent_id = agents.id
from public.agents agents
where ak.agent_id is null
  and ak.user_id is not null
  and agents.organization_id = ak.organization_id
  and agents.user_id = ak.user_id
  and agents.agent_type = ak.agent_name;

insert into public.agent_permissions (agent_id, permission)
select distinct
  ak.agent_id,
  permission_value.permission
from public.agent_keys ak
cross join lateral unnest(coalesce(ak.permissions, '{}')) as permission_value(permission)
where ak.agent_id is not null
on conflict (agent_id, permission) do nothing;

update public.review_events re
set agent_id = ak.agent_id
from public.agent_keys ak
where re.agent_id is null
  and ak.agent_id is not null
  and lower(re.agent_name) = lower(ak.agent_name);
