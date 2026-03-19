-- Add scheduled deletion for rejected posts (LIN-253)
-- Posts rejected by the user are scheduled for deletion after 1 day.
-- Reverting to draft clears the scheduled deletion.

-- 1. Add the column
alter table posts
  add column delete_scheduled_at timestamptz;

-- 2. Index for the cleanup query
create index idx_posts_delete_scheduled
  on posts (delete_scheduled_at)
  where delete_scheduled_at is not null and status = 'rejected';

-- 3. Cleanup function — deletes rejected posts past their scheduled deletion time
create or replace function cleanup_rejected_posts()
returns integer
language plpgsql
security definer
as $$
declare
  deleted_count integer;
begin
  delete from posts
  where delete_scheduled_at < now()
    and status = 'rejected';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- 4. Schedule hourly cleanup via pg_cron (if extension is available)
-- pg_cron may not be available in all environments; wrap in a DO block
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'cleanup-rejected-posts',
      '0 * * * *',
      'select cleanup_rejected_posts()'
    );
  end if;
end;
$$;
