-- LIN-469: Add UPDATE RLS policy on post_revisions for targeted revision apply route.
--
-- The apply route (POST /api/drafts/:id/targeted-revision/apply) updates
-- diff_sections and revised_by_agent on targeted revision rows after Scribe
-- has generated replacement text. Migration 007 comment incorrectly stated
-- existing policies cover the apply route — only SELECT and INSERT policies
-- existed. The admin client bypasses RLS today, so this is not actively
-- breaking, but the gap must be closed before the feature ships.
--
-- Policy mirrors the org-scoped SELECT and INSERT policies: an authenticated
-- user (or agent acting on behalf of a user) can UPDATE a revision row if
-- the parent post belongs to their organization.

create policy "Users can update post revisions"
  on post_revisions for update
  using (
    exists (
      select 1 from posts
      where posts.id = post_revisions.post_id
        and posts.organization_id = auth.user_organization_id()
    )
  )
  with check (
    exists (
      select 1 from posts
      where posts.id = post_revisions.post_id
        and posts.organization_id = auth.user_organization_id()
    )
  );
