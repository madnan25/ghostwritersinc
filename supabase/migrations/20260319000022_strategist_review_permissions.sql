-- Grant reviews:read and reviews:write to all strategist-type agents
-- so they can participate in the draft review workflow.
insert into public.agent_permissions (agent_id, permission)
select a.id, p.permission
from public.agents a
cross join (values ('reviews:read'), ('reviews:write')) as p(permission)
where a.agent_type = 'strategist'
  and a.status = 'active'
on conflict (agent_id, permission) do nothing;
