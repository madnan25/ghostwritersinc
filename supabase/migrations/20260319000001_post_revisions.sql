-- Post revision tracking: snapshot previous content before overwrites
-- so edited posts maintain visible version history.

create table post_revisions (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references posts(id) on delete cascade,
  version_number int not null,
  content       text not null,
  revised_by_agent text not null,         -- agent name that triggered the revision
  revision_reason text,                   -- e.g. "Revised per user feedback: tighten the opening hook"
  created_at    timestamptz not null default now()
);

-- Fast lookup by post, ordered by version
create index idx_post_revisions_post_id on post_revisions(post_id, version_number desc);

-- RLS (table uses admin client, but keep policy consistent with other tables)
alter table post_revisions enable row level security;
