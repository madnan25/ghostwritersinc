-- Migrate existing agent_review posts to pending_review before removing the enum value.
update posts set status = 'pending_review' where status = 'agent_review';

-- Postgres does not support DROP VALUE on an enum, so we recreate the type.
-- 1. Rename existing enum
alter type post_status rename to post_status_old;

-- 2. Create new enum without agent_review
create type post_status as enum (
  'draft',
  'pending_review',
  'approved',
  'scheduled',
  'published',
  'rejected'
);

-- 3. Alter column to use the new enum (cast via text)
-- Drop default and partial index first — both reference the old enum type
alter table posts alter column status drop default;
drop index if exists idx_posts_scheduled;
alter table posts
  alter column status type post_status using status::text::post_status;
alter table posts alter column status set default 'draft'::post_status;
-- Recreate the partial index with the new enum type
create index idx_posts_scheduled on posts (scheduled_publish_at) where status = 'scheduled';

-- 4. Drop the old enum
drop type post_status_old;
