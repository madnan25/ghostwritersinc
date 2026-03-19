-- Strategy Config — singleton per user (LIN-302 Sprint 1)
-- Stores per-user publishing strategy preferences.

create table strategy_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  monthly_post_target integer not null default 12,
  intel_score_threshold numeric(3,2) not null default 0.70
    check (intel_score_threshold >= 0 and intel_score_threshold <= 1),
  default_publish_hour integer not null default 9
    check (default_publish_hour >= 0 and default_publish_hour <= 23),
  voice_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Singleton constraint: one config per user per org
alter table strategy_config
  add constraint strategy_config_user_org_unique unique (user_id, organization_id);

create index idx_strategy_config_user on strategy_config (user_id);
create index idx_strategy_config_org on strategy_config (organization_id);

-- updated_at trigger
create trigger strategy_config_updated_at
  before update on strategy_config
  for each row execute function update_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY — user-scoped (matches content_pillars LIN-181 pattern)
-- =============================================================================

alter table strategy_config enable row level security;

create policy "Users can view their own strategy config"
  on strategy_config for select
  using (user_id = auth.uid());

create policy "Users can create their own strategy config"
  on strategy_config for insert
  with check (user_id = auth.uid());

create policy "Users can update their own strategy config"
  on strategy_config for update
  using (user_id = auth.uid());

create policy "Users can delete their own strategy config"
  on strategy_config for delete
  using (user_id = auth.uid());
