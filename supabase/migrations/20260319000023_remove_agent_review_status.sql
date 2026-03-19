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
alter table posts
  alter column status type post_status using status::text::post_status;

-- 4. Drop the old enum
drop type post_status_old;
