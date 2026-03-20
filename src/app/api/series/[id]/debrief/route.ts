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
import { generateSeriesDebrief } from '@/lib/series-processing'

/**
 * POST /api/series/:id/debrief — Generate series performance debrief.
 *
 * Called by Strategist after all parts of a series are published.
 * Compares performance across parts, identifies trends, and stores
 * the debrief in the content_series.debrief column.
 *
 * Requirements:
 * - Series must exist and belong to the org
 * - Performance data on at least 50% of parts
 * - Returns 422 if insufficient data
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'series-debrief-write'), { maxRequests: 5 })
  if (limited) return limited

  if (
    !hasAgentPermission(auth.permissions, 'strategy:read') ||
    !hasAgentPermission(auth.permissions, 'briefs:read')
  ) {
    return NextResponse.json(
      { error: 'Insufficient permissions: requires strategy:read, briefs:read' },
      { status: 403 },
    )
  }

  const { id: seriesId } = await params

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(seriesId)) {
    return NextResponse.json({ error: 'Invalid series ID' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const providerRunId = request.headers.get('x-paperclip-run-id')

  // Verify series exists and belongs to org
  const { data: series, error: seriesErr } = await supabase
    .from('content_series')
    .select('id, status, organization_id')
    .eq('id', seriesId)
    .eq('organization_id', auth.organizationId)
    .single()

  if (seriesErr || !series) {
    return NextResponse.json({ error: 'Series not found' }, { status: 404 })
  }

  // Generate the debrief
  const debrief = await generateSeriesDebrief(supabase, seriesId, auth.organizationId)

  if (!debrief) {
    return NextResponse.json(
      {
        error: 'Insufficient performance data',
        message: 'Debrief requires performance metrics on at least 50% of series parts.',
      },
      { status: 422 },
    )
  }

  // Store debrief in content_series.debrief column
  const { error: updateErr } = await supabase
    .from('content_series')
    .update({ debrief })
    .eq('id', seriesId)

  if (updateErr) {
    console.error('[series/debrief] store error:', updateErr)
    return NextResponse.json({ error: 'Failed to store debrief' }, { status: 500 })
  }

  // Log activity
  logAgentActivity({
    organizationId: auth.organizationId,
    agentId: auth.agentId,
    postId: null,
    actionType: 'status_changed',
    metadata: {
      entity: 'series_debrief',
      series_id: seriesId,
      parts_with_data: debrief.parts_with_data,
      total_parts: debrief.total_parts,
      engagement_trend: debrief.engagement_trend,
    },
    providerMetadata: providerRunId ? { provider_run_id: providerRunId } : undefined,
  })

  return NextResponse.json({
    status: 'debrief_generated',
    debrief,
  })
}
