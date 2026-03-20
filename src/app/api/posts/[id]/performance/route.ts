import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  authenticateAgent,
  canAccessAgentUserRecord,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { isValidUuid } from '@/lib/validation'

const UpsertPerformanceSchema = z.object({
  impressions: z.number().int().min(0).nullable().optional(),
  reactions: z.number().int().min(0).nullable().optional(),
  comments_count: z.number().int().min(0).nullable().optional(),
  reposts: z.number().int().min(0).nullable().optional(),
  qualitative_notes: z.string().nullable().optional(),
  logged_at: z.string().datetime({ offset: true }).optional(),
})

/** GET /api/posts/:id/performance — get performance record for a post */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'read'), { maxRequests: 60 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'posts:read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: posts:read access required' },
      { status: 403 }
    )
  }

  const { id } = await params
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid post ID format' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Verify post exists and belongs to this agent's scope
  const { data: post } = await supabase
    .from('posts')
    .select('organization_id, user_id')
    .eq('id', id)
    .maybeSingle()

  if (!post || !canAccessAgentUserRecord(auth, post)) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('post_performance')
    .select('*')
    .eq('post_id', id)
    .maybeSingle()

  if (error) {
    console.error('[posts/performance] DB error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data ?? null)
}

/** POST /api/posts/:id/performance — upsert performance record for a post */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'write'), { maxRequests: 10 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'posts:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: posts:write access required' },
      { status: 403 }
    )
  }

  const { id } = await params
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid post ID format' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = UpsertPerformanceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Verify post exists and belongs to this agent's scope
  const { data: post } = await supabase
    .from('posts')
    .select('organization_id, user_id')
    .eq('id', id)
    .maybeSingle()

  if (!post || !canAccessAgentUserRecord(auth, post)) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('post_performance')
    .upsert(
      {
        post_id: id,
        organization_id: auth.organizationId,
        user_id: auth.userId,
        ...parsed.data,
      },
      { onConflict: 'post_id' }
    )
    .select()
    .single()

  if (error) {
    console.error('[posts/performance] DB error upserting:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
