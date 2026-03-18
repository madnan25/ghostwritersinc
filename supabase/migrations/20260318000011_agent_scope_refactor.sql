-- Agent scope refactor
-- - Collapse app usage of owner/admin/member into admin/member
-- - Add org-level context sharing
-- - Bind agent keys to users with optional shared-context access

alter table public.organizations
  add column if not exists context_sharing_enabled boolean not null default false;

alter table public.agent_keys
  add column if not exists user_id uuid references public.users(id) on delete cascade,
  add column if not exists allow_shared_context boolean not null default false,
  add column if not exists commissioned_by uuid references public.users(id) on delete set null;

create index if not exists idx_agent_keys_org_user
  on public.agent_keys (organization_id, user_id);

drop index if exists idx_agent_keys_org_agent;

create unique index if not exists idx_agent_keys_org_user_agent
  on public.agent_keys (organization_id, user_id, agent_name)
  where user_id is not null;

update public.users
set role = 'admin'
where role = 'owner';

update public.user_invitations
set role = 'admin'
where role = 'owner';

drop policy if exists "Org owners can view invitations" on public.user_invitations;
drop policy if exists "Org owners can create invitations" on public.user_invitations;
drop policy if exists "Org owners can delete invitations" on public.user_invitations;

create policy "Org admins can view invitations"
  on public.user_invitations for select
  using (
    organization_id = auth.user_organization_id()
    and exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.organization_id = public.user_invitations.organization_id
        and users.role = 'admin'
    )
  );

create policy "Org admins can create invitations"
  on public.user_invitations for insert
  with check (
    organization_id = auth.user_organization_id()
    and exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.organization_id = public.user_invitations.organization_id
        and users.role = 'admin'
    )
  );

create policy "Org admins can delete invitations"
  on public.user_invitations for delete
  using (
    organization_id = auth.user_organization_id()
    and exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.organization_id = public.user_invitations.organization_id
        and users.role = 'admin'
    )
  );

drop policy if exists "Admins can view agent keys" on public.agent_keys;
drop policy if exists "Admins can manage agent keys" on public.agent_keys;

create policy "Platform admins can view agent keys"
  on public.agent_keys for select
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.is_platform_admin = true
    )
  );

create policy "Platform admins can manage agent keys"
  on public.agent_keys for all
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
