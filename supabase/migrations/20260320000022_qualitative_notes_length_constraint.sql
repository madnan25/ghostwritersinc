-- LIN-494: Add DB-level length constraint for qualitative_notes on post_performance
--
-- The API layer validates max 5000 chars via Zod, but defense-in-depth requires
-- a matching DB-level guard. This migration adds a CHECK constraint to enforce
-- the same limit at the database level.

alter table post_performance
  add constraint qualitative_notes_len
  check (char_length(qualitative_notes) <= 5000);
