-- Security fixes for strategist memory tables (LIN-566 triage)
-- Addresses Sentinel findings: DB-level length constraints on fact/notes columns

-- Add CHECK constraints on text column lengths
ALTER TABLE strategist_memories
  ADD CONSTRAINT strategist_memories_fact_length
  CHECK (char_length(fact) <= 10000);

ALTER TABLE strategist_session_notes
  ADD CONSTRAINT strategist_session_notes_notes_length
  CHECK (char_length(notes) <= 50000);
