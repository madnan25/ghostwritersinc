import { NextRequest, NextResponse } from 'next/server'
import { authenticateAgent, getAgentRateLimitKey, isAgentContext } from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { isValidUuid } from '@/lib/validation'

/** GET /api/drafts/:id/revisions — get version history for a post */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'drafts-revisions-read'), { maxRequests: 60 })
  if (limited) return limited

  const { id } = await params
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid draft ID format' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Verify the post belongs to the agent's organization
  const { data: post } = await supabase
    .from('posts')
    .select('organization_id')
    .eq('id', id)
    .single()

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (post.organization_id !== auth.organizationId) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const { data: revisions, error } = await supabase
    .from('post_revisions')
    .select('*')
    .eq('post_id', id)
    .order('version', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(revisions ?? [])
}
