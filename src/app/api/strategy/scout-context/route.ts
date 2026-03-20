import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  authenticateAgent,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

const ScoutContextSchema = z.object({
  scout_context: z.string().max(10000).nullable(),
})

/** GET /api/strategy/scout-context — read the current scout context */
export async function GET(request: NextRequest) {
  const hasBearer = request.headers.get('authorization')?.startsWith('Bearer ')

  if (hasBearer) {
    return handleAgentGet(request)
  }
  return handleUserGet(request)
}

/** PUT /api/strategy/scout-context — update the scout context instructions */
export async function PUT(request: NextRequest) {
  const hasBearer = request.headers.get('authorization')?.startsWith('Bearer ')

  if (hasBearer) {
    return handleAgentPut(request)
  }
  return handleUserPut(request)
}

async function handleAgentGet(request: NextRequest) {
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

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('strategy_config')
    .select('scout_context')
    .eq('user_id', auth.userId)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (error) {
    console.error('[scout-context] DB error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ scout_context: data?.scout_context ?? null })
}

async function handleUserGet(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: dbUser } = await admin
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { data, error } = await admin
    .from('strategy_config')
    .select('scout_context')
    .eq('user_id', user.id)
    .eq('organization_id', dbUser.organization_id)
    .maybeSingle()

  if (error) {
    console.error('[scout-context] DB error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ scout_context: data?.scout_context ?? null })
}

async function handleAgentPut(request: NextRequest) {
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

  const parsed = ScoutContextSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('strategy_config')
    .upsert(
      {
        user_id: auth.userId,
        organization_id: auth.organizationId,
        scout_context: parsed.data.scout_context,
      },
      { onConflict: 'user_id,organization_id' }
    )
    .select('scout_context')
    .single()

  if (error) {
    console.error('[scout-context] DB error upserting:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data)
}

async function handleUserPut(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: dbUser } = await admin
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const limited = await rateLimit(`user:scout-context:write:${user.id}`, { maxRequests: 10 })
  if (limited) return limited

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = ScoutContextSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { data, error } = await admin
    .from('strategy_config')
    .upsert(
      {
        user_id: user.id,
        organization_id: dbUser.organization_id,
        scout_context: parsed.data.scout_context?.trim() ?? null,
        monthly_post_target: 4,
        intel_score_threshold: 0.5,
        default_publish_hour: 9,
      },
      { onConflict: 'user_id,organization_id', ignoreDuplicates: false }
    )
    .select('scout_context')
    .single()

  if (error) {
    console.error('[scout-context] DB error upserting:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
