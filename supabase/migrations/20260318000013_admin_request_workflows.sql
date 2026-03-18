-- Org-admin request workflows for invites and hiring preset agent teams.

create table if not exists public.invite_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references public.users(id) on delete cascade,
  requested_email text not null,
  requested_role public.user_role not null default 'member',
  status text not null default 'pending',
  decision_notes text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  fulfilled_invitation_id uuid references public.user_invitations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invite_requests_status_check check (status in ('pending', 'approved', 'denied'))
);

create unique index if not exists idx_invite_requests_pending_org_email
  on public.invite_requests (organization_id, requested_email)
  where status = 'pending';

create index if not exists idx_invite_requests_org_status
  on public.invite_requests (organization_id, status, created_at desc);

create index if not exists idx_invite_requests_requested_by
  on public.invite_requests (requested_by, created_at desc);

drop trigger if exists invite_requests_updated_at on public.invite_requests;
create trigger invite_requests_updated_at
  before update on public.invite_requests
  for each row execute function public.update_updated_at();

create table if not exists public.agent_hiring_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references public.users(id) on delete cascade,
  requested_for_user_id uuid not null references public.users(id) on delete cascade,
  preset_key text not null,
  requested_shared_context boolean not null default false,
  status text not null default 'pending',
  decision_notes text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  fulfilled_agent_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_hiring_requests_status_check check (status in ('pending', 'approved', 'denied'))
);

create index if not exists idx_agent_hiring_requests_org_status
  on public.agent_hiring_requests (organization_id, status, created_at desc);

create index if not exists idx_agent_hiring_requests_requested_by
  on public.agent_hiring_requests (requested_by, created_at desc);

create index if not exists idx_agent_hiring_requests_requested_for_user
  on public.agent_hiring_requests (requested_for_user_id, status, created_at desc);

drop trigger if exists agent_hiring_requests_updated_at on public.agent_hiring_requests;
create trigger agent_hiring_requests_updated_at
  before update on public.agent_hiring_requests
  for each row execute function public.update_updated_at();
