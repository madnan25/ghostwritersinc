import { NextRequest, NextResponse } from 'next/server'
import {
  authenticateAgent,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import {
  generateWhatsWorking,
  getPublishedPostsWithMetrics,
  saveWhatsWorking,
} from '@/lib/performance-analysis'

/**
 * GET /api/strategy/whats-working — retrieve the current "What's Working" summary.
 *
 * Supports both agent (Bearer token) and user (cookie session) auth.
 */
export async function GET(request: NextRequest) {
  const hasBearer = request.headers.get('authorization')?.startsWith('Bearer ')

  if (hasBearer) {
    return handleAgentGet(request)
  }
  return handleUserGet(request)
}

/**
 * POST /api/strategy/whats-working — regenerate the "What's Working" summary.
 *
 * Agent-only endpoint (requires strategy:read permission).
 * Regenerates from current post_performance data. Returns null if < 5 data points.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'whats-working-write'), { maxRequests: 5 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'strategy:read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: requires strategy:read' },
      { status: 403 },
    )
  }

  const supabase = createAdminClient()

  const postsWithMetrics = await getPublishedPostsWithMetrics(supabase, auth.organizationId)
  const summary = generateWhatsWorking(postsWithMetrics)

  if (!summary) {
    return NextResponse.json({
      status: 'insufficient_data',
      message: `Need at least 5 published posts with metrics. Currently have ${postsWithMetrics.length}.`,
      data_points: postsWithMetrics.length,
    })
  }

  const saved = await saveWhatsWorking(supabase, auth.userId, auth.organizationId, summary)

  if (!saved) {
    return NextResponse.json({ error: 'Failed to save summary' }, { status: 500 })
  }

  return NextResponse.json({
    status: 'generated',
    summary,
  })
}

// ---------------------------------------------------------------------------
// Agent GET handler
// ---------------------------------------------------------------------------

async function handleAgentGet(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'whats-working-read'), { maxRequests: 30 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'strategy:read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: requires strategy:read' },
      { status: 403 },
    )
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('strategy_config')
    .select('whats_working, whats_working_updated_at')
    .eq('user_id', auth.userId)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (error) {
    console.error('[whats-working] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({
    summary: data?.whats_working ?? null,
    updated_at: data?.whats_working_updated_at ?? null,
  })
}

// ---------------------------------------------------------------------------
// User GET handler
// ---------------------------------------------------------------------------

async function handleUserGet(_request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('strategy_config')
    .select('whats_working, whats_working_updated_at')
    .eq('user_id', user.id)
    .eq('organization_id', profile.organization_id)
    .maybeSingle()

  if (error) {
    console.error('[whats-working] user GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({
    summary: data?.whats_working ?? null,
    updated_at: data?.whats_working_updated_at ?? null,
  })
}
