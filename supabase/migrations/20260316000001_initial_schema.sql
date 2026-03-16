-- Ghostwriters Inc. — Initial Database Schema
-- Multi-tenant LinkedIn Content Management Platform

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- =============================================================================
-- ENUMS
-- =============================================================================

create type user_role as enum ('owner', 'admin', 'member');
create type content_type as enum ('text', 'image', 'document');
create type post_status as enum (
  'draft',
  'agent_review',
  'pending_review',
  'approved',
  'rejected',
  'scheduled',
  'published'
);
create type comment_author_type as enum ('user', 'agent');
create type review_action as enum ('approved', 'rejected', 'escalated');
create type notification_type as enum (
  'post_submitted',
  'post_approved',
  'post_rejected',
  'post_published',
  'feedback_received',
  'review_requested'
);

-- =============================================================================
-- TABLES
-- =============================================================================

-- Organizations (multi-tenant root)
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create index idx_organizations_slug on organizations (slug);

-- Users
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  linkedin_id text,
  name text not null,
  email text not null,
  avatar_url text,
  timezone text not null default 'UTC',
  settings jsonb not null default '{}',
  role user_role not null default 'member',
  created_at timestamptz not null default now()
);

create index idx_users_organization on users (organization_id);
create index idx_users_email on users (email);
create unique index idx_users_linkedin_id on users (linkedin_id) where linkedin_id is not null;

-- Posts
create table posts (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  content text not null,
  content_type content_type not null default 'text',
  media_urls text[] not null default '{}',
  pillar text,
  brief_ref text,
  suggested_publish_at timestamptz,
  scheduled_publish_at timestamptz,
  published_at timestamptz,
  linkedin_post_urn text,
  status post_status not null default 'draft',
  rejection_reason text,
  created_by_agent text,
  reviewed_by_agent text,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_posts_organization on posts (organization_id);
create index idx_posts_status on posts (organization_id, status);
create index idx_posts_scheduled on posts (scheduled_publish_at) where status = 'scheduled';
create index idx_posts_user on posts (user_id);

-- Post Comments (inline feedback)
create table post_comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references posts(id) on delete cascade,
  author_type comment_author_type not null,
  author_id text not null,
  body text not null,
  selected_text text,
  selection_start int,
  selection_end int,
  created_at timestamptz not null default now()
);

create index idx_post_comments_post on post_comments (post_id);

-- Post Metrics (manual entry)
create table post_metrics (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references posts(id) on delete cascade,
  impressions int not null default 0,
  likes int not null default 0,
  comments int not null default 0,
  shares int not null default 0,
  entered_at timestamptz not null default now(),
  entered_by uuid references users(id) on delete set null
);

create index idx_post_metrics_post on post_metrics (post_id);

-- Review Events (audit trail for approval workflow)
create table review_events (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references posts(id) on delete cascade,
  agent_name text not null,
  action review_action not null,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_review_events_post on review_events (post_id);

-- Agent Keys (API authentication for agents)
create table agent_keys (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  agent_name text not null,
  api_key_hash text not null,
  permissions text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_agent_keys_organization on agent_keys (organization_id);
create unique index idx_agent_keys_org_agent on agent_keys (organization_id, agent_name);

-- Notifications
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  type notification_type not null,
  title text not null,
  body text,
  post_id uuid references posts(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on notifications (user_id, read);
create index idx_notifications_org on notifications (organization_id);

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger posts_updated_at
  before update on posts
  for each row execute function update_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table organizations enable row level security;
alter table users enable row level security;
alter table posts enable row level security;
alter table post_comments enable row level security;
alter table post_metrics enable row level security;
alter table review_events enable row level security;
alter table agent_keys enable row level security;
alter table notifications enable row level security;

-- Helper: get current user's organization_id
create or replace function auth.user_organization_id()
returns uuid as $$
  select organization_id from public.users where id = auth.uid()
$$ language sql security definer stable;

-- Organizations: users can only see their own org
create policy "Users can view their organization"
  on organizations for select
  using (id = auth.user_organization_id());

-- Users: users can only see members of their org
create policy "Users can view org members"
  on users for select
  using (organization_id = auth.user_organization_id());

create policy "Users can update own profile"
  on users for update
  using (id = auth.uid());

-- Posts: org-scoped access
create policy "Users can view org posts"
  on posts for select
  using (organization_id = auth.user_organization_id());

create policy "Users can create posts in their org"
  on posts for insert
  with check (organization_id = auth.user_organization_id());

create policy "Users can update org posts"
  on posts for update
  using (organization_id = auth.user_organization_id());

create policy "Users can delete org posts"
  on posts for delete
  using (organization_id = auth.user_organization_id());

-- Post Comments: accessible via post's org
create policy "Users can view post comments"
  on post_comments for select
  using (
    exists (
      select 1 from posts
      where posts.id = post_comments.post_id
        and posts.organization_id = auth.user_organization_id()
    )
  );

create policy "Users can create post comments"
  on post_comments for insert
  with check (
    exists (
      select 1 from posts
      where posts.id = post_comments.post_id
        and posts.organization_id = auth.user_organization_id()
    )
  );

-- Post Metrics: accessible via post's org
create policy "Users can view post metrics"
  on post_metrics for select
  using (
    exists (
      select 1 from posts
      where posts.id = post_metrics.post_id
        and posts.organization_id = auth.user_organization_id()
    )
  );

create policy "Users can insert post metrics"
  on post_metrics for insert
  with check (
    exists (
      select 1 from posts
      where posts.id = post_metrics.post_id
        and posts.organization_id = auth.user_organization_id()
    )
  );

-- Review Events: accessible via post's org
create policy "Users can view review events"
  on review_events for select
  using (
    exists (
      select 1 from posts
      where posts.id = review_events.post_id
        and posts.organization_id = auth.user_organization_id()
    )
  );

-- Agent Keys: only org owners/admins
create policy "Admins can view agent keys"
  on agent_keys for select
  using (
    organization_id = auth.user_organization_id()
    and exists (
      select 1 from users
      where users.id = auth.uid()
        and users.role in ('owner', 'admin')
    )
  );

create policy "Admins can manage agent keys"
  on agent_keys for all
  using (
    organization_id = auth.user_organization_id()
    and exists (
      select 1 from users
      where users.id = auth.uid()
        and users.role in ('owner', 'admin')
    )
  );

-- Notifications: users can only see their own
create policy "Users can view own notifications"
  on notifications for select
  using (user_id = auth.uid());

create policy "Users can update own notifications"
  on notifications for update
  using (user_id = auth.uid());
