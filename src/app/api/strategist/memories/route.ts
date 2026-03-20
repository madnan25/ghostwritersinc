import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  authenticateAgent,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

const MEMORY_TYPES = ['preference', 'episode', 'pattern', 'tacit'] as const
const SOURCE_TYPES = ['comment', 'observation', 'brief', 'manual'] as const

const CreateMemorySchema = z.object({
  type: z.enum(MEMORY_TYPES),
  entity: z.string().max(500).nullable().optional(),
  fact: z.string().min(1).max(10000),
  source_type: z.enum(SOURCE_TYPES).nullable().optional(),
  source_id: z.string().uuid().nullable().optional(),
  confidence: z.number().min(0).max(1).optional().default(1.0),
  expires_at: z.string().datetime().nullable().optional(),
})

/** GET /api/strategist/memories — list memories, filterable by type, entity, limit */
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'read'), { maxRequests: 60 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'strategy:read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: strategy:read required' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const typeParam = searchParams.get('type')
  const entity = searchParams.get('entity')
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 200) : 50

  const supabase = createAdminClient()
  let query = supabase
    .from('strategist_memories')
    .select('*')
    .eq('user_id', auth.userId)
    .eq('organization_id', auth.organizationId)
    .order('confidence', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (typeParam) {
    const types = typeParam.split(',').map((t) => t.trim()).filter(Boolean)
    query = query.in('type', types)
  }

  if (entity) {
    query = query.eq('entity', entity)
  }

  const { data, error } = await query

  if (error) {
    console.error('[strategist/memories] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

/** POST /api/strategist/memories — create a new memory */
export async function POST(request: NextRequest) {
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateMemorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('strategist_memories')
    .insert({
      user_id: auth.userId,
      organization_id: auth.organizationId,
      ...parsed.data,
    })
    .select()
    .single()

  if (error) {
    console.error('[strategist/memories] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
