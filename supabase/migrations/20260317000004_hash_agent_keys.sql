-- Migration: Hash existing plaintext API keys and add key_prefix for lookup
-- Part of LIN-90: Fix plaintext API key storage

-- 1. Add key_prefix column for efficient lookup
alter table agent_keys add column key_prefix text;

-- 2. Populate key_prefix from existing plaintext keys (first 8 chars)
update agent_keys set key_prefix = left(api_key_hash, 8);

-- 3. Hash existing plaintext keys in-place using pgcrypto bcrypt
update agent_keys set api_key_hash = crypt(api_key_hash, gen_salt('bf'));

-- 4. Make key_prefix NOT NULL after backfill
alter table agent_keys alter column key_prefix set not null;

-- 5. Add index on key_prefix for fast lookups
create index idx_agent_keys_prefix on agent_keys (key_prefix);
