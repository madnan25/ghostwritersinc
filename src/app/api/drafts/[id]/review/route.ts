import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateAgent, isAgentContext } from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import type { PostStatus } from '@/lib/types'
import { validateTransition, WorkflowError } from '@/lib/workflow'

const ReviewSchema = z.object({
  action: z.enum(['approved', 'rejected']),
  notes: z.string().nullable().optional(),
  rejection_reason: z.string().optional(),
})

/** POST /api/drafts/:id/review — agent pre-review (approve/reject with notes) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = rateLimit(`write:${auth.agentName}`, { maxRequests: 10 })
  if (limited) return limited

  if (!auth.permissions.includes('review')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: review access required' },
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

  const parsed = ReviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Fetch the post
  const { data: post } = await supabase
    .from('posts')
    .select('organization_id, status')
    .eq('id', id)
    .single()

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (post.organization_id !== auth.organizationId) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  // Determine target status based on action
  const currentStatus = post.status as PostStatus
  let targetStatus: PostStatus

  if (parsed.data.action === 'approved') {
    // Agent approval moves to pending_review (client queue)
    targetStatus = 'pending_review'
  } else {
    targetStatus = 'rejected'
  }

  // Validate the transition
  try {
    const { reviewAction, updateFields } = validateTransition({
      postId: id,
      from: currentStatus,
      to: targetStatus,
      agentName: auth.agentName,
      notes: parsed.data.notes ?? null,
      rejectionReason: parsed.data.rejection_reason ?? null,
    })

    // Update post
    const { error: updateError } = await supabase
      .from('posts')
      .update({
        ...updateFields,
        reviewed_by_agent: auth.agentName,
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Create review event
    await supabase.from('review_events').insert({
      post_id: id,
      agent_name: auth.agentName,
      action: reviewAction,
      notes: parsed.data.rejection_reason ?? parsed.data.notes ?? null,
    })

    // Fetch updated post
    const { data: updatedPost } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single()

    return NextResponse.json(updatedPost)
  } catch (err) {
    if (err instanceof WorkflowError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 409 }
      )
    }
    throw err
  }
}
