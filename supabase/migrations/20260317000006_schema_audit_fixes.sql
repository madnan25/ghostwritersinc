-- Schema audit fixes (LIN-125)
-- Fix RLS function references, add missing indexes, clean up redundant policy

-- =============================================================================
-- FIX: Create public.user_organization_id() wrapper
-- =============================================================================
-- The original function lives in auth schema (auth.user_organization_id()),
-- but research_uploads and content_pillars RLS policies reference it as
-- user_organization_id() or public.user_organization_id(). This wrapper
-- ensures those policies resolve correctly.

create or replace function public.user_organization_id()
returns uuid as $$
  select organization_id from public.users where id = auth.uid()
$$ language sql security definer stable;

-- =============================================================================
-- FIX: Add missing index on research_uploads.organization_id
-- =============================================================================
-- RLS policies filter by organization_id on every query — needs an index.

create index if not exists idx_research_uploads_organization
  on research_uploads (organization_id);

-- =============================================================================
-- CLEANUP: Drop redundant SELECT policy on agent_keys
-- =============================================================================
-- "Admins can manage agent keys" uses FOR ALL which already covers SELECT.
-- The separate "Admins can view agent keys" SELECT policy is redundant.

drop policy if exists "Admins can view agent keys" on agent_keys;
