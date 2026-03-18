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

const CreateCommentSchema = z.object({
  body: z.string().min(1),
  selected_text: z.string().nullable().optional(),
  selection_start: z.number().int().nullable().optional(),
  selection_end: z.number().int().nullable().optional(),
})

/** GET /api/drafts/:id/comments — get inline feedback from client */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'read'), { maxRequests: 60 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'comments:read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: comments:read access required' },
      { status: 403 }
    )
  }

  const { id } = await params
  const supabase = createAdminClient()

  // Verify the post belongs to the agent's organization
  const { data: post } = await supabase
    .from('posts')
    .select('organization_id, user_id')
    .eq('id', id)
    .single()

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (!canAccessAgentUserRecord(auth, post)) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const { data: comments, error } = await supabase
    .from('post_comments')
    .select('*')
    .eq('post_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[drafts] DB error fetching comments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(comments)
}

/** POST /api/drafts/:id/comments — create an inline agent comment */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'write'), { maxRequests: 30 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'comments:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: comments:write access required' },
      { status: 403 }
    )
  }

  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateCommentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { data: post } = await supabase
    .from('posts')
    .select('organization_id, user_id')
    .eq('id', id)
    .single()

  if (!post || !canAccessAgentUserRecord(auth, post)) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const { data: comment, error } = await supabase
    .from('post_comments')
    .insert({
      post_id: id,
      author_type: 'agent',
      author_id: auth.agentId,
      agent_id: auth.agentId,
      body: parsed.data.body,
      selected_text: parsed.data.selected_text ?? null,
      selection_start: parsed.data.selection_start ?? null,
      selection_end: parsed.data.selection_end ?? null,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(comment, { status: 201 })
}
