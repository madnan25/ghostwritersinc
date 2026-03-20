import { NextRequest, NextResponse } from 'next/server'
import {
  authenticateAgent,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

/** DELETE /api/strategist/memories/[id] — remove a stale memory (user-scoped) */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'write'), { maxRequests: 20 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'strategy:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: strategy:write required' },
      { status: 403 }
    )
  }

  const { id } = await params

  const supabase = createAdminClient()
  const { error, count } = await supabase
    .from('strategist_memories')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('user_id', auth.userId)
    .eq('organization_id', auth.organizationId)

  if (error) {
    console.error('[strategist/memories/[id]] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (count === 0) {
    return NextResponse.json({ error: 'Memory not found' }, { status: 404 })
  }

  return new NextResponse(null, { status: 204 })
}
