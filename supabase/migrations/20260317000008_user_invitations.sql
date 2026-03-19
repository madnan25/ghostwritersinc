-- Migration: invitation-only signup + user management
-- LIN-130

-- 1. Add is_active flag to users
alter table public.users add column if not exists is_active boolean not null default true;

-- Set all existing users as active
update public.users set is_active = true where is_active = false;

-- 2. Create user_invitations table
create table if not exists public.user_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.user_role not null default 'member',
  invited_by uuid not null references public.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Unique constraint: one pending invite per email per org
create unique index uq_pending_invitation_per_org
  on public.user_invitations (organization_id, email)
  where accepted_at is null;

-- Index for token lookups
create index idx_user_invitations_token on public.user_invitations (token);

-- Index for org lookups
create index idx_user_invitations_org on public.user_invitations (organization_id);

-- 3. RLS policies for user_invitations
alter table public.user_invitations enable row level security;

-- Owners can view invitations in their org
drop policy if exists "Org owners can view invitations" on public.user_invitations;
create policy "Org owners can view invitations"
  on public.user_invitations for select
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.organization_id = public.user_invitations.organization_id
        and users.role = 'owner'
    )
  );

-- Owners can create invitations in their org
drop policy if exists "Org owners can create invitations" on public.user_invitations;
create policy "Org owners can create invitations"
  on public.user_invitations for insert
  with check (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.organization_id = public.user_invitations.organization_id
        and users.role = 'owner'
    )
  );

-- Owners can delete invitations in their org
drop policy if exists "Org owners can delete invitations" on public.user_invitations;
create policy "Org owners can delete invitations"
  on public.user_invitations for delete
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.organization_id = public.user_invitations.organization_id
        and users.role = 'owner'
    )
  );

-- No UPDATE policy needed — callback uses service role (adminClient) to mark accepted_at.
