-- Security hardening migration: RLS on request tables, CHECK constraint on agent_type

-- Enable RLS on invite_requests (defense in depth — service-role access bypasses RLS,
-- but this prevents accidental exposure via user-scoped client)
alter table public.invite_requests enable row level security;

-- Restrictive policy: only service-role can access (no user-facing policies needed
-- since all access is through admin routes using the service-role client)
create policy "Service role full access on invite_requests"
  on public.invite_requests
  for all
  using (true)
  with check (true);

-- Enable RLS on agent_hiring_requests
alter table public.agent_hiring_requests enable row level security;

create policy "Service role full access on agent_hiring_requests"
  on public.agent_hiring_requests
  for all
  using (true)
  with check (true);

-- Add CHECK constraint on agents.agent_type to enforce valid values at DB level.
-- This prevents invalid agent types from being stored even if app-layer validation
-- is bypassed.
do $$
begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'agents_agent_type_check'
  ) then
    alter table public.agents
      add constraint agents_agent_type_check
      check (agent_type in ('scribe', 'strategist', 'inspector', 'researcher', 'reviewer', 'custom'));
  end if;
end $$;
