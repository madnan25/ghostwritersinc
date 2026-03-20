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
    .select('id, user_id, organization_id, learned_preferences')
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

  // Build the updated learned_preferences array
  const existing: unknown[] = Array.isArray(profile.learned_preferences)
    ? profile.learned_preferences
    : []

  // Idempotent: skip if this observation is already in the list
  const alreadyApplied = existing.some(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      (entry as Record<string, unknown>).observation_id === observation.id
  )
  if (alreadyApplied) {
    return NextResponse.json({ ok: true, profile_id: id, already_applied: true })
  }

  const newEntry = {
    observation_id: observation.id,
    observation: observation.observation,
    confidence: observation.confidence,
    source_post_ids: observation.source_post_ids,
    applied_at: new Date().toISOString(),
  }

  const { data: updatedProfile, error } = await supabase
    .from('user_writing_profiles')
    .update({
      learned_preferences: [...existing, newEntry],
    })
    .eq('id', id)
    .eq('organization_id', auth.organizationId)
    .select()
    .single()

  if (error) {
    console.error('[writing-profiles/apply-observation] DB error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(updatedProfile)
}
