-- LIN-472: post_performance table + pillar_weights columns on strategy_config
--
-- Changes:
--   1. pillar_weights_scope enum ('default' | 'monthly')
--   2. post_performance table — single record per post (upsert on post_id)
--   3. RLS on post_performance — org-scoped read/write
--   4. Add pillar_weights, pillar_weights_scope, pillar_weights_month to strategy_config
--
-- Breaking API changes: none

-- =============================================================================
-- 1. pillar_weights_scope enum
-- =============================================================================
do $$ begin
  create type pillar_weights_scope as enum ('default', 'monthly');
exception when duplicate_object then null;
end $$;

-- =============================================================================
-- 2. post_performance table (single record per post — upsert model)
-- =============================================================================
create table if not exists post_performance (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  impressions integer check (impressions >= 0),
  reactions integer check (reactions >= 0),
  comments_count integer check (comments_count >= 0),
  reposts integer check (reposts >= 0),
  qualitative_notes text,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_performance_post_id_unique unique (post_id)
);

create index if not exists idx_post_performance_org on post_performance (organization_id);
create index if not exists idx_post_performance_user on post_performance (user_id);

do $$ begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'post_performance_updated_at'
      and tgrelid = 'post_performance'::regclass
  ) then
    create trigger post_performance_updated_at
      before update on post_performance
      for each row execute function update_updated_at();
  end if;
end $$;

-- =============================================================================
-- 3. RLS — org-scoped read/write
-- =============================================================================
alter table post_performance enable row level security;

create policy "Users can view org post performance"
  on post_performance for select
  using (organization_id = public.user_organization_id());

create policy "Users can insert org post performance"
  on post_performance for insert
  with check (organization_id = public.user_organization_id());

create policy "Users can update org post performance"
  on post_performance for update
  using (organization_id = public.user_organization_id());

-- =============================================================================
-- 4. Add pillar_weights columns to strategy_config
-- =============================================================================
alter table strategy_config
  add column if not exists pillar_weights jsonb,
  add column if not exists pillar_weights_scope pillar_weights_scope not null default 'default',
  add column if not exists pillar_weights_month date;
