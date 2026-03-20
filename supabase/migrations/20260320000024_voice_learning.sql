-- LIN-502: post_diffs table, voice_observations CRUD, writing_profiles Learned Preferences
-- Sprint 5 — Voice Profile Learning
--
-- Changes:
--   1. diff_edit_type enum ('no_edit' | 'minor_edit' | 'major_edit')
--   2. post_diffs table — one record per published post, generated on publish
--   3. voice_observation_status enum ('pending' | 'confirmed' | 'dismissed')
--   4. voice_observations table — LLM-generated style observations per user
--   5. learned_preferences jsonb column on user_writing_profiles
--   6. RLS on all new tables (org-scoped)
--
-- Breaking API changes: none

-- =============================================================================
-- 1. diff_edit_type enum
-- =============================================================================
do $$ begin
  create type diff_edit_type as enum ('no_edit', 'minor_edit', 'major_edit');
exception when duplicate_object then null;
end $$;

-- =============================================================================
-- 2. post_diffs table (one record per post — generated on publish)
-- =============================================================================
create table if not exists post_diffs (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  original_content text not null,
  published_content text not null,
  edit_type diff_edit_type not null,
  change_summary text,
  created_at timestamptz not null default now(),
  constraint post_diffs_post_id_unique unique (post_id)
);

create index if not exists idx_post_diffs_org on post_diffs (organization_id);
create index if not exists idx_post_diffs_user on post_diffs (user_id);
create index if not exists idx_post_diffs_edit_type on post_diffs (organization_id, edit_type);

-- =============================================================================
-- 3. RLS — org-scoped on post_diffs
-- =============================================================================
alter table post_diffs enable row level security;

create policy "Users can view org post diffs"
  on post_diffs for select
  using (organization_id = public.user_organization_id());

create policy "Users can insert org post diffs"
  on post_diffs for insert
  with check (organization_id = public.user_organization_id());

-- =============================================================================
-- 4. voice_observation_status enum
-- =============================================================================
do $$ begin
  create type voice_observation_status as enum ('pending', 'confirmed', 'dismissed');
exception when duplicate_object then null;
end $$;

-- =============================================================================
-- 5. voice_observations table
-- =============================================================================
create table if not exists voice_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  observation text not null,
  confidence numeric(3,2) not null default 0.5 check (confidence >= 0 and confidence <= 1),
  status voice_observation_status not null default 'pending',
  source_post_ids uuid[] not null default '{}',
  created_by_agent_id uuid references agents(id) on delete set null,
  confirmed_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_voice_observations_org on voice_observations (organization_id);
create index if not exists idx_voice_observations_user on voice_observations (user_id);
create index if not exists idx_voice_observations_status on voice_observations (organization_id, status);

do $$ begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'voice_observations_updated_at'
      and tgrelid = 'voice_observations'::regclass
  ) then
    create trigger voice_observations_updated_at
      before update on voice_observations
      for each row execute function update_updated_at();
  end if;
end $$;

-- =============================================================================
-- 6. RLS — org-scoped on voice_observations
-- =============================================================================
alter table voice_observations enable row level security;

create policy "Users can view org voice observations"
  on voice_observations for select
  using (organization_id = public.user_organization_id());

create policy "Users can insert org voice observations"
  on voice_observations for insert
  with check (organization_id = public.user_organization_id());

create policy "Users can update org voice observations"
  on voice_observations for update
  using (organization_id = public.user_organization_id());

-- =============================================================================
-- 7. learned_preferences column on user_writing_profiles
-- =============================================================================
alter table user_writing_profiles
  add column if not exists learned_preferences jsonb;

comment on column user_writing_profiles.learned_preferences is
  'JSON array of confirmed voice observations applied as "Learned Preferences"';
