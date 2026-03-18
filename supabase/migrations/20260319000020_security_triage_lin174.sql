-- LIN-174: Security triage fixes from Sentinel Track B review (LIN-173)
--
-- MEDIUM: Add partial unique constraint to prevent TOCTOU race on
-- concurrent provision requests with the same provider_agent_ref.
-- The application-level idempotency check is necessary but not sufficient
-- without a DB-level guarantee.

create unique index if not exists idx_agents_org_provider_ref
  on public.agents (organization_id, provider, provider_agent_ref)
  where provider_agent_ref is not null;
