/**
 * Series Processing — helpers for Strategist series sequencing,
 * Scribe context injection, and series debrief generation.
 *
 * Sprint 6 — LIN-533
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { SeriesBriefWithPost, SeriesDebrief } from '@/lib/types'

// ---------------------------------------------------------------------------
// Strategist: fetch series briefs in part order
// ---------------------------------------------------------------------------

/**
 * Fetch all briefs for a given series, joined with their linked post data,
 * ordered by series_part_number ascending.
 */
export async function getSeriesBriefsWithPosts(
  supabase: SupabaseClient,
  seriesId: string,
  organizationId: string,
): Promise<SeriesBriefWithPost[]> {
  const { data: briefs, error } = await supabase
    .from('briefs')
    .select('id, series_id, series_part_number, angle, status, priority, pillar_id, research_refs, voice_notes, publish_at')
    .eq('series_id', seriesId)
    .eq('organization_id', organizationId)
    .order('series_part_number', { ascending: true })

  if (error || !briefs) {
    console.error('[series-processing] briefs query error:', error)
    return []
  }

  const briefIds = briefs.map((b) => b.id)
  const postsByBriefId = new Map<string, { id: string; content: string; status: string; published_at: string | null }>()

  if (briefIds.length > 0) {
    const { data: posts } = await supabase
      .from('posts')
      .select('id, brief_id, content, status, published_at')
      .in('brief_id', briefIds)
      .is('archived_at', null)

    for (const post of posts ?? []) {
      if (post.brief_id) {
        postsByBriefId.set(post.brief_id, {
          id: post.id,
          content: post.content,
          status: post.status,
          published_at: post.published_at,
        })
      }
    }
  }

  return briefs.map((b) => {
    const post = postsByBriefId.get(b.id)
    return {
      id: b.id,
      series_id: b.series_id,
      series_part_number: b.series_part_number,
      angle: b.angle,
      status: b.status,
      priority: b.priority,
      pillar_id: b.pillar_id,
      research_refs: b.research_refs,
      voice_notes: b.voice_notes,
      publish_at: b.publish_at,
      post_id: post?.id ?? null,
      post_content: post?.content ?? null,
      post_status: post?.status ?? null,
      post_published_at: post?.published_at ?? null,
    }
  })
}

// ---------------------------------------------------------------------------
// Strategist: determine which series brief is next to process
// ---------------------------------------------------------------------------

/**
 * Given series briefs in order, find the next brief eligible for Strategist
 * processing. Returns null if no brief is ready (all done or blocked by
 * a prior part not yet in_review).
 *
 * Rule: Part N can only be processed when Part N-1 has status >= in_review
 * (i.e. in_review, revision_requested, or done).
 */
