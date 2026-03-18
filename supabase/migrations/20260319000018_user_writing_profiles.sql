-- User writing profiles: per-user writing style preferences scoped to org
-- Ref: LIN-150 Plan (Rev 4) — Section A7

CREATE TABLE user_writing_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tone text,
  voice_notes text,
  sample_post_ids uuid[] DEFAULT '{}',
  avoid_topics text[] DEFAULT '{}',
  preferred_formats text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_writing_profiles_user_org_unique UNIQUE (user_id, organization_id)
);

CREATE INDEX idx_user_writing_profiles_org ON user_writing_profiles(organization_id);

-- Reuse existing trigger function
CREATE TRIGGER user_writing_profiles_updated_at
  BEFORE UPDATE ON user_writing_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: enabled with no permissive policies for anon/authenticated roles.
-- Service-role bypasses RLS unconditionally; all writes go through
-- the app-layer API which uses the service-role client.
ALTER TABLE user_writing_profiles ENABLE ROW LEVEL SECURITY;
