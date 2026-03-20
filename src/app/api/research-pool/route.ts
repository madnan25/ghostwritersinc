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
import { rateLimit } from '@/lib/rate-limit'
import {
  buildMatchableText,
  computeRelevanceScore,
  matchPillar,
} from '@/lib/research-scoring'
import { normalizePillarInput } from '@/lib/pillar-normalization'
import type { ContentPillar } from '@/lib/types'

const CreateResearchPoolSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  source_url: z.string().url().nullable().optional(),
  source_type: z.string().default('article'),
  pillar_id: z.string().uuid().nullable().optional(),
  pillar: z.string().nullable().optional(), // free-form string; normalized to pillar_id
  relevance_score: z.number().min(0).max(1).nullable().optional(),
  raw_content: z.string().nullable().optional(),
  auto_score: z.boolean().optional().default(true),
})

/** POST /api/research-pool — create a new research pool item */
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'write'), { maxRequests: 10 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'research:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: research:write access required' },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateResearchPoolSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  let pillarId = parsed.data.pillar_id ?? null
  let relevanceScore = parsed.data.relevance_score ?? null
  let pillarMappingStatus: 'auto' | 'manual' | 'needs_review' = pillarId ? 'manual' : 'auto'

  // Normalize free-form pillar string → pillar_id when provided
  if (!pillarId && parsed.data.pillar) {
    const normalized = await normalizePillarInput(
      parsed.data.pillar,
      auth.userId,
      supabase,
    )
    if (normalized) {
      pillarId = normalized.pillarId
      pillarMappingStatus = normalized.mappingStatus
    } else {
      pillarMappingStatus = 'needs_review'
    }
  }

  // Auto-score and auto-match pillars when not explicitly provided
  if (parsed.data.auto_score) {
    // Fetch user pillars for matching
    const { data: pillars } = await supabase
      .from('content_pillars')
      .select('*')
      .eq('user_id', auth.userId)
      .order('sort_order', { ascending: true })

    const orgPillars = (pillars ?? []) as ContentPillar[]
    const matchableText = buildMatchableText(parsed.data)

    // Auto-match pillar if not provided
    let pillarFitScore = 0
    if (!pillarId && orgPillars.length > 0) {
      const match = matchPillar(matchableText, orgPillars)
      if (match) {
        pillarId = match.pillar.id
        pillarFitScore = match.score
      }
    } else if (pillarId) {
      // Score fit against the explicitly provided pillar
      const targetPillar = orgPillars.find((p) => p.id === pillarId)
      if (targetPillar) {
        const { scorePillarFit } = await import('@/lib/research-scoring')
        pillarFitScore = scorePillarFit(matchableText, targetPillar)
      }
    }

    // Auto-score relevance if not provided
    if (relevanceScore === null) {
      relevanceScore = computeRelevanceScore({
        title: parsed.data.title,
        raw_content: parsed.data.raw_content,
        source_url: parsed.data.source_url,
        source_type: parsed.data.source_type,
        created_at: new Date().toISOString(),
        pillar_fit_score: pillarFitScore,
      })
      // Round to 2 decimal places
      relevanceScore = Math.round(relevanceScore * 100) / 100
    }
  }

  const { data, error } = await supabase
    .from('research_pool')
    .insert({
      organization_id: auth.organizationId,
      title: parsed.data.title,
      source_url: parsed.data.source_url ?? null,
      source_type: parsed.data.source_type,
      pillar_id: pillarId,
      pillar_mapping_status: pillarMappingStatus,
      relevance_score: relevanceScore,
      raw_content: parsed.data.raw_content ?? null,
      created_by_agent_id: auth.agentId,
    })
    .select()
    .single()

  if (error) {
    console.error('[research-pool] DB error creating item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const providerRunId = request.headers.get('x-paperclip-run-id')
  logAgentActivity({
    organizationId: auth.organizationId,
    agentId: auth.agentId,
    postId: null,
    actionType: 'draft_created',
    metadata: {
      entity: 'research_pool',
      item_id: data.id,
      auto_scored: parsed.data.auto_score,
      auto_matched_pillar: !parsed.data.pillar_id && !!pillarId,
    },
    providerMetadata: providerRunId ? { provider_run_id: providerRunId } : undefined,
  })

  return NextResponse.json(data, { status: 201 })
}

/** GET /api/research-pool — list research pool items for the org */
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'read'), { maxRequests: 60 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'research:read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: research:read access required' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const pillarId = searchParams.get('pillar_id')
  const minScore = searchParams.get('min_score')
  const sortBy = searchParams.get('sort_by') // 'relevance_score' | 'created_at' (default)
  const includeScoutContext = searchParams.get('include_scout_context') === 'true'

  const supabase = createAdminClient()
  let query = supabase
    .from('research_pool')
    .select('*')
    .eq('organization_id', auth.organizationId)

  // Non-shared agents can only see their own items
  if (!isSharedOrgAgentContext(auth)) {
    query = query.eq('created_by_agent_id', auth.agentId)
  }

  if (status) {
    const validStatuses = ['new', 'consumed']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }
    query = query.eq('status', status)
  }

  if (pillarId) {
    query = query.eq('pillar_id', pillarId)
  }

  if (minScore) {
    const threshold = parseFloat(minScore)
    if (isNaN(threshold) || threshold < 0 || threshold > 1) {
      return NextResponse.json(
        { error: 'min_score must be a number between 0 and 1' },
        { status: 400 }
      )
    }
    query = query.gte('relevance_score', threshold)
  }

  // Sort by relevance_score desc or created_at desc
  if (sortBy === 'relevance_score') {
    query = query.order('relevance_score', { ascending: false, nullsFirst: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const { data, error } = await query

  if (error) {
    console.error('[research-pool] DB error listing items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Optionally include scout_context for Scout heartbeat consumption
  if (includeScoutContext && hasAgentPermission(auth.permissions, 'strategy:read')) {
    const { data: config } = await supabase
      .from('strategy_config')
      .select('scout_context')
      .eq('user_id', auth.userId)
      .eq('organization_id', auth.organizationId)
      .maybeSingle()

    const scoutContext = config?.scout_context ?? null

    return NextResponse.json({
      items: data,
      scout_context: scoutContext,
    })
  }

  return NextResponse.json(data)
}
