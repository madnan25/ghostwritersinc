import { NextRequest, NextResponse } from 'next/server'
import { authenticateAgent, isAgentContext } from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'

/** GET /api/drafts/:id/comments — get inline feedback from client */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  if (!auth.permissions.includes('read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: read access required' },
      { status: 403 }
    )
  }

  const { id } = await params
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

  const { data: comments, error } = await supabase
    .from('post_comments')
    .select('*')
    .eq('post_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(comments)
}
