-- Content versioning infrastructure (LIN-261)
-- Adds post_revisions table and content_version columns to posts & post_comments.

-- 1. Add content_version to posts (default 1 for existing rows)
alter table posts
  add column content_version integer not null default 1;

-- 2. Add content_version to post_comments (nullable — null = legacy comment)
alter table post_comments
  add column content_version integer;

-- 3. Create post_revisions table
create table post_revisions (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references posts(id) on delete cascade,
  version integer not null,
  content text not null,
  created_at timestamptz not null default now(),
  constraint uq_post_revisions_post_version unique (post_id, version)
);

create index idx_post_revisions_post on post_revisions (post_id);

-- 4. RLS — org-scoped via posts FK (same pattern as post_comments)
alter table post_revisions enable row level security;

create policy "Users can view post revisions"
  on post_revisions for select
  using (
    exists (
      select 1 from posts
      where posts.id = post_revisions.post_id
        and posts.organization_id = auth.user_organization_id()
    )
  );

create policy "Users can create post revisions"
  on post_revisions for insert
  with check (
    exists (
      select 1 from posts
      where posts.id = post_revisions.post_id
        and posts.organization_id = auth.user_organization_id()
    )
  );

-- 5. Seed revision v1 for every existing post so the table is consistent
insert into post_revisions (post_id, version, content, created_at)
select id, 1, content, created_at
from posts;
