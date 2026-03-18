import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  authenticateAgent,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
  isSharedOrgAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

const CreateStrategyDocumentSchema = z.object({
  title: z.string().min(1).max(180),
  body: z.string().default(''),
  summary: z.string().nullable().optional(),
  pillar_id: z.string().uuid().nullable().optional(),
})

export async function GET(request: NextRequest) {
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

  const supabase = createAdminClient()
  let query = supabase
    .from('strategy_documents')
    .select('*')
    .eq('organization_id', auth.organizationId)
    .order('updated_at', { ascending: false })

  if (!isSharedOrgAgentContext(auth)) {
    query = query.eq('user_id', auth.userId)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateStrategyDocumentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('strategy_documents')
    .insert({
      organization_id: auth.organizationId,
      user_id: auth.userId,
      title: parsed.data.title,
      body: parsed.data.body,
      summary: parsed.data.summary ?? null,
      pillar_id: parsed.data.pillar_id ?? null,
      created_by_agent_id: auth.agentId,
      updated_by_agent_id: auth.agentId,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
