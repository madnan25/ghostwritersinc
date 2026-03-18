-- Migration: secure invitation token storage
-- Replaces raw invitation tokens with deterministic SHA-256 hashes.

alter table public.user_invitations
  add column if not exists token_hash text;

update public.user_invitations
set token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
where token is not null
  and token_hash is null;

alter table public.user_invitations
  alter column token_hash set not null;

create unique index if not exists idx_user_invitations_token_hash
  on public.user_invitations (token_hash);

drop index if exists idx_user_invitations_token;

alter table public.user_invitations
  drop constraint if exists user_invitations_token_key;

alter table public.user_invitations
  drop column if exists token;