export function findNextProcessableBrief(
  seriesBriefs: SeriesBriefWithPost[],
): SeriesBriefWithPost | null {
  const PROCESSED_STATUSES = new Set(['in_review', 'revision_requested', 'done'])

  for (const brief of seriesBriefs) {
    // Skip already-processed briefs
    if (PROCESSED_STATUSES.has(brief.status) || brief.status === 'done') {
      continue
    }

    // For part 1, always eligible if still pending/pending_strategist
    if (brief.series_part_number === 1 && (brief.status === 'pending' || brief.status === 'pending_strategist')) {
      return brief
    }

    // For part N, check if part N-1 is at least in_review
    if (brief.series_part_number > 1 && (brief.status === 'pending' || brief.status === 'pending_strategist')) {
      const priorPart = seriesBriefs.find(
        (b) => b.series_part_number === brief.series_part_number - 1,
      )
      if (priorPart && PROCESSED_STATUSES.has(priorPart.status)) {
        return brief
      }
      // Prior part not ready — this brief is blocked
      return null
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Strategist: build series context for brief enrichment
// ---------------------------------------------------------------------------

/**
 * Build enrichment context that the Strategist adds to a series brief.
 * Includes series title, prior parts' topics, and narrative arc positioning.
 */
export function buildSeriesEnrichmentContext(
  seriesTitle: string,
  totalParts: number,
  currentPartNumber: number,
  priorParts: Array<{ part_number: number; angle: string; status: string }>,
): string {
  const lines: string[] = [
    `Series: "${seriesTitle}" — Part ${currentPartNumber} of ${totalParts}`,
  ]

  if (priorParts.length > 0) {
    lines.push('')
    lines.push('Prior parts:')
    for (const part of priorParts) {
      lines.push(`  Part ${part.part_number}: ${part.angle} [${part.status}]`)
    }
  }

  // Narrative arc positioning
  lines.push('')
  if (currentPartNumber === 1) {
    lines.push('Position: Opening — introduce the series theme and hook the audience.')
  } else if (currentPartNumber === totalParts) {
    lines.push('Position: Finale — wrap up the series arc, call to action, and tie back to earlier parts.')
  } else {
    const progress = currentPartNumber / totalParts
    if (progress <= 0.4) {
      lines.push('Position: Early — build on the foundation, deepen the narrative.')
    } else if (progress <= 0.7) {
      lines.push('Position: Middle — peak engagement, introduce the strongest insight or argument.')
    } else {
      lines.push('Position: Late — begin converging themes, set up the conclusion.')
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Scribe: build prior parts context for draft writing
// ---------------------------------------------------------------------------

/**
 * Build context for Scribe when writing a series part. Includes prior parts'
 * approved/published text so Scribe can maintain continuity.
 *
 * Only includes parts with approved or published posts.
 */
export function buildScribeSeriesContext(
  seriesTitle: string,
  totalParts: number,
  currentPartNumber: number,
  priorParts: SeriesBriefWithPost[],
): string | null {
  if (currentPartNumber === 1 || priorParts.length === 0) {
    return null
  }

  const APPROVED_STATUSES = new Set(['approved', 'scheduled', 'published', 'pending_review'])
  const partsWithContent = priorParts.filter(
    (p) =>
      p.series_part_number < currentPartNumber &&
      p.post_content &&
      p.post_status &&
      APPROVED_STATUSES.has(p.post_status),
  )

  if (partsWithContent.length === 0) {
    return null
  }

  const lines: string[] = [
    `This is Part ${currentPartNumber} of ${totalParts} in the series "${seriesTitle}".`,
    '',
    'Here are the approved prior parts:',
  ]

  for (const part of partsWithContent) {
    lines.push('')
    lines.push(`--- Part ${part.series_part_number}: ${part.angle} ---`)
    lines.push(part.post_content!)
  }

  lines.push('')
  lines.push(
    'Maintain continuity with the prior parts: reference earlier themes, build on established arguments, and avoid repeating content.',
  )

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Strategist: fetch active series with pending briefs for an org
// ---------------------------------------------------------------------------

/**
 * Fetch all active series for an organization that have at least one
 * pending brief, suitable for Strategist heartbeat processing.
 */
export async function getActiveSeriesWithPendingBriefs(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Array<{ series_id: string; series_title: string; total_parts: number; briefs: SeriesBriefWithPost[] }>> {
  // Get active series
  const { data: seriesList, error: seriesErr } = await supabase
    .from('content_series')
    .select('id, title, total_parts')
    .eq('organization_id', organizationId)
    .eq('status', 'active')

  if (seriesErr || !seriesList) {
    console.error('[series-processing] series query error:', seriesErr)
    return []
  }

  const results: Array<{ series_id: string; series_title: string; total_parts: number; briefs: SeriesBriefWithPost[] }> = []

  for (const series of seriesList) {
    const briefs = await getSeriesBriefsWithPosts(supabase, series.id, organizationId)
    const hasPending = briefs.some((b) => b.status === 'pending' || b.status === 'pending_strategist')
    if (hasPending) {
      results.push({
        series_id: series.id,
        series_title: series.title,
        total_parts: series.total_parts,
        briefs,
      })
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Debrief: generate performance debrief for a completed series
// ---------------------------------------------------------------------------

/**
 * Generate a performance debrief for a completed series.
 * Requires performance data on at least 50% of parts.
 * Returns null if insufficient data.
 */
export async function generateSeriesDebrief(
  supabase: SupabaseClient,
  seriesId: string,
  organizationId: string,
): Promise<SeriesDebrief | null> {
  // Fetch series metadata
  const { data: series, error: seriesErr } = await supabase
    .from('content_series')
    .select('id, title, total_parts, status')
    .eq('id', seriesId)
    .eq('organization_id', organizationId)
    .single()

  if (seriesErr || !series) {
    console.error('[series-processing] debrief: series not found', seriesErr)
    return null
  }

  // Fetch briefs with posts
  const briefs = await getSeriesBriefsWithPosts(supabase, seriesId, organizationId)

  // Fetch performance metrics for all linked posts
  const postIds = briefs.map((b) => b.post_id).filter(Boolean) as string[]
  if (postIds.length === 0) return null

  const { data: metrics } = await supabase
    .from('post_metrics')
    .select('post_id, impressions, likes, comments, shares')
    .in('post_id', postIds)

  const metricsByPostId = new Map<string, { impressions: number; likes: number; comments: number; shares: number }>()
  for (const m of metrics ?? []) {
    metricsByPostId.set(m.post_id, m)
  }

  // Build part-level data
  const parts: SeriesDebrief['parts'] = []
  for (const brief of briefs) {
    const m = brief.post_id ? metricsByPostId.get(brief.post_id) : null
    parts.push({
      part_number: brief.series_part_number,
      brief_id: brief.id,
      post_id: brief.post_id,
      status: brief.post_status ?? brief.status,
      impressions: m?.impressions ?? 0,
      reactions: m?.likes ?? 0,
      comments_count: m?.comments ?? 0,
      reposts: m?.shares ?? 0,
      engagement: (m?.likes ?? 0) + (m?.comments ?? 0) + (m?.shares ?? 0),
    })
  }

  const partsWithData = parts.filter((p) => p.impressions > 0 || p.engagement > 0)

  // Require 50% of parts to have data
  if (partsWithData.length < Math.ceil(series.total_parts / 2)) {
    return null
  }

  // Compute aggregates
  const totalEngagement = partsWithData.reduce((sum, p) => sum + p.engagement, 0)
  const avgEngagement = partsWithData.length > 0 ? totalEngagement / partsWithData.length : 0

  // Find best/worst
  let bestPart: number | null = null
  let worstPart: number | null = null
  let maxEng = -1
  let minEng = Infinity

  for (const p of partsWithData) {
    if (p.engagement > maxEng) {
      maxEng = p.engagement
      bestPart = p.part_number
    }
    if (p.engagement < minEng) {
      minEng = p.engagement
      worstPart = p.part_number
    }
  }

  // Compute engagement trend (linear comparison of first half vs second half)
  const midpoint = Math.ceil(partsWithData.length / 2)
  const firstHalf = partsWithData.slice(0, midpoint)
  const secondHalf = partsWithData.slice(midpoint)
  const firstAvg = firstHalf.reduce((s, p) => s + p.engagement, 0) / (firstHalf.length || 1)
  const secondAvg = secondHalf.reduce((s, p) => s + p.engagement, 0) / (secondHalf.length || 1)

  let engagementTrend: 'increasing' | 'decreasing' | 'stable' = 'stable'
  const trendThreshold = 0.15
  if (secondAvg > firstAvg * (1 + trendThreshold)) {
    engagementTrend = 'increasing'
  } else if (secondAvg < firstAvg * (1 - trendThreshold)) {
    engagementTrend = 'decreasing'
  }

  return {
    generated_at: new Date().toISOString(),
    series_id: seriesId,
    series_title: series.title,
    total_parts: series.total_parts,
    parts_with_data: partsWithData.length,
    parts,
    best_performing_part: bestPart,
    worst_performing_part: worstPart,
    avg_engagement: Math.round(avgEngagement * 100) / 100,
    engagement_trend: engagementTrend,
  }
}
