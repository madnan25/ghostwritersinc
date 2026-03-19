import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  authenticateAgent,
  canAccessAgentOrgRecord,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
  isSharedOrgAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

const UpdateResearchPoolSchema = z.object({
  title: z.string().min(1).optional(),
  source_url: z.string().url().nullable().optional(),
  source_type: z.string().optional(),
  pillar_id: z.string().uuid().nullable().optional(),
  relevance_score: z.number().min(0).max(1).nullable().optional(),
  raw_content: z.string().nullable().optional(),
  status: z.enum(['new', 'consumed']).optional(),
})

/** GET /api/research-pool/:id — get a single research pool item */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'read'), { maxRequests: 60 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'research:read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: research:read access required' },
      { status: 403 }
    )
  }

  const { id } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('research_pool')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[research-pool] DB error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (!data || !canAccessAgentOrgRecord(auth, data)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

/** PATCH /api/research-pool/:id — update a research pool item */
export async function PATCH(
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = UpdateResearchPoolSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Verify the item exists and belongs to the agent's org
  const { data: existing } = await supabase
    .from('research_pool')
    .select('organization_id, created_by_agent_id')
    .eq('id', id)
    .maybeSingle()

  if (!existing || !canAccessAgentOrgRecord(auth, existing)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Non-shared agents can only modify their own items
  if (!isSharedOrgAgentContext(auth) && existing.created_by_agent_id !== auth.agentId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('research_pool')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[research-pool] DB error updating:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data)
}

/** DELETE /api/research-pool/:id — delete a research pool item */
export async function DELETE(
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

  const { data: existing } = await supabase
    .from('research_pool')
    .select('organization_id, created_by_agent_id')
    .eq('id', id)
    .maybeSingle()

  if (!existing || !canAccessAgentOrgRecord(auth, existing)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Non-shared agents can only delete their own items
  if (!isSharedOrgAgentContext(auth) && existing.created_by_agent_id !== auth.agentId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('research_pool')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[research-pool] DB error deleting:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
