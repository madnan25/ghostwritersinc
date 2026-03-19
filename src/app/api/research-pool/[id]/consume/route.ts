import { NextRequest, NextResponse } from 'next/server'
import {
  authenticateAgent,
  canAccessAgentOrgRecord,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAgentActivity } from '@/lib/agent-activity'
import { rateLimit } from '@/lib/rate-limit'

/**
 * POST /api/research-pool/:id/consume — transition item from new → consumed.
 * Used by the Strategist agent when a research item is used in a brief.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'write'), { maxRequests: 10 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'research:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: research:write access required' },
      { status: 403 }
    )
  }

  const { id } = await params
  const supabase = createAdminClient()

  // Fetch the item
  const { data: existing, error: fetchError } = await supabase
    .from('research_pool')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    console.error('[research-pool/consume] DB error:', fetchError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (!existing || !canAccessAgentOrgRecord(auth, existing)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (existing.status === 'consumed') {
    return NextResponse.json(
      { error: 'Item is already consumed' },
      { status: 409 }
    )
  }

  // Transition to consumed
  const { data, error } = await supabase
    .from('research_pool')
    .update({ status: 'consumed', consumed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[research-pool/consume] DB error updating:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const providerRunId = request.headers.get('x-paperclip-run-id')
  logAgentActivity({
    organizationId: auth.organizationId,
    agentId: auth.agentId,
    postId: null,
    actionType: 'status_changed',
    metadata: {
      entity: 'research_pool',
      item_id: id,
      from_status: 'new',
      to_status: 'consumed',
    },
    providerMetadata: providerRunId ? { provider_run_id: providerRunId } : undefined,
  })

  return NextResponse.json(data)
}
