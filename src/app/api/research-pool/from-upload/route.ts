import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  authenticateAgent,
  getAgentFkId,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAgentActivity } from '@/lib/agent-activity'
import { rateLimit } from '@/lib/rate-limit'
import {
  buildMatchableText,
  computeRelevanceScore,
  matchPillar,
} from '@/lib/research-scoring'
import type { ContentPillar } from '@/lib/types'

const FromUploadSchema = z.object({
  upload_id: z.string().uuid(),
  title: z.string().min(1).optional(),
  pillar_id: z.string().uuid().nullable().optional(),
  extracted_content: z.string().optional(),
})

/**
 * POST /api/research-pool/from-upload — create a research pool item from
 * an existing research_upload record. Auto-scores and auto-matches pillars.
 */
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

  const parsed = FromUploadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Fetch the upload record
  const { data: upload, error: uploadErr } = await supabase
    .from('research_uploads')
    .select('*')
    .eq('id', parsed.data.upload_id)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (uploadErr) {
    console.error('[research-pool/from-upload] DB error fetching upload:', uploadErr)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (!upload) {
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
  }

  // Map upload fields to research pool item
  const title = parsed.data.title ?? upload.title ?? upload.filename
  const rawContent = parsed.data.extracted_content ?? upload.summary ?? null
  const sourceType = upload.source_kind ?? 'other'

  // Fetch pillars for matching
  const { data: pillars } = await supabase
    .from('content_pillars')
    .select('*')
    .eq('organization_id', auth.organizationId)
    .order('sort_order', { ascending: true })

  const orgPillars = (pillars ?? []) as ContentPillar[]
  const matchableText = buildMatchableText({ title, raw_content: rawContent })

  // Auto-match pillar
  let pillarId = parsed.data.pillar_id ?? null
  let pillarFitScore = 0

  if (!pillarId && orgPillars.length > 0) {
    const match = matchPillar(matchableText, orgPillars)
    if (match) {
      pillarId = match.pillar.id
      pillarFitScore = match.score
    }
  } else if (pillarId) {
    const { scorePillarFit } = await import('@/lib/research-scoring')
    const targetPillar = orgPillars.find((p) => p.id === pillarId)
    if (targetPillar) {
      pillarFitScore = scorePillarFit(matchableText, targetPillar)
    }
  }

  // Compute relevance score
  const relevanceScore =
    Math.round(
      computeRelevanceScore({
        title,
        raw_content: rawContent,
        source_url: null,
        source_type: sourceType,
        created_at: upload.created_at,
        pillar_fit_score: pillarFitScore,
      }) * 100
    ) / 100

  // Insert pool item
  const { data, error } = await supabase
    .from('research_pool')
    .insert({
      organization_id: auth.organizationId,
      title,
      source_url: null,
      source_type: sourceType,
      pillar_id: pillarId,
      relevance_score: relevanceScore,
      raw_content: rawContent,
      created_by_agent_id: getAgentFkId(auth),
    })
    .select()
    .single()

  if (error) {
    console.error('[research-pool/from-upload] DB error creating item:', error)
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
      source_upload_id: upload.id,
      auto_scored: true,
      auto_matched_pillar: !parsed.data.pillar_id && !!pillarId,
    },
    providerMetadata: providerRunId ? { provider_run_id: providerRunId } : undefined,
  })

  return NextResponse.json(data, { status: 201 })
}
