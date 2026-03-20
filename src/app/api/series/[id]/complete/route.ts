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
import { isValidUuid } from '@/lib/validation'

/**
 * POST /api/series/:id/complete — complete a series.
 *
 * Only allowed when all brief stubs are in status 'done'.
 * Sets completed_at timestamp.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid series ID format' }, { status: 400 })
  }

  let organizationId: string

  const hasBearer = request.headers.get('authorization')?.startsWith('Bearer ')
  if (hasBearer) {
    const auth = await authenticateAgent(request)
    if (!isAgentContext(auth)) return auth

    const limited = await rateLimit(getAgentRateLimitKey(auth, 'series-write'), { maxRequests: 10 })
    if (limited) return limited

    if (!hasAgentPermission(auth.permissions, 'series:write')) {
      return NextResponse.json(
        { error: 'Insufficient permissions: series:write access required' },
        { status: 403 }
      )
    }
    organizationId = auth.organizationId
  } else {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: dbUser } = await admin
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const limited = await rateLimit(`user:series:write:${user.id}`, { maxRequests: 10 })
    if (limited) return limited

    organizationId = dbUser.organization_id
  }

  const supabase = createAdminClient()

  const { data: series } = await supabase
    .from('content_series')
    .select('id, organization_id, status, total_parts')
    .eq('id', id)
    .maybeSingle()

  if (!series || series.organization_id !== organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (series.status === 'cancelled' || series.status === 'completed') {
    return NextResponse.json(
      { error: `Series is already ${series.status}` },
      { status: 422 }
    )
  }

  // Validate all briefs are done
  const { data: pendingBriefs, error: checkError } = await supabase
    .from('briefs')
    .select('id')
    .eq('series_id', id)
    .not('status', 'eq', 'done')

  if (checkError) {
    console.error('[series/complete] DB error checking briefs:', checkError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (pendingBriefs && pendingBriefs.length > 0) {
    return NextResponse.json(
      {
        error: `Cannot complete series: ${pendingBriefs.length} brief(s) are not yet done`,
      },
      { status: 422 }
    )
  }

  const now = new Date().toISOString()
  const { data: updated, error } = await supabase
    .from('content_series')
    .update({ status: 'completed', completed_at: now })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[series/complete] DB error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(updated)
}
