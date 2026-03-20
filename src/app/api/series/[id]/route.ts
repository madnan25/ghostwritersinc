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
import { isValidUuid } from '@/lib/validation'

const UpdateSeriesSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  cadence: z.enum(['weekly', 'biweekly', 'monthly']).optional(),
})

/** GET /api/series/:id — get a series with its linked briefs and posts */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid series ID format' }, { status: 400 })
  }

  let organizationId: string

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
    organizationId = auth.organizationId
  } else {
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

    organizationId = dbUser.organization_id
  }

  const supabase = createAdminClient()

  const { data: series, error: seriesError } = await supabase
    .from('content_series')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (seriesError) {
    console.error('[series] DB error fetching series:', seriesError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (!series || series.organization_id !== organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [{ data: briefs, error: briefsError }, { data: posts, error: postsError }] =
    await Promise.all([
      supabase
        .from('briefs')
        .select('*')
        .eq('series_id', id)
        .order('series_part_number', { ascending: true }),
      supabase
        .from('posts')
        .select('id, title, status, published_at, series_id, created_at')
        .eq('series_id', id)
        .order('created_at', { ascending: true }),
    ])

  if (briefsError) {
    console.error('[series] DB error fetching briefs:', briefsError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (postsError) {
    console.error('[series] DB error fetching posts:', postsError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ ...series, briefs: briefs ?? [], posts: posts ?? [] })
}

/** PATCH /api/series/:id — update series metadata */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid series ID format' }, { status: 400 })
  }

  let organizationId: string

  const hasBearer = request.headers.get('authorization')?.startsWith('Bearer ')
  if (hasBearer) {
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
    organizationId = auth.organizationId
  } else {
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

    organizationId = dbUser.organization_id
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = UpdateSeriesSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('content_series')
    .select('organization_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!existing || existing.organization_id !== organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (existing.status === 'cancelled' || existing.status === 'completed') {
    return NextResponse.json(
      { error: `Cannot update a ${existing.status} series` },
      { status: 422 }
    )
  }

  const { data, error } = await supabase
    .from('content_series')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[series] DB error updating series:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
