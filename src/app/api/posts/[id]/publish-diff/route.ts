import { NextRequest, NextResponse } from 'next/server'
import {
  authenticateAgent,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { isValidUuid } from '@/lib/validation'
import { createPostDiff } from '@/lib/voice-analysis'

/**
 * POST /api/posts/[id]/publish-diff — generate a diff between the original
 * Scribe draft and the published version. Called on publish (not on approve).
 *
 * The diff is stored in the post_diffs table for later voice analysis.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'publish-diff'), { maxRequests: 20 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'posts:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: posts:write access required' },
      { status: 403 },
    )
  }

  const { id: postId } = await params
  if (!isValidUuid(postId)) {
    return NextResponse.json({ error: 'Invalid post ID format' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Fetch the published post
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id, organization_id, user_id, content, status')
    .eq('id', postId)
    .eq('organization_id', auth.organizationId)
    .single()

  if (postError || !post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (post.status !== 'published') {
    return NextResponse.json(
      { error: 'Diff can only be generated for published posts' },
      { status: 400 },
    )
  }

  // Check for existing diff (idempotent)
  const { data: existingDiff } = await supabase
    .from('post_diffs')
    .select('id')
    .eq('post_id', postId)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (existingDiff) {
    return NextResponse.json(
      { message: 'Diff already exists for this post', diff_id: existingDiff.id },
      { status: 200 },
    )
  }

  // Get the original draft content (first revision, version 1)
  const { data: firstRevision } = await supabase
    .from('post_revisions')
    .select('content')
    .eq('post_id', postId)
    .eq('version', 1)
    .maybeSingle()

  // If no revision history, the post was never revised — use current content as both
  const originalContent = firstRevision?.content ?? post.content

  const success = await createPostDiff(
    supabase,
    postId,
    post.organization_id,
    post.user_id,
    originalContent,
    post.content,
  )

  if (!success) {
    return NextResponse.json({ error: 'Failed to create diff' }, { status: 500 })
  }

  return NextResponse.json({ message: 'Post diff created successfully' }, { status: 201 })
}
