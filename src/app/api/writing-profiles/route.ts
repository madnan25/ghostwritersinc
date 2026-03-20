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

const UpsertProfileSchema = z.object({
  tone: z.string().max(200).nullable().optional(),
  voice_notes: z.string().max(5000).nullable().optional(),
  sample_post_ids: z.array(z.string().uuid()).max(20).optional(),
  avoid_topics: z.array(z.string().max(200)).max(50).optional(),
  preferred_formats: z.array(z.string().max(100)).max(20).optional(),
})

/** GET /api/writing-profiles — get the writing profile for the agent's assigned user */
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'writing-profiles-read'), { maxRequests: 60 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'drafts:read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: drafts:read access required' },
      { status: 403 }
    )
  }

  const supabase = createAdminClient()
  const { data: profile, error } = await supabase
    .from('user_writing_profiles')
    .select('*')
    .eq('user_id', auth.userId)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (error) {
    console.error('[writing-profiles] DB error fetching profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (!profile) {
    return NextResponse.json({ error: 'Writing profile not found' }, { status: 404 })
  }

  return NextResponse.json(profile)
}

/** PUT /api/writing-profiles — upsert writing profile for the agent's assigned user */
export async function PUT(request: NextRequest) {
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = UpsertProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const { data: profile, error } = await supabase
    .from('user_writing_profiles')
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
    console.error('[writing-profiles] DB error upserting profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(profile)
}

/** DELETE /api/writing-profiles — delete the writing profile */
export async function DELETE(request: NextRequest) {
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

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('user_writing_profiles')
    .delete()
    .eq('user_id', auth.userId)
    .eq('organization_id', auth.organizationId)

  if (error) {
    console.error('[writing-profiles] DB error deleting profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
