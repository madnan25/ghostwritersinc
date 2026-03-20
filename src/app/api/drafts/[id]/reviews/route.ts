import { NextRequest, NextResponse } from 'next/server'
import {
  authenticateAgent,
  canAccessAgentUserRecord,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

/** GET /api/drafts/:id/reviews — fetch review history for a draft */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'drafts-reviews-read'), { maxRequests: 60 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'reviews:read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: reviews:read access required' },
      { status: 403 }
    )
  }

  const { id } = await params
  const supabase = createAdminClient()
  const { data: post } = await supabase
    .from('posts')
    .select('organization_id, user_id')
    .eq('id', id)
    .maybeSingle()

  if (!post || !canAccessAgentUserRecord(auth, post)) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const { data: events, error } = await supabase
    .from('review_events')
    .select('*')
    .eq('post_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(events ?? [])
}
