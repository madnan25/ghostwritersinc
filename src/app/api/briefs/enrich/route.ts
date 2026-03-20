import { NextRequest, NextResponse } from 'next/server'
import {
  authenticateAgent,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAgentActivity } from '@/lib/agent-activity'
import { rateLimit } from '@/lib/rate-limit'
import {
  buildMatchableText,
  matchPillar,
} from '@/lib/research-scoring'
import type { ContentPillar } from '@/lib/types'

/**
 * POST /api/briefs/enrich — Strategist enrichment endpoint.
 *
 * Picks up human-requested briefs with status=pending, enriches them
 * (auto-assigns pillar, attaches relevant research), and transitions
 * their status to in_review. Urgent briefs are processed first.
 *
 * Returns the list of enriched briefs.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'briefs-enrich-write'), { maxRequests: 5 })
  if (limited) return limited

  if (
    !hasAgentPermission(auth.permissions, 'briefs:write') ||
    !hasAgentPermission(auth.permissions, 'briefs:read') ||
    !hasAgentPermission(auth.permissions, 'strategy:read')
  ) {
    return NextResponse.json(
      { error: 'Insufficient permissions: requires briefs:read, briefs:write, strategy:read' },
      { status: 403 },
    )
  }

  const supabase = createAdminClient()
  const providerRunId = request.headers.get('x-paperclip-run-id')

  // 1. Fetch pending human-requested briefs, urgent first
  const { data: pendingBriefs, error: briefsErr } = await supabase
    .from('briefs')
    .select('*')
    .eq('organization_id', auth.organizationId)
    .eq('source', 'human_request')
    .eq('status', 'pending')
    .order('priority', { ascending: false }) // 'urgent' > 'normal' alphabetically, so desc puts urgent first
    .order('created_at', { ascending: true })

  if (briefsErr) {
    console.error('[briefs/enrich] briefs query error:', briefsErr)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (!pendingBriefs || pendingBriefs.length === 0) {
    return NextResponse.json({
      status: 'no_action',
      message: 'No pending human-requested briefs to enrich.',
      enriched_count: 0,
    })
  }

  // 2. Load content pillars for auto-matching
  const { data: pillars, error: pillarsErr } = await supabase
    .from('content_pillars')
    .select('*')
    .eq('organization_id', auth.organizationId)
    .order('sort_order')

  if (pillarsErr) {
    console.error('[briefs/enrich] pillars query error:', pillarsErr)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const orgPillars = (pillars ?? []) as ContentPillar[]

  // 3. Load available research items for attaching references
  const { data: researchItems, error: researchErr } = await supabase
    .from('research_pool')
    .select('*')
    .eq('organization_id', auth.organizationId)
    .eq('status', 'new')
    .order('relevance_score', { ascending: false, nullsFirst: false })

  if (researchErr) {
    console.error('[briefs/enrich] research_pool error:', researchErr)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const availableResearch = researchItems ?? []

  // 4. Enrich each brief
  const enrichedBriefs: Array<Record<string, unknown>> = []

  for (const brief of pendingBriefs) {
    // Auto-assign pillar if not already set
    let pillarId = brief.pillar_id
    if (!pillarId && orgPillars.length > 0) {
      const matchableText = buildMatchableText({ title: brief.angle, raw_content: brief.voice_notes })
      const match = matchPillar(matchableText, orgPillars)
      if (match) {
        pillarId = match.pillar.id
      }
    }

    // Find relevant research items for this brief's topic
    const briefText = `${brief.angle} ${brief.voice_notes ?? ''}`.toLowerCase()
    const briefWords = briefText.split(/\s+/).filter((w) => w.length > 3)

    const matchingResearch = availableResearch
      .filter((r) => {
        // Match research by pillar or keyword overlap
        if (pillarId && r.pillar_id === pillarId) return true
        const researchText = `${r.title} ${r.raw_content ?? ''}`.toLowerCase()
        return briefWords.some((word) => researchText.includes(word))
      })
      .slice(0, 3) // Attach up to 3 relevant research items

    const researchRefs = [
      ...brief.research_refs,
      ...matchingResearch.map((r) => r.id),
    ]
    // Deduplicate
    const uniqueRefs = [...new Set(researchRefs)]

    // Update the brief with enrichment
    const { data: updated, error: updateErr } = await supabase
      .from('briefs')
      .update({
        pillar_id: pillarId,
        research_refs: uniqueRefs,
        status: 'in_review',
      })
      .eq('id', brief.id)
      .select()
      .single()

    if (updateErr) {
      console.error(`[briefs/enrich] update error for brief ${brief.id}:`, updateErr)
      continue
    }

    enrichedBriefs.push(updated)
  }

  // 5. Log activity
  logAgentActivity({
    organizationId: auth.organizationId,
    agentId: auth.agentId,
    postId: null,
    actionType: 'draft_created',
    metadata: {
      entity: 'brief_enrichment',
      enriched_count: enrichedBriefs.length,
      total_pending: pendingBriefs.length,
    },
    providerMetadata: providerRunId ? { provider_run_id: providerRunId } : undefined,
  })

  return NextResponse.json({
    status: 'enriched',
    enriched_count: enrichedBriefs.length,
    briefs: enrichedBriefs,
  })
}
