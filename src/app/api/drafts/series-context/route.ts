import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  authenticateAgent,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import {
  getSeriesBriefsWithPosts,
  buildScribeSeriesContext,
} from '@/lib/series-processing'

const SeriesContextSchema = z.object({
  brief_id: z.string().uuid('brief_id must be a valid UUID'),
})

/**
 * POST /api/drafts/series-context — Scribe series context endpoint.
 *
 * Given a brief_id that belongs to a series, returns the prior parts'
 * approved text so Scribe can maintain continuity when writing.
 *
 * For Part 1 or non-series briefs, returns null context (Scribe writes normally).
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'drafts-series-context-read'), { maxRequests: 30 })
  if (limited) return limited

  if (
    !hasAgentPermission(auth.permissions, 'briefs:read') ||
    !hasAgentPermission(auth.permissions, 'drafts:read') ||
    !hasAgentPermission(auth.permissions, 'posts:read')
  ) {
    return NextResponse.json(
      { error: 'Insufficient permissions: requires briefs:read, drafts:read, posts:read' },
      { status: 403 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = SeriesContextSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()

  // 1. Look up the brief and check if it's part of a series
  const { data: brief, error: briefErr } = await supabase
    .from('briefs')
    .select('id, series_id, series_part_number, angle, organization_id')
    .eq('id', parsed.data.brief_id)
    .eq('organization_id', auth.organizationId)
    .single()

  if (briefErr || !brief) {
    return NextResponse.json({ error: 'Brief not found' }, { status: 404 })
  }

  // Non-series brief — no context needed
  if (!brief.series_id || !brief.series_part_number) {
    return NextResponse.json({
      brief_id: brief.id,
      is_series: false,
      series_context: null,
    })
  }

  // Part 1 — no prior context
  if (brief.series_part_number === 1) {
    return NextResponse.json({
      brief_id: brief.id,
      is_series: true,
      series_part_number: 1,
      series_context: null,
      message: 'Part 1 of series — no prior context available.',
    })
  }

  // 2. Fetch series metadata
  const { data: series, error: seriesErr } = await supabase
    .from('content_series')
    .select('id, title, total_parts')
    .eq('id', brief.series_id)
    .single()

  if (seriesErr || !series) {
    return NextResponse.json({ error: 'Series not found' }, { status: 404 })
  }

  // 3. Fetch all series briefs with their posts
  const seriesBriefs = await getSeriesBriefsWithPosts(
    supabase,
    brief.series_id,
    auth.organizationId,
  )

  // 4. Build Scribe context from prior parts
  const context = buildScribeSeriesContext(
    series.title,
    series.total_parts,
    brief.series_part_number,
    seriesBriefs,
  )

  return NextResponse.json({
    brief_id: brief.id,
    is_series: true,
    series_id: series.id,
    series_title: series.title,
    series_part_number: brief.series_part_number,
    total_parts: series.total_parts,
    series_context: context,
    prior_parts_count: seriesBriefs.filter(
      (b) => b.series_part_number < brief.series_part_number && b.post_content,
    ).length,
  })
}
