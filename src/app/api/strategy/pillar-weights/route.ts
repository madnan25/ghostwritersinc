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

const PillarWeightsSchema = z.object({
  pillar_weights: z
    .record(z.string(), z.number().min(0))
    .refine(
      (weights) => {
        const sum = Object.values(weights).reduce((acc, v) => acc + v, 0)
        return Math.abs(sum - 100) < 0.01
      },
      { message: 'Pillar weights must sum to 100' }
    ),
  scope: z.enum(['default', 'monthly']),
  month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'month must be in YYYY-MM-DD format').optional(),
}).refine(
  (data) => data.scope !== 'monthly' || !!data.month,
  { message: 'month is required when scope is monthly', path: ['month'] }
)

/** Returns true if the monthly scope is still active (current month or future) */
function isMonthlyActive(month: string | null): boolean {
  if (!month) return false
  const now = new Date()
  const [year, mon] = month.split('-').map(Number)
  return year > now.getFullYear() || (year === now.getFullYear() && mon >= now.getMonth() + 1)
}

/** GET /api/strategy/pillar-weights — get current pillar weights (monthly auto-reverts) */
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'pillar-weights-read'), { maxRequests: 60 })
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
    .select('pillar_weights, pillar_weights_scope, pillar_weights_month')
    .eq('user_id', auth.userId)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (error) {
    console.error('[strategy/pillar-weights] DB error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json(null)
  }

  // Monthly scope auto-reverts: if the monthly period has ended, report no active override
  const monthlyExpired =
    data.pillar_weights_scope === 'monthly' &&
    !isMonthlyActive(data.pillar_weights_month)

  return NextResponse.json({
    ...data,
    monthly_expired: monthlyExpired,
  })
}

/** PUT /api/strategy/pillar-weights — update pillar weights with scope */
export async function PUT(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'pillar-weights-write'), { maxRequests: 10 })
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

  const parsed = PillarWeightsSchema.safeParse(body)
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
        pillar_weights: parsed.data.pillar_weights,
        pillar_weights_scope: parsed.data.scope,
        pillar_weights_month: parsed.data.scope === 'monthly' ? parsed.data.month : null,
      },
      { onConflict: 'user_id,organization_id' }
    )
    .select('pillar_weights, pillar_weights_scope, pillar_weights_month')
    .single()

  if (error) {
    console.error('[strategy/pillar-weights] DB error upserting:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
