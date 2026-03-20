import { NextRequest, NextResponse } from 'next/server'
import {
  authenticateAgent,
  canAccessAgentUserRecord,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
  isSharedOrgAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { isValidUuid } from '@/lib/validation'

/**
 * POST /api/posts/:id/archive — soft-archive a post.
 *
 * Sets archived_at to the current timestamp without deleting content.
 * Idempotent: re-archiving an already-archived post is a no-op (returns 200).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'archive-write'), { maxRequests: 20 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'posts:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: posts:write access required' },
      { status: 403 }
    )
  }

  const { id } = await params
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid post ID format' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Verify post exists and belongs to this agent's scope
  const { data: post } = await supabase
    .from('posts')
    .select('organization_id, user_id, archived_at')
    .eq('id', id)
    .maybeSingle()

  if (!post || !canAccessAgentUserRecord(auth, post)) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  // Already archived — idempotent success
  if (post.archived_at) {
    return NextResponse.json({ archived: true, archived_at: post.archived_at })
  }

  let archiveQuery = supabase
    .from('posts')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', auth.organizationId)

  if (!isSharedOrgAgentContext(auth)) {
    archiveQuery = archiveQuery.eq('user_id', auth.userId)
  }

  const { data, error } = await archiveQuery
    .select('id, archived_at, freshness_type, expiry_date')
    .single()

  if (error) {
    console.error('[posts/archive] DB error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ archived: true, ...data })
}
