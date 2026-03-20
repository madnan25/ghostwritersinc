-- LIN-452: Extend post_revisions to support structured targeted revision payloads.
--
-- Changes:
--   1. Add `revision_type` enum ('full' | 'targeted')
--   2. Add `revision_type` column to post_revisions (default 'full' for existing rows)
--   3. Add `flagged_sections` jsonb — [{ start_char, end_char, note }]
--   4. Add `diff_sections` jsonb — [{ start_char, end_char, before_text, after_text }]
--   5. Make `version` nullable — targeted revisions don't represent a full content version
--   6. Replace unique constraint with a partial unique index scoped to full revisions
--
-- RLS: existing policies on post_revisions cover all new columns (row-level, no change needed).

-- =============================================================================
-- 1. Revision type enum
-- =============================================================================
do $$ begin
  create type revision_type as enum ('full', 'targeted');
exception when duplicate_object then null;
end $$;

-- =============================================================================
-- 2. New columns on post_revisions
-- =============================================================================
alter table post_revisions
  add column if not exists revision_type revision_type not null default 'full',
  add column if not exists flagged_sections jsonb,
  add column if not exists diff_sections jsonb;

-- =============================================================================
-- 3. Allow version to be NULL for targeted revision records
-- =============================================================================
alter table post_revisions
  alter column version drop not null;

-- =============================================================================
-- 4. Replace the blanket unique constraint with a partial index (full revisions only)
--    Targeted revisions (version IS NULL) are exempt from the uniqueness check.
-- =============================================================================
-- Try both possible constraint names (explicit vs auto-generated)
do $$
begin
  alter table post_revisions drop constraint if exists uq_post_revisions_post_version;
  alter table post_revisions drop constraint if exists post_revisions_post_id_version_key;
exception when undefined_object then
  null;
end;
$$;

create unique index if not exists uq_post_revisions_full_version
  on post_revisions (post_id, version)
  where version is not null;

-- =============================================================================
-- 5. Index: targeted revisions per post (for rate-limit count queries)
-- =============================================================================
create index if not exists idx_post_revisions_targeted
  on post_revisions (post_id, revision_type)
  where revision_type = 'targeted';

comment on column post_revisions.revision_type is 'full = whole-content snapshot; targeted = partial inline revision request';
comment on column post_revisions.flagged_sections is 'Array of { start_char, end_char, note } objects for targeted revisions';
comment on column post_revisions.diff_sections is 'Array of { start_char, end_char, before_text, after_text } for targeted revisions; after_text filled by Scribe after applying changes';
