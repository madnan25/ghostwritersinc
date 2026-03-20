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

const DecaySchema = z.object({
  confidence_threshold: z.number().min(0).max(1).optional().default(0.2),
})

/**
 * POST /api/strategist/memories/decay
 * Removes memories that have expired (expires_at < now()) or fallen below
 * the confidence threshold. Scoped strictly to auth.userId — no client-supplied
 * scope override (Sentinel HIGH finding).
 * Rate limit: 5/hr.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  // 5 per hour as per Sentinel LOW finding
  const limited = await rateLimit(getAgentRateLimitKey(auth, 'write'), {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
  })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'strategy:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: strategy:write required' },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = request.headers.get('content-length') !== '0' ? await request.json() : {}
  } catch {
    body = {}
  }

  const parsed = DecaySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { confidence_threshold } = parsed.data
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // Delete expired memories (past expires_at)
  const { count: expiredCount, error: expiredError } = await supabase
    .from('strategist_memories')
    .delete({ count: 'exact' })
    .eq('user_id', auth.userId)
    .eq('organization_id', auth.organizationId)
    .not('expires_at', 'is', null)
    .lt('expires_at', now)

  if (expiredError) {
    console.error('[strategist/memories/decay] expired delete error:', expiredError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Delete low-confidence memories below threshold
  const { count: lowConfCount, error: lowConfError } = await supabase
    .from('strategist_memories')
    .delete({ count: 'exact' })
    .eq('user_id', auth.userId)
    .eq('organization_id', auth.organizationId)
    .lt('confidence', confidence_threshold)

  if (lowConfError) {
    console.error('[strategist/memories/decay] low-confidence delete error:', lowConfError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({
    deleted_expired: expiredCount ?? 0,
    deleted_low_confidence: lowConfCount ?? 0,
    confidence_threshold,
  })
}
