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

const CreateObservationSchema = z.object({
  observation: z.string().min(1).max(2000),
  confidence: z.number().min(0).max(1).optional(),
  source_post_ids: z.array(z.string().uuid()).max(50).optional(),
})

/** GET /api/voice-observations — list voice observations for the agent's user */
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'voice-obs-read'), { maxRequests: 60 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'drafts:read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: drafts:read access required' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const supabase = createAdminClient()

  let query = supabase
    .from('voice_observations')
    .select('*')
    .eq('user_id', auth.userId)
    .eq('organization_id', auth.organizationId)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('[voice-observations] DB error listing:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data)
}

/** POST /api/voice-observations — create a new voice observation */
export async function POST(request: NextRequest) {
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateObservationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('voice_observations')
    .insert({
      organization_id: auth.organizationId,
      user_id: auth.userId,
      observation: parsed.data.observation,
      confidence: parsed.data.confidence ?? 0.5,
      source_post_ids: parsed.data.source_post_ids ?? [],
      created_by_agent_id: auth.agentId ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[voice-observations] DB error creating:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
