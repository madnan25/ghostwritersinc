-- Agent activity log: append-only audit trail for agent domain actions
-- Ref: LIN-150 Plan (Rev 4) — Section A6

CREATE TABLE agent_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  action_type text NOT NULL
    CHECK (action_type IN (
      'draft_created',
      'draft_updated',
      'review_submitted',
      'status_changed',
      'comment_added'
    )),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- No updated_at trigger — this is an append-only audit log.

-- Indices for common query patterns
CREATE INDEX idx_agent_activity_log_org ON agent_activity_log(organization_id);
CREATE INDEX idx_agent_activity_log_agent ON agent_activity_log(agent_id);
CREATE INDEX idx_agent_activity_log_post ON agent_activity_log(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_agent_activity_log_created ON agent_activity_log(created_at DESC);

-- RLS: service-role access only (app-layer authorization)
ALTER TABLE agent_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on agent_activity_log"
  ON agent_activity_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable realtime for dashboard subscriptions (LIN-159)
ALTER PUBLICATION supabase_realtime ADD TABLE agent_activity_log;
