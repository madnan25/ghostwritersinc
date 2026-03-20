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

const MAX_SERIES_PARTS = 8

const AddPostSchema = z.object({
  post_id: z.string().uuid('post_id must be a valid UUID'),
})

/**
 * POST /api/series/:id/add-post — associate an existing post with this series.
 *
 * Respects the max 8 parts cap across posts already linked to this series.
 * The post must belong to the same organization.
 */
export async function POST(
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

  const parsed = AddPostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Verify series exists and is active
  const { data: series } = await supabase
    .from('content_series')
    .select('id, organization_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!series || series.organization_id !== organizationId) {
    return NextResponse.json({ error: 'Series not found' }, { status: 404 })
  }

  if (series.status === 'cancelled' || series.status === 'completed') {
    return NextResponse.json(
      { error: `Cannot add a post to a ${series.status} series` },
      { status: 422 }
    )
  }

  // Verify post exists and belongs to same org
  const { data: post } = await supabase
    .from('posts')
    .select('id, organization_id, series_id')
    .eq('id', parsed.data.post_id)
    .maybeSingle()

  if (!post || post.organization_id !== organizationId) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (post.series_id && post.series_id !== id) {
    return NextResponse.json(
      { error: 'Post is already assigned to a different series' },
      { status: 422 }
    )
  }

  if (post.series_id === id) {
    // Idempotent — already in this series
    return NextResponse.json({ post_id: post.id, series_id: id, added: false })
  }

  // Enforce max 8 posts cap
  const { count, error: countError } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('series_id', id)

  if (countError) {
    console.error('[series/add-post] DB error counting posts:', countError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if ((count ?? 0) >= MAX_SERIES_PARTS) {
    return NextResponse.json(
      { error: `Series already has the maximum of ${MAX_SERIES_PARTS} posts` },
      { status: 422 }
    )
  }

  const { error: updateError } = await supabase
    .from('posts')
    .update({ series_id: id })
    .eq('id', parsed.data.post_id)

  if (updateError) {
    console.error('[series/add-post] DB error linking post:', updateError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ post_id: parsed.data.post_id, series_id: id, added: true })
}
