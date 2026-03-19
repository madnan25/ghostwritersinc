-- LinkedIn OAuth token storage (encrypted at-rest)
-- Tokens are encrypted before insert via application-level encryption.
-- This table stores the encrypted blobs; the encryption key lives in env vars.

CREATE TABLE linkedin_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Encrypted token data (JSON blob encrypted with AES-256-GCM)
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT,
  -- Token metadata (not sensitive — stored in plaintext for query/scheduling)
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  linkedin_member_id TEXT,
  -- Connection state
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disconnected_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One active connection per user per org
  UNIQUE (user_id, organization_id)
);

-- RLS: user-scoped
ALTER TABLE linkedin_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linkedin_tokens_select_own"
  ON linkedin_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "linkedin_tokens_insert_own"
  ON linkedin_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "linkedin_tokens_update_own"
  ON linkedin_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "linkedin_tokens_delete_own"
  ON linkedin_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Index for token refresh scheduling
CREATE INDEX idx_linkedin_tokens_expires ON linkedin_tokens (expires_at)
  WHERE disconnected_at IS NULL;
