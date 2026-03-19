-- Backfill agent_keys.agent_name from agents.name for all keys that have an agent_id.
-- Previously, agent_name was incorrectly set to agent_type (e.g. "scribe") instead of
-- the display name (e.g. "Scribe"). This one-time migration corrects existing data.

UPDATE agent_keys ak
SET agent_name = a.name
FROM agents a
WHERE ak.agent_id = a.id
  AND ak.agent_name IS DISTINCT FROM a.name;
