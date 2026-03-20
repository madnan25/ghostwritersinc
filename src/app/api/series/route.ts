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

const PartOutlineSchema = z.object({
  angle: z.string().min(1, 'Part angle is required').max(1000),
  voice_notes: z.string().max(2000).nullable().optional(),
})

const AgentCreateSeriesSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(2000).nullable().optional(),
  total_parts: z
    .number()
    .int()
    .min(2, 'Minimum 2 parts')
    .max(8, 'Maximum 8 parts'),
  cadence: z.enum(['weekly', 'biweekly', 'monthly']).default('weekly'),
  pillar_id: z.string().uuid().nullable().optional(),
  part_outlines: z.array(PartOutlineSchema).max(8).optional(),
})

const UserCreateSeriesSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(2000).nullable().optional(),
  total_parts: z
    .number()
    .int()
    .min(2, 'Minimum 2 parts')
    .max(8, 'Maximum 8 parts'),
  cadence: z.enum(['weekly', 'biweekly', 'monthly']).default('weekly'),
  pillar_id: z.string().uuid().nullable().optional(),
  part_outlines: z.array(PartOutlineSchema).max(8).optional(),
})

/** POST /api/series — create a series with auto-generated brief stubs (agent or user) */
export async function POST(request: NextRequest) {
  const hasBearer = request.headers.get('authorization')?.startsWith('Bearer ')
  if (hasBearer) {
    return handleAgentCreate(request)
  }
  return handleUserCreate(request)
}

async function handleAgentCreate(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'series-write'), { maxRequests: 10 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'series:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: series:write access required' },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = AgentCreateSeriesSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  return createSeries({
    organizationId: auth.organizationId,
    userId: auth.userId,
    data: parsed.data,
  })
}

async function handleUserCreate(request: NextRequest) {
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

  const limited = await rateLimit(`user:series:write:${user.id}`, { maxRequests: 10 })
  if (limited) return limited

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = UserCreateSeriesSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  return createSeries({
    organizationId: dbUser.organization_id,
    userId: user.id,
    data: parsed.data,
  })
}

async function createSeries({
  organizationId,
  userId,
  data,
}: {
  organizationId: string
  userId: string
  data: z.infer<typeof AgentCreateSeriesSchema>
}) {
  const supabase = createAdminClient()

  // Create the series record
  const { data: series, error: seriesError } = await supabase
    .from('content_series')
    .insert({
      organization_id: organizationId,
      user_id: userId,
      title: data.title,
      description: data.description ?? null,
      total_parts: data.total_parts,
      cadence: data.cadence,
      status: 'planning',
    })
    .select()
    .single()

  if (seriesError) {
    console.error('[series] DB error creating series:', seriesError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Auto-generate brief stubs for each part
  const outlines = data.part_outlines ?? []
  const briefInserts = Array.from({ length: data.total_parts }, (_, i) => {
    const outline = outlines[i]
    return {
      organization_id: organizationId,
      angle: outline?.angle ?? `Part ${i + 1}: ${data.title}`,
      research_refs: [] as string[],
      voice_notes: outline?.voice_notes ?? null,
      pillar_id: data.pillar_id ?? null,
      status: 'pending_strategist' as const,
      source: 'series_generated' as const,
      priority: 'normal' as const,
      series_id: series.id,
      series_part_number: i + 1,
    }
  })

  const { data: briefs, error: briefsError } = await supabase
    .from('briefs')
    .insert(briefInserts)
    .select()

  if (briefsError) {
    console.error('[series] DB error creating brief stubs:', briefsError)
    // Series was created but briefs failed — clean up and return error
    await supabase.from('content_series').delete().eq('id', series.id)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ ...series, briefs }, { status: 201 })
}

/** GET /api/series — list all series for the org (agent or user) */
export async function GET(request: NextRequest) {
  const hasBearer = request.headers.get('authorization')?.startsWith('Bearer ')

  if (hasBearer) {
    const auth = await authenticateAgent(request)
    if (!isAgentContext(auth)) return auth

    const limited = await rateLimit(getAgentRateLimitKey(auth, 'series-read'), { maxRequests: 60 })
    if (limited) return limited

    if (!hasAgentPermission(auth.permissions, 'series:read')) {
      return NextResponse.json(
        { error: 'Insufficient permissions: series:read access required' },
        { status: 403 }
      )
    }

    return listSeries(auth.organizationId, request)
  }

  // User path
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

  const limited = await rateLimit(`user:series:read:${user.id}`, { maxRequests: 60 })
  if (limited) return limited

  return listSeries(dbUser.organization_id, request)
}

async function listSeries(organizationId: string, request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const validStatuses = ['planning', 'active', 'paused', 'cancelled', 'completed']
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}` },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  let query = supabase
    .from('content_series')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('[series] DB error listing series:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
