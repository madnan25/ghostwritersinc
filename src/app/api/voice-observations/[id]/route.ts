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

const PatchObservationSchema = z.object({
  status: z.enum(['confirmed', 'dismissed']).optional(),
  observation: z.string().min(1).max(2000).optional(),
  confidence: z.number().min(0).max(1).optional(),
}).refine(
  (d) => d.status !== undefined || d.observation !== undefined || d.confidence !== undefined,
  { message: 'At least one field (status, observation, or confidence) must be provided' }
)

/** PATCH /api/voice-observations/:id — confirm, dismiss, or edit an observation */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'voice-obs-write'), { maxRequests: 20 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'drafts:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: drafts:write access required' },
      { status: 403 }
    )
  }

  const { id } = await params
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid observation ID format' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = PatchObservationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Verify the observation belongs to this agent's user/org
  const { data: existing } = await supabase
    .from('voice_observations')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Observation not found' }, { status: 404 })
  }

  const updateFields: Record<string, unknown> = {}

  if (parsed.data.observation !== undefined) {
    updateFields.observation = parsed.data.observation
  }
  if (parsed.data.confidence !== undefined) {
    updateFields.confidence = parsed.data.confidence
  }
  if (parsed.data.status !== undefined) {
    updateFields.status = parsed.data.status
    if (parsed.data.status === 'confirmed') {
      updateFields.confirmed_at = new Date().toISOString()
      updateFields.dismissed_at = null
    } else if (parsed.data.status === 'dismissed') {
      updateFields.dismissed_at = new Date().toISOString()
      updateFields.confirmed_at = null
    }
  }

  const { data, error } = await supabase
    .from('voice_observations')
    .update(updateFields)
    .eq('id', id)
    .eq('organization_id', auth.organizationId)
    .eq('user_id', auth.userId)
    .select()
    .single()

  if (error) {
    console.error('[voice-observations] DB error updating:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
