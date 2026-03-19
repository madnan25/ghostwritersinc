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

const UpsertStrategyConfigSchema = z.object({
  monthly_post_target: z.number().int().min(1).max(100).optional(),
  intel_score_threshold: z.number().min(0).max(1).optional(),
  default_publish_hour: z.number().int().min(0).max(23).optional(),
  voice_notes: z.string().nullable().optional(),
})

/** GET /api/strategy-config — get the current user's strategy config */
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
  const { data, error } = await supabase
    .from('strategy_config')
    .select('*')
    .eq('user_id', auth.userId)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (error) {
    console.error('[strategy-config] DB error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json(null, { status: 200 })
  }

  return NextResponse.json(data)
}

/** PUT /api/strategy-config — upsert the current user's strategy config */
export async function PUT(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'write'), { maxRequests: 10 })
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

  const parsed = UpsertStrategyConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('strategy_config')
    .upsert(
      {
        user_id: auth.userId,
        organization_id: auth.organizationId,
        ...parsed.data,
      },
      { onConflict: 'user_id,organization_id' }
    )
    .select()
    .single()

  if (error) {
    console.error('[strategy-config] DB error upserting:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
