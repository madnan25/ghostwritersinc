-- Create post_revisions table for version history
CREATE TABLE post_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  version integer NOT NULL,
  content text NOT NULL,
  revised_by_agent text,
  revised_by_user text,
  revision_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by post
CREATE INDEX idx_post_revisions_post_id ON post_revisions(post_id);

-- Unique constraint: one version number per post
CREATE UNIQUE INDEX idx_post_revisions_post_version ON post_revisions(post_id, version);

-- RLS
ALTER TABLE post_revisions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read revisions for posts in their org
CREATE POLICY "Users can view revisions for their org posts"
  ON post_revisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      JOIN users u ON u.organization_id = p.organization_id
      WHERE p.id = post_revisions.post_id
        AND u.id = auth.uid()
    )
  );

-- Allow authenticated users to insert revisions for posts in their org
CREATE POLICY "Users can insert revisions for their org posts"
  ON post_revisions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts p
      JOIN users u ON u.organization_id = p.organization_id
      WHERE p.id = post_revisions.post_id
        AND u.id = auth.uid()
    )
  );

-- Allow authenticated users to delete revisions for posts in their org (needed for post deletion)
CREATE POLICY "Users can delete revisions for their org posts"
  ON post_revisions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      JOIN users u ON u.organization_id = p.organization_id
      WHERE p.id = post_revisions.post_id
        AND u.id = auth.uid()
    )
  );

-- Atomic version insertion function — avoids race conditions on concurrent writes
CREATE OR REPLACE FUNCTION insert_post_revision(
  p_post_id uuid,
  p_content text,
  p_revised_by_agent text DEFAULT NULL,
  p_revised_by_user text DEFAULT NULL,
  p_revision_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO post_revisions (post_id, version, content, revised_by_agent, revised_by_user, revision_reason)
  VALUES (
    p_post_id,
    COALESCE((SELECT MAX(version) FROM post_revisions WHERE post_id = p_post_id), 0) + 1,
    p_content,
    p_revised_by_agent,
    p_revised_by_user,
    p_revision_reason
  );
END;
$$;

-- Service role bypasses RLS, so agent-driven inserts work via admin client
