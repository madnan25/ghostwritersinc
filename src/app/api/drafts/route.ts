import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  authenticateAgent,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
  isSharedOrgAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAgentActivity } from '@/lib/agent-activity'
import { getLatestBriefVersion } from '@/lib/brief-versioning'
import { normalizePillarInput } from '@/lib/pillar-normalization'
import { rateLimit } from '@/lib/rate-limit'

const VALID_POST_STATUSES = [
  'draft', 'pending_review', 'approved', 'rejected', 'revision', 'scheduled', 'published', 'publish_failed',
] as const

const CreateDraftSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  content_type: z.enum(['text', 'image', 'document']).default('text'),
  pillar: z.string().nullable().optional(),
  pillar_id: z.string().uuid().nullable().optional(),
  brief_id: z.string().uuid().nullable().optional(),
  brief_ref: z.string().max(512).nullable().optional(),
  suggested_publish_at: z.string().datetime({ offset: true }).nullable().optional(),
  media_urls: z.array(z.string().url()).nullable().optional(),
  freshness_type: z.enum(['evergreen', 'time_sensitive', 'date_locked']).nullable().optional(),
  expiry_date: z.string().datetime({ offset: true }).nullable().optional(),
})

/** POST /api/drafts — create a new draft */
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'drafts-write'), { maxRequests: 10 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'drafts:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: drafts:write access required' },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateDraftSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Require the commissioned user to exist in the target org.
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('id', auth.userId)
    .eq('organization_id', auth.organizationId)
    .single()

  if (!user) {
    return NextResponse.json(
      { error: 'Assigned user not found for this organization' },
      { status: 400 }
    )
  }

  // Dedup guard: if brief_id is provided, reject if an active post already exists
  // for that brief. Agents should PATCH existing drafts for revisions, not POST new ones.
  const briefId = parsed.data.brief_id ?? null
  if (briefId) {
    const { data: existing } = await supabase
      .from('posts')
      .select('id, status, content_version')
      .eq('brief_id', briefId)
      .eq('organization_id', auth.organizationId)
      .not('status', 'in', '("rejected")')
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        {
          error: `A post already exists for brief ${briefId} (post ${existing.id}, status: ${existing.status}, v${existing.content_version ?? 1}). Use PATCH /api/drafts/${existing.id} to revise it instead of creating a duplicate.`,
          existing_post_id: existing.id,
          existing_status: existing.status,
        },
        { status: 409 }
      )
    }
  }

  const latestBriefVersion = await getLatestBriefVersion(
    supabase,
    briefId,
  )

  // Resolve pillar_id: explicit > brief inheritance > text normalization
  let resolvedPillarId = parsed.data.pillar_id ?? null
  let pillarMappingStatus: 'auto' | 'manual' | 'needs_review' = resolvedPillarId ? 'manual' : 'auto'

  if (!resolvedPillarId && briefId) {
    const { data: brief } = await supabase
      .from('briefs')
      .select('pillar_id')
      .eq('id', briefId)
      .maybeSingle()
    if (brief?.pillar_id) {
      resolvedPillarId = brief.pillar_id
      pillarMappingStatus = 'auto'
    }
  }

  if (!resolvedPillarId && parsed.data.pillar) {
    const normalized = await normalizePillarInput(
      parsed.data.pillar,
      auth.userId,
      supabase,
    )
    if (normalized) {
      resolvedPillarId = normalized.pillarId
      pillarMappingStatus = normalized.mappingStatus
    } else {
      pillarMappingStatus = 'needs_review'
    }
  }

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      organization_id: auth.organizationId,
      user_id: user.id,
      content: parsed.data.content,
      content_type: parsed.data.content_type,
      pillar: parsed.data.pillar ?? null,
      pillar_id: resolvedPillarId,
      pillar_mapping_status: pillarMappingStatus,
      brief_id: parsed.data.brief_id ?? null,
      brief_version_id: latestBriefVersion?.id ?? null,
      brief_ref: parsed.data.brief_ref ?? null,
      suggested_publish_at: parsed.data.suggested_publish_at ?? null,
      media_urls: parsed.data.media_urls ?? [],
      status: 'pending_review',
      agent_id: auth.agentId,
      created_by_agent: auth.agentName,
      freshness_type: parsed.data.freshness_type ?? null,
      expiry_date: parsed.data.expiry_date ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[drafts] DB error creating draft:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const providerRunId = request.headers.get('x-paperclip-run-id')
  logAgentActivity({
    organizationId: auth.organizationId,
    agentId: auth.agentId,
    postId: post.id,
    actionType: 'draft_created',
    metadata: { content_type: parsed.data.content_type, pillar_id: parsed.data.pillar_id ?? null },
    providerMetadata: providerRunId ? { provider_run_id: providerRunId } : undefined,
  })

  return NextResponse.json(post, { status: 201 })
}

/** GET /api/drafts — list drafts (filterable by status) */
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'drafts-read'), { maxRequests: 60 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'drafts:read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: drafts:read access required' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const supabase = createAdminClient()
  let query = supabase
    .from('posts')
    .select('*')
    .eq('organization_id', auth.organizationId)
    .is('archived_at', null)
    .order('suggested_publish_at', { ascending: true })

  if (!isSharedOrgAgentContext(auth)) {
    query = query.eq('user_id', auth.userId)
  }

  if (status) {
    const statuses = status.split(',')
    const invalid = statuses.filter((s) => !(VALID_POST_STATUSES as readonly string[]).includes(s))
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid status values: ${invalid.join(', ')}` },
        { status: 400 }
      )
    }
    query = query.in('status', statuses)
  }

  // Exclude posts already reviewed by an agent — prevents review loops
  // where Strategist re-reviews the same pending_review post repeatedly.
  const excludeReviewed = searchParams.get('exclude_reviewed')
  if (excludeReviewed === 'true') {
    query = query.is('reviewed_by_agent', null)
  }

  const { data, error } = await query

  if (error) {
    console.error('[drafts] DB error listing drafts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
