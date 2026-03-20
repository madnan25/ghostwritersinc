-- Version every brief revision and link post versions back to the brief draft
-- they were written from.

alter table public.briefs
  add column if not exists current_version integer not null default 1;

create table if not exists public.brief_versions (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.briefs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version integer not null,
  pillar_id uuid references public.content_pillars(id) on delete set null,
  angle text not null,
  research_refs uuid[] not null default '{}',
  voice_notes text,
  publish_at timestamptz,
  status brief_status not null,
  revision_count integer not null default 0,
  revision_notes text,
  assigned_agent_id uuid references public.agents(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint uq_brief_versions_brief_version unique (brief_id, version)
);

create index if not exists idx_brief_versions_brief on public.brief_versions (brief_id, version desc);
create index if not exists idx_brief_versions_org on public.brief_versions (organization_id, created_at desc);

alter table public.brief_versions enable row level security;

drop policy if exists "Users can view org brief versions" on public.brief_versions;
create policy "Users can view org brief versions"
  on public.brief_versions for select
  using (organization_id = public.user_organization_id());

drop policy if exists "Users can create org brief versions" on public.brief_versions;
create policy "Users can create org brief versions"
  on public.brief_versions for insert
  with check (organization_id = public.user_organization_id());

drop policy if exists "Users can update org brief versions" on public.brief_versions;
create policy "Users can update org brief versions"
  on public.brief_versions for update
  using (organization_id = public.user_organization_id());

drop policy if exists "Users can delete org brief versions" on public.brief_versions;
create policy "Users can delete org brief versions"
  on public.brief_versions for delete
  using (organization_id = public.user_organization_id());

create or replace function public.bump_brief_current_version()
returns trigger as $$
begin
  if row(
    new.pillar_id,
    new.angle,
    new.research_refs,
    new.voice_notes,
    new.publish_at,
    new.status,
    new.revision_count,
    new.revision_notes,
    new.assigned_agent_id
  ) is distinct from row(
    old.pillar_id,
    old.angle,
    old.research_refs,
    old.voice_notes,
    old.publish_at,
    old.status,
    old.revision_count,
    old.revision_notes,
    old.assigned_agent_id
  ) then
    new.current_version := old.current_version + 1;
  else
    new.current_version := old.current_version;
  end if;

  return new;
end;
$$ language plpgsql;

create or replace function public.snapshot_brief_version()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    insert into public.brief_versions (
      brief_id,
      organization_id,
      version,
      pillar_id,
      angle,
      research_refs,
      voice_notes,
      publish_at,
      status,
      revision_count,
      revision_notes,
      assigned_agent_id,
      created_at
    ) values (
      new.id,
      new.organization_id,
      new.current_version,
      new.pillar_id,
      new.angle,
      new.research_refs,
      new.voice_notes,
      new.publish_at,
      new.status,
      new.revision_count,
      new.revision_notes,
      new.assigned_agent_id,
      coalesce(new.updated_at, new.created_at, now())
    )
    on conflict (brief_id, version) do nothing;
  elsif tg_op = 'UPDATE' and new.current_version is distinct from old.current_version then
    insert into public.brief_versions (
      brief_id,
      organization_id,
      version,
      pillar_id,
      angle,
      research_refs,
      voice_notes,
      publish_at,
      status,
      revision_count,
      revision_notes,
      assigned_agent_id,
      created_at
    ) values (
      new.id,
      new.organization_id,
      new.current_version,
      new.pillar_id,
      new.angle,
      new.research_refs,
      new.voice_notes,
      new.publish_at,
      new.status,
      new.revision_count,
      new.revision_notes,
      new.assigned_agent_id,
      coalesce(new.updated_at, now())
    )
    on conflict (brief_id, version) do nothing;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists briefs_bump_current_version on public.briefs;
create trigger briefs_bump_current_version
  before update on public.briefs
  for each row
  execute function public.bump_brief_current_version();

drop trigger if exists briefs_snapshot_version on public.briefs;
create trigger briefs_snapshot_version
  after insert or update on public.briefs
  for each row
  execute function public.snapshot_brief_version();

insert into public.brief_versions (
  brief_id,
  organization_id,
  version,
  pillar_id,
  angle,
  research_refs,
  voice_notes,
  publish_at,
  status,
  revision_count,
  revision_notes,
  assigned_agent_id,
  created_at
)
select
  b.id,
  b.organization_id,
  1,
  b.pillar_id,
  b.angle,
  b.research_refs,
  b.voice_notes,
  b.publish_at,
  b.status,
  b.revision_count,
  b.revision_notes,
  b.assigned_agent_id,
  b.created_at
from public.briefs b
on conflict (brief_id, version) do nothing;

alter table public.posts
  add column if not exists brief_version_id uuid references public.brief_versions(id) on delete set null;

alter table public.post_revisions
  add column if not exists brief_version_id uuid references public.brief_versions(id) on delete set null;

create index if not exists idx_posts_brief_version on public.posts (brief_version_id);
create index if not exists idx_post_revisions_brief_version on public.post_revisions (brief_version_id);

update public.posts p
set brief_version_id = bv.id
from public.brief_versions bv
join public.briefs b on b.id = bv.brief_id and bv.version = b.current_version
where p.brief_id = b.id
  and p.brief_version_id is null;
