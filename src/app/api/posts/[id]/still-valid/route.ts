import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { isValidUuid } from '@/lib/validation'

/**
 * POST /api/posts/:id/still-valid — mark a stale post as still valid.
 *
 * For time_sensitive posts: clears expiry_date so the post is no longer flagged.
 * For date_locked posts: no-op (expiry is enforced by the system).
 * For evergreen posts: no-op (no expiry to clear).
 *
 * User-facing action — authenticated via Supabase session (not agent key).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rateLimitKey = `still-valid:${user.id}`
  const limited = await rateLimit(rateLimitKey, { maxRequests: 30 })
  if (limited) return limited

  const { id } = await params
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid post ID format' }, { status: 400 })
  }

  // Verify post belongs to this user's organization
  const { data: post } = await supabase
    .from('posts')
    .select('freshness_type, expiry_date, archived_at, organization_id')
    .eq('id', id)
    .maybeSingle()

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  // Only time_sensitive posts have a clearable expiry
  if (post.freshness_type !== 'time_sensitive') {
    return NextResponse.json({ ok: true, message: 'No action needed' })
  }

  const { data, error } = await supabase
    .from('posts')
    .update({ expiry_date: null })
    .eq('id', id)
    .select('id, freshness_type, expiry_date, archived_at')
    .single()

  if (error) {
    console.error('[posts/still-valid] DB error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ...data })
}
