import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { isValidUuid } from '@/lib/validation'

/**
 * POST /api/posts/:id/restore — restore a soft-archived post.
 *
 * Clears archived_at so the post re-appears in normal queues.
 * Idempotent: restoring a non-archived post is a no-op (returns 200).
 *
 * User-facing action — authenticated via Supabase session.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimitKey = `restore:${user.id}`
  const limited = await rateLimit(rateLimitKey, { maxRequests: 20 })
  if (limited) return limited

  const { id } = await params
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid post ID format' }, { status: 400 })
  }

  const { data: post } = await supabase
    .from('posts')
    .select('archived_at, organization_id')
    .eq('id', id)
    .maybeSingle()

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  // Already active — idempotent success
  if (!post.archived_at) {
    return NextResponse.json({ restored: true, archived_at: null })
  }

  const { data, error } = await supabase
    .from('posts')
    .update({ archived_at: null })
    .eq('id', id)
    .select('id, archived_at, freshness_type, expiry_date')
    .single()

  if (error) {
    console.error('[posts/restore] DB error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ restored: true, ...data })
}
