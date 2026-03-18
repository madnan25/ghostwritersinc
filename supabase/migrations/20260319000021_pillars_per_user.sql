-- Refactor content_pillars from org-scoped to user-scoped (LIN-181)
-- Each user manages their own content pillars. organization_id is kept for
-- membership validation but user_id becomes the primary scoping column.

-- =============================================================================
-- 1. ADD user_id COLUMN
-- =============================================================================

alter table content_pillars
  add column user_id uuid references auth.users(id) on delete cascade;

-- =============================================================================
-- 2. BACKFILL: assign existing pillars to the org owner (first user in org)
-- =============================================================================

update content_pillars cp
set user_id = u.id
from (
  select distinct on (organization_id) id, organization_id
  from users
  order by organization_id, created_at asc
) u
where cp.organization_id = u.organization_id
  and cp.user_id is null;

-- Make user_id NOT NULL after backfill
alter table content_pillars
  alter column user_id set not null;

-- =============================================================================
-- 3. UPDATE UNIQUE CONSTRAINT: (org, slug) → (user_id, slug)
-- =============================================================================

alter table content_pillars
  drop constraint content_pillars_org_slug_unique;

alter table content_pillars
  add constraint content_pillars_user_slug_unique unique (user_id, slug);

-- Index for user_id queries
create index idx_content_pillars_user on content_pillars (user_id);

-- =============================================================================
-- 4. UPDATE RLS POLICIES: scope by user_id
-- =============================================================================

drop policy if exists "Users can view org pillars" on content_pillars;
drop policy if exists "Users can create pillars in their org" on content_pillars;
drop policy if exists "Users can update org pillars" on content_pillars;
drop policy if exists "Users can delete org pillars" on content_pillars;

create policy "Users can view their own pillars"
  on content_pillars for select
  using (user_id = auth.uid());

create policy "Users can create their own pillars"
  on content_pillars for insert
  with check (user_id = auth.uid());

create policy "Users can update their own pillars"
  on content_pillars for update
  using (user_id = auth.uid());

create policy "Users can delete their own pillars"
  on content_pillars for delete
  using (user_id = auth.uid());

-- =============================================================================
-- 5. UPDATE ONBOARDING TRIGGER: provision default pillars per-user
--    Instead of creating org-level defaults, we create a user-level trigger
--    that provisions default pillars when a user joins an onboarded org.
--    The org onboarding trigger is kept but now needs a target user.
-- =============================================================================

create or replace function provision_default_pillars()
returns trigger as $$
declare
  v_owner_id uuid;
begin
  -- Only fire when onboarded_at transitions from NULL to a value
  if old.onboarded_at is null and new.onboarded_at is not null then
    -- Find the org owner (first user) to assign default pillars
    select id into v_owner_id
    from users
    where organization_id = new.id
    order by created_at asc
    limit 1;

    if v_owner_id is not null then
      insert into content_pillars (organization_id, user_id, name, slug, color, weight_pct, description) values
        (new.id, v_owner_id, 'Thought Leadership', 'thought-leadership', '#3B82F6', 40, 'Share expertise, frameworks, and insights that establish authority in your domain.'),
        (new.id, v_owner_id, 'Industry Insights', 'industry-insights', '#10B981', 30, 'Commentary on trends, news, and shifts relevant to your audience.'),
        (new.id, v_owner_id, 'Personal Brand', 'personal-brand', '#F59E0B', 30, 'Stories, lessons, and behind-the-scenes content that builds connection and trust.');
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger already exists, function replacement is sufficient.

-- =============================================================================
-- 6. NEW TRIGGER: provision default pillars for new users in onboarded orgs
-- =============================================================================

create or replace function provision_user_default_pillars()
returns trigger as $$
declare
  v_onboarded boolean;
begin
  -- Check if the user's org is already onboarded
  select (onboarded_at is not null) into v_onboarded
  from organizations
  where id = new.organization_id;

  if v_onboarded then
    -- Don't duplicate if user already has pillars (e.g., org owner)
    if not exists (
      select 1 from content_pillars where user_id = new.id limit 1
    ) then
      insert into content_pillars (organization_id, user_id, name, slug, color, weight_pct, description) values
        (new.organization_id, new.id, 'Thought Leadership', 'thought-leadership', '#3B82F6', 40, 'Share expertise, frameworks, and insights that establish authority in your domain.'),
        (new.organization_id, new.id, 'Industry Insights', 'industry-insights', '#10B981', 30, 'Commentary on trends, news, and shifts relevant to your audience.'),
        (new.organization_id, new.id, 'Personal Brand', 'personal-brand', '#F59E0B', 30, 'Stories, lessons, and behind-the-scenes content that builds connection and trust.');
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists user_joined_provision_pillars on users;
create trigger user_joined_provision_pillars
  after insert on users
  for each row execute function provision_user_default_pillars();
