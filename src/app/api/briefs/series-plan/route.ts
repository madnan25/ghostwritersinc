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
  getActiveSeriesWithPendingBriefs,
  findNextProcessableBrief,
  buildSeriesEnrichmentContext,
} from '@/lib/series-processing'
import {
  buildMatchableText,
  matchPillar,
} from '@/lib/research-scoring'
import type { ContentPillar } from '@/lib/types'

/**
 * POST /api/briefs/series-plan — Strategist series sequencing endpoint.
 *
 * Processes series briefs in part order:
 * - Part N only processed after Part N-1 is at least `in_review`
 * - Enriches each part with series context (title, prior parts, narrative arc)
 * - Auto-assigns pillar and attaches research (like standard enrich)
 * - When all series parts are blocked, returns no_action so Strategist
 *   can proceed with non-series work
 *
 * Urgent series briefs are processed first but still respect part ordering.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'briefs-series-plan-write'), { maxRequests: 5 })
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

  // 1. Find active series with pending briefs
  const activeSeries = await getActiveSeriesWithPendingBriefs(supabase, auth.organizationId)

  if (activeSeries.length === 0) {
    return NextResponse.json({
      status: 'no_action',
      message: 'No active series with pending briefs.',
      series_processed: 0,
      briefs_enriched: 0,
    })
  }

  // 2. Sort series: urgent briefs first
  activeSeries.sort((a, b) => {
    const aHasUrgent = a.briefs.some((br) => br.priority === 'urgent' && br.status === 'pending')
    const bHasUrgent = b.briefs.some((br) => br.priority === 'urgent' && br.status === 'pending')
    if (aHasUrgent && !bHasUrgent) return -1
    if (!aHasUrgent && bHasUrgent) return 1
    return 0
  })

  // 3. Load pillars and research for enrichment
  const { data: pillars } = await supabase
    .from('content_pillars')
    .select('*')
    .eq('organization_id', auth.organizationId)
    .order('sort_order')

  const orgPillars = (pillars ?? []) as ContentPillar[]

  const { data: researchItems } = await supabase
    .from('research_pool')
    .select('*')
    .eq('organization_id', auth.organizationId)
    .eq('status', 'new')
    .order('relevance_score', { ascending: false, nullsFirst: false })

  const availableResearch = researchItems ?? []

  // 4. Process each series
  const enrichedBriefs: Array<Record<string, unknown>> = []
  const blockedSeries: string[] = []

  for (const series of activeSeries) {
    const nextBrief = findNextProcessableBrief(series.briefs)

    if (!nextBrief) {
      blockedSeries.push(series.series_id)
      continue
    }

    // Build series enrichment context
    const priorParts = series.briefs
      .filter((b) => b.series_part_number < nextBrief.series_part_number)
      .map((b) => ({
        part_number: b.series_part_number,
        angle: b.angle,
        status: b.status,
      }))

    const seriesContext = buildSeriesEnrichmentContext(
      series.series_title,
      series.total_parts,
      nextBrief.series_part_number,
      priorParts,
    )

    // Auto-assign pillar if not set
    let pillarId = nextBrief.pillar_id
    if (!pillarId && orgPillars.length > 0) {
      const matchableText = buildMatchableText({ title: nextBrief.angle, raw_content: nextBrief.voice_notes })
      const match = matchPillar(matchableText, orgPillars)
      if (match) {
        pillarId = match.pillar.id
      }
    }

    // Find relevant research
    const briefText = `${nextBrief.angle} ${nextBrief.voice_notes ?? ''}`.toLowerCase()
    const briefWords = briefText.split(/\s+/).filter((w) => w.length > 3)

    const matchingResearch = availableResearch
      .filter((r) => {
        if (pillarId && r.pillar_id === pillarId) return true
        const researchText = `${r.title} ${r.raw_content ?? ''}`.toLowerCase()
        return briefWords.some((word) => researchText.includes(word))
      })
      .slice(0, 3)

    const researchRefs = [
      ...nextBrief.research_refs,
      ...matchingResearch.map((r) => r.id),
    ]
    const uniqueRefs = [...new Set(researchRefs)]

    // Update the brief: enrich with series context, pillar, and research
    const { data: updated, error: updateErr } = await supabase
      .from('briefs')
      .update({
        pillar_id: pillarId,
        research_refs: uniqueRefs,
        voice_notes: seriesContext,
        status: 'in_review',
      })
      .eq('id', nextBrief.id)
      .select()
      .single()

    if (updateErr) {
      console.error(`[briefs/series-plan] update error for brief ${nextBrief.id}:`, updateErr)
      continue
    }

    enrichedBriefs.push({
      ...updated,
      series_id: series.series_id,
      series_title: series.series_title,
      series_part_number: nextBrief.series_part_number,
      series_context: seriesContext,
    })
  }

  // 5. Log activity
  logAgentActivity({
    organizationId: auth.organizationId,
    agentId: auth.agentId,
    postId: null,
    actionType: 'draft_created',
    metadata: {
      entity: 'series_plan',
      series_checked: activeSeries.length,
      briefs_enriched: enrichedBriefs.length,
      series_blocked: blockedSeries.length,
    },
    providerMetadata: providerRunId ? { provider_run_id: providerRunId } : undefined,
  })

  return NextResponse.json({
    status: enrichedBriefs.length > 0 ? 'enriched' : 'no_action',
    message:
      enrichedBriefs.length > 0
        ? `Enriched ${enrichedBriefs.length} series brief(s).`
        : 'All series are blocked waiting for prior parts to be reviewed.',
    series_checked: activeSeries.length,
    briefs_enriched: enrichedBriefs.length,
    series_blocked: blockedSeries,
    briefs: enrichedBriefs,
  })
}
