-- Add wildcard_count to strategy_config
-- Wildcard posts are briefs with no pillar assigned (pillar_id = null),
-- scheduled on evenly-spaced empty days within the month.

ALTER TABLE strategy_config
  ADD COLUMN IF NOT EXISTS wildcard_count integer NOT NULL DEFAULT 0
  CONSTRAINT wildcard_count_range CHECK (wildcard_count >= 0 AND wildcard_count <= 50);
