-- Add "What's Working" summary storage to strategy_config
-- Stores a JSON summary of content performance patterns

alter table strategy_config
  add column whats_working jsonb,
  add column whats_working_updated_at timestamptz;

comment on column strategy_config.whats_working is
  'JSON summary of content performance patterns: top pillars, best templates, engagement trends';
comment on column strategy_config.whats_working_updated_at is
  'When the whats_working summary was last regenerated';
