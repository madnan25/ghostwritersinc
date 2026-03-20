-- Strategist episodic memory tables (LIN-557 Phase 1)
-- Scoped to (user_id, organization_id) — matches strategy_config RLS pattern.
-- Sentinel findings (LIN-566) applied: strategy_config auth.uid() policies,
-- DB-level length constraints, no shared-org scope on memory routes.

-- ===========================================================================
-- strategist_memories: episodic facts the Strategist recalls across sessions
-- ===========================================================================

create table strategist_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  type text not null check (type in ('preference', 'episode', 'pattern', 'tacit')),
  entity text,
  fact text not null check (char_length(fact) <= 10000),
  source_type text check (source_type in ('comment', 'observation', 'brief', 'manual')),
  source_id uuid,
  confidence numeric(4,3) not null default 1.0
    check (confidence >= 0.0 and confidence <= 1.0),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_strategist_memories_user_org
  on strategist_memories (user_id, organization_id);

create index idx_strategist_memories_user_org_type
  on strategist_memories (user_id, organization_id, type);

create trigger strategist_memories_updated_at
  before update on strategist_memories
  for each row execute function update_updated_at();

alter table strategist_memories enable row level security;

create policy "Users can view their own memories"
  on strategist_memories for select
  using (user_id = auth.uid());

create policy "Users can create their own memories"
  on strategist_memories for insert
  with check (user_id = auth.uid());

create policy "Users can update their own memories"
  on strategist_memories for update
  using (user_id = auth.uid());

create policy "Users can delete their own memories"
  on strategist_memories for delete
  using (user_id = auth.uid());

-- ===========================================================================
-- strategist_session_notes: timeline of what the Strategist did each session
-- ===========================================================================

create table strategist_session_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  session_date date not null default current_date,
  notes text not null check (char_length(notes) <= 10000),
  created_at timestamptz not null default now()
);

create index idx_strategist_session_notes_user_org
  on strategist_session_notes (user_id, organization_id);

create index idx_strategist_session_notes_date
  on strategist_session_notes (user_id, organization_id, session_date);

alter table strategist_session_notes enable row level security;

create policy "Users can view their own session notes"
  on strategist_session_notes for select
  using (user_id = auth.uid());

create policy "Users can create their own session notes"
  on strategist_session_notes for insert
  with check (user_id = auth.uid());

-- ===========================================================================
-- strategist_contextual_prefs: per-pillar/per-audience preference overrides
-- ===========================================================================

create table strategist_contextual_prefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  context_key text not null,
  preference_json jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  constraint strategist_contextual_prefs_unique
    unique (user_id, organization_id, context_key)
);

create index idx_strategist_contextual_prefs_user_org
  on strategist_contextual_prefs (user_id, organization_id);

create trigger strategist_contextual_prefs_updated_at
  before update on strategist_contextual_prefs
  for each row execute function update_updated_at();

alter table strategist_contextual_prefs enable row level security;

create policy "Users can view their own contextual prefs"
  on strategist_contextual_prefs for select
  using (user_id = auth.uid());

create policy "Users can create their own contextual prefs"
  on strategist_contextual_prefs for insert
  with check (user_id = auth.uid());

create policy "Users can update their own contextual prefs"
  on strategist_contextual_prefs for update
  using (user_id = auth.uid());

create policy "Users can delete their own contextual prefs"
  on strategist_contextual_prefs for delete
  using (user_id = auth.uid());
