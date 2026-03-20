-- Add briefs:read and briefs:write permissions to all strategist agents (LIN-416)
--
-- The briefs table was created in 20260319000030_briefs.sql but the agent permission
-- scaffolding was never completed. briefs:read/write were added to agent-auth.ts's
-- CAPABILITY_TO_PERMISSIONS but omitted from AGENT_PERMISSION_GROUPS and the strategist
-- preset — so existing strategist agents could not access /api/briefs at all.

insert into agent_permissions (agent_id, permission)
select a.id, p.permission
from agents a
cross join (values ('briefs:read'), ('briefs:write')) as p(permission)
where a.agent_type = 'strategist'
  and a.status = 'active'
on conflict (agent_id, permission) do nothing;

-- Also sync the denormalized permissions array on agent_keys for strategist agents
update agent_keys ak
set permissions = (
  select array_agg(ap.permission order by ap.permission)
  from agent_permissions ap
  where ap.agent_id = ak.agent_id
)
from agents a
where ak.agent_id = a.id
  and a.agent_type = 'strategist'
  and a.status = 'active';
