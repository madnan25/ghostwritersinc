-- Follow-up backfill: match posts.agent_id using (user_id, slug, organization_id).
-- The prior migration (000016) only backfilled where (slug, organization_id) was unique,
-- missing orgs where multiple users share the same preset agent slug.
-- This migration resolves those by also joining on posts.user_id = agents.user_id.
-- Ref: Cursor review finding on LIN-150.

update public.posts p
set agent_id = a.id
from public.agents a
where p.created_by_agent = a.slug
  and p.organization_id = a.organization_id
  and p.user_id = a.user_id
  and p.agent_id is null;
