-- Backfill pillar_id on posts that have a brief with a pillar, or a pillar text
-- column that can be resolved to a canonical content_pillar. (LIN-446)

-- =============================================================================
-- 1. INHERIT pillar_id FROM BRIEF when post has brief_id but no pillar_id
-- =============================================================================

update posts p
set
  pillar_id = b.pillar_id,
  pillar_mapping_status = 'auto',
  updated_at = now()
from briefs b
where p.brief_id = b.id
  and p.pillar_id is null
  and b.pillar_id is not null;

-- =============================================================================
-- 2. RESOLVE pillar text → pillar_id via exact slug match
-- =============================================================================

update posts p
set
  pillar_id = cp.id,
  pillar_mapping_status = 'auto',
  updated_at = now()
from content_pillars cp
where p.pillar_id is null
  and p.pillar is not null
  and cp.user_id = p.user_id
  and lower(trim(p.pillar)) = cp.slug;

-- =============================================================================
-- 3. RESOLVE pillar text → pillar_id via exact name match (case-insensitive)
-- =============================================================================

update posts p
set
  pillar_id = cp.id,
  pillar_mapping_status = 'auto',
  updated_at = now()
from content_pillars cp
where p.pillar_id is null
  and p.pillar is not null
  and cp.user_id = p.user_id
  and lower(trim(p.pillar)) = lower(cp.name);

-- =============================================================================
-- 4. RESOLVE pillar text → pillar_id via alias table
-- =============================================================================

update posts p
set
  pillar_id = cp.id,
  pillar_mapping_status = 'auto',
  updated_at = now()
from pillar_aliases pa
join content_pillars cp on cp.slug = pa.target_slug and cp.user_id = p.user_id
where p.pillar_id is null
  and p.pillar is not null
  and lower(trim(p.pillar)) = pa.alias;

-- =============================================================================
-- 5. RESOLVE pillar text with "P\d+ — " prefix stripped
-- =============================================================================

update posts p
set
  pillar_id = cp.id,
  pillar_mapping_status = 'auto',
  updated_at = now()
from content_pillars cp
where p.pillar_id is null
  and p.pillar is not null
  and p.pillar ~ '^P\d+\s*[—–-]\s*'
  and cp.user_id = p.user_id
  and (
    lower(regexp_replace(trim(p.pillar), '^P\d+\s*[—–-]\s*', '')) = cp.slug
    or lower(regexp_replace(trim(p.pillar), '^P\d+\s*[—–-]\s*', '')) = lower(cp.name)
  );

-- =============================================================================
-- 6. RESOLVE via partial slug containment (low confidence)
-- =============================================================================

update posts p
set
  pillar_id = cp.id,
  pillar_mapping_status = 'auto',
  updated_at = now()
from content_pillars cp
where p.pillar_id is null
  and p.pillar is not null
  and cp.user_id = p.user_id
  and (
    cp.slug like '%' || lower(trim(p.pillar)) || '%'
    or lower(trim(p.pillar)) like '%' || cp.slug || '%'
  );

-- =============================================================================
-- 7. FLAG remaining unresolved posts as needs_review
-- =============================================================================

update posts
set
  pillar_mapping_status = 'needs_review',
  updated_at = now()
where pillar_id is null
  and pillar is not null
  and (pillar_mapping_status is null or pillar_mapping_status = 'auto');
