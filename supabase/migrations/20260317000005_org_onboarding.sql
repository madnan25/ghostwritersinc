-- Phase 3: Org onboarding fields + auto-provision trigger
-- Adds onboarding columns to organizations and a trigger to provision
-- default pillars when onboarding completes.

-- =============================================================================
-- ORG SCHEMA ENRICHMENT
-- =============================================================================

alter table organizations
  add column if not exists onboarded_at timestamptz,
  add column if not exists linkedin_profile_url text,
  add column if not exists content_goals text;

-- =============================================================================
-- AUTO-PROVISION DEFAULT PILLARS ON ONBOARDING
-- =============================================================================

create or replace function provision_default_pillars()
returns trigger as $$
begin
  -- Only fire when onboarded_at transitions from NULL to a value
  if old.onboarded_at is null and new.onboarded_at is not null then
    insert into content_pillars (organization_id, name, slug, color, weight_pct, description) values
      (new.id, 'Thought Leadership', 'thought-leadership', '#3B82F6', 40, 'Share expertise, frameworks, and insights that establish authority in your domain.'),
      (new.id, 'Industry Insights', 'industry-insights', '#10B981', 30, 'Commentary on trends, news, and shifts relevant to your audience.'),
      (new.id, 'Personal Brand', 'personal-brand', '#F59E0B', 30, 'Stories, lessons, and behind-the-scenes content that builds connection and trust.');
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger org_onboarded_provision_pillars
  after update on organizations
  for each row execute function provision_default_pillars();
