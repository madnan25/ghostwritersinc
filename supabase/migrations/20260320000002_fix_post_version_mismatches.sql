-- Repair posts whose canonical version counter/status lag behind newer revisions.
-- Older draft update flows could create a higher post_revisions.version without
-- promoting the post row to that version or clearing stale review state.

with latest_revision as (
  select post_id, max(version) as max_version
  from public.post_revisions
  group by post_id
)
update public.posts as p
set
  content_version = latest_revision.max_version,
  status = case
    when p.status in ('approved', 'rejected') then 'pending_review'
    else p.status
  end,
  reviewed_by_agent = case
    when p.status in ('pending_review', 'approved', 'rejected', 'revision') then null
    else p.reviewed_by_agent
  end,
  review_notes = case
    when p.status in ('pending_review', 'approved', 'rejected', 'revision') then null
    else p.review_notes
  end,
  rejection_reason = case
    when p.status = 'rejected' then null
    else p.rejection_reason
  end,
  updated_at = now()
from latest_revision
where p.id = latest_revision.post_id
  and latest_revision.max_version > p.content_version;
