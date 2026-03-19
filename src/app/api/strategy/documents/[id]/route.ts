import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  authenticateAgent,
  canAccessAgentUserRecord,
  getAgentFkId,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

const UpdateStrategyDocumentSchema = z.object({
  title: z.string().min(1).max(180).optional(),
  body: z.string().optional(),
  summary: z.string().nullable().optional(),
  pillar_id: z.string().uuid().nullable().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'read'), { maxRequests: 60 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'strategy:read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: strategy:read access required' },
      { status: 403 }
    )
  }

  const { id } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('strategy_documents')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (!data || !canAccessAgentUserRecord(auth, data)) {
    return NextResponse.json({ error: 'Strategy document not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'write'), { maxRequests: 20 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'strategy:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: strategy:write access required' },
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

  const parsed = UpdateStrategyDocumentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { data: existing } = await supabase
    .from('strategy_documents')
    .select('organization_id, user_id')
    .eq('id', id)
    .maybeSingle()

  if (!existing || !canAccessAgentUserRecord(auth, existing)) {
    return NextResponse.json({ error: 'Strategy document not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('strategy_documents')
    .update({
      ...parsed.data,
      updated_by_agent_id: getAgentFkId(auth),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
