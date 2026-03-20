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
import { isValidUuid } from '@/lib/validation'

const ApplyObservationSchema = z.object({
  observation_id: z.string().uuid(),
})

/**
 * POST /api/writing-profiles/:id/apply-observation
 *
 * Appends a confirmed voice observation to the writing profile's
 * learned_preferences array. The observation must be in 'confirmed' status
 * and belong to the same user/org as the profile.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'writing-profiles-write'), { maxRequests: 10 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'drafts:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: drafts:write access required' },
      { status: 403 }
    )
  }

  const { id } = await params
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid writing profile ID format' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = ApplyObservationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Verify the writing profile belongs to this agent's user/org
  const { data: profile } = await supabase
    .from('user_writing_profiles')
    .select('id, user_id, organization_id')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Writing profile not found' }, { status: 404 })
  }

  // Fetch the confirmed voice observation
  const { data: observation } = await supabase
    .from('voice_observations')
    .select('id, observation, confidence, status, source_post_ids, confirmed_at')
    .eq('id', parsed.data.observation_id)
    .eq('user_id', auth.userId)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (!observation) {
    return NextResponse.json({ error: 'Voice observation not found' }, { status: 404 })
  }

  if (observation.status !== 'confirmed') {
    return NextResponse.json(
      { error: 'Only confirmed observations can be applied to a writing profile' },
      { status: 422 }
    )
  }

  // Atomically append the new preference entry using a single UPDATE with JSONB concat.
  // The RPC's NOT (@>) predicate also handles idempotency: if this observation_id is
  // already in learned_preferences the UPDATE matches 0 rows (returns empty set).
  const newEntry = {
    observation_id: observation.id,
    observation: observation.observation,
    confidence: observation.confidence,
    source_post_ids: observation.source_post_ids,
    applied_at: new Date().toISOString(),
  }

  const { data: rows, error } = await supabase.rpc('append_learned_preference', {
    p_profile_id: id,
    p_org_id: auth.organizationId,
    p_entry: newEntry,
  })

  if (error) {
    console.error('[writing-profiles/apply-observation] DB error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // 0 rows means observation_id was already present — idempotent no-op
  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, profile_id: id, already_applied: true })
  }

  return NextResponse.json(rows[0])
}
