-- Strategist memory tables for learning/recall system
-- Scoped to (user_id, organization_id) matching user_writing_profiles pattern

-- =============================================================
-- 1. strategist_memories
-- =============================================================
CREATE TABLE strategist_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('preference', 'episode', 'pattern', 'tacit')),
  entity text,
  fact text NOT NULL,
  source_type text CHECK (source_type IN ('comment', 'observation', 'brief', 'manual')),
  source_id uuid,
  confidence float NOT NULL DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_strategist_memories_user_org
  ON strategist_memories(user_id, organization_id);

CREATE INDEX idx_strategist_memories_user_org_type
  ON strategist_memories(user_id, organization_id, type);

CREATE TRIGGER strategist_memories_updated_at
  BEFORE UPDATE ON strategist_memories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE strategist_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own strategist memories"
  ON strategist_memories FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own strategist memories"
  ON strategist_memories FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own strategist memories"
  ON strategist_memories FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own strategist memories"
  ON strategist_memories FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================
-- 2. strategist_session_notes
-- =============================================================
CREATE TABLE strategist_session_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_strategist_session_notes_user_org
  ON strategist_session_notes(user_id, organization_id);

ALTER TABLE strategist_session_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own session notes"
  ON strategist_session_notes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own session notes"
  ON strategist_session_notes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own session notes"
  ON strategist_session_notes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own session notes"
  ON strategist_session_notes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================
-- 3. strategist_contextual_prefs
-- =============================================================
CREATE TABLE strategist_contextual_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  context_key text NOT NULL,
  preference_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT strategist_contextual_prefs_user_org_key UNIQUE (user_id, organization_id, context_key)
);

CREATE INDEX idx_strategist_contextual_prefs_user_org
  ON strategist_contextual_prefs(user_id, organization_id);

CREATE TRIGGER strategist_contextual_prefs_updated_at
  BEFORE UPDATE ON strategist_contextual_prefs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE strategist_contextual_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contextual prefs"
  ON strategist_contextual_prefs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own contextual prefs"
  ON strategist_contextual_prefs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own contextual prefs"
  ON strategist_contextual_prefs FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own contextual prefs"
  ON strategist_contextual_prefs FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
