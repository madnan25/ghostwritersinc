-- Restore account activation and platform-admin authority on users

alter table public.users
  add column if not exists is_active boolean not null default true,
  add column if not exists is_platform_admin boolean not null default false;

create index if not exists idx_users_is_active on public.users (is_active);
create index if not exists idx_users_is_platform_admin on public.users (is_platform_admin);

-- Bootstrap the current product owner as the sole initial platform admin.
update public.users
set
  is_active = true,
  is_platform_admin = true
where email = 'madnan@alumni.nd.edu';
