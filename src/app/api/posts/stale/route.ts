import { NextRequest, NextResponse } from 'next/server'
import {
  authenticateAgent,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

/**
 * GET /api/posts/stale — list stale posts for the agent's organization.
 *
 * Returns posts where:
 *   - time_sensitive AND expiry_date < now() AND not archived
 *   - date_locked AND expiry_date < now() + 3 days AND not archived
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'stale-read'), {
    maxRequests: 30,
  })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'posts:read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: posts:read access required' },
      { status: 403 }
    )
  }

  const supabase = createAdminClient()

  // Fetch time_sensitive posts past expiry
  const { data: timeSensitive, error: tsError } = await supabase
    .from('posts')
    .select('id, title, angle, status, freshness_type, expiry_date, created_at, updated_at')
    .eq('organization_id', auth.organizationId)
    .eq('freshness_type', 'time_sensitive')
    .lt('expiry_date', new Date().toISOString())
    .is('archived_at', null)
    .order('expiry_date', { ascending: true })

  if (tsError) {
    console.error('[posts/stale] DB error (time_sensitive):', tsError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Fetch date_locked posts expiring within 3 days
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
  const { data: dateLocked, error: dlError } = await supabase
    .from('posts')
    .select('id, title, angle, status, freshness_type, expiry_date, created_at, updated_at')
    .eq('organization_id', auth.organizationId)
    .eq('freshness_type', 'date_locked')
    .gt('expiry_date', new Date().toISOString())
    .lt('expiry_date', threeDaysFromNow)
    .is('archived_at', null)
    .order('expiry_date', { ascending: true })

  if (dlError) {
    console.error('[posts/stale] DB error (date_locked):', dlError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const posts = [...(timeSensitive ?? []), ...(dateLocked ?? [])]

  return NextResponse.json({
    stale_posts: posts,
    count: posts.length,
  })
}
