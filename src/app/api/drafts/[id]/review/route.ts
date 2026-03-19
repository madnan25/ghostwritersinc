import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  authenticateAgent,
  canAccessAgentUserRecord,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
  isSharedOrgAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAgentActivity } from '@/lib/agent-activity'
import { rateLimit } from '@/lib/rate-limit'
import { isValidUuid } from '@/lib/validation'
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

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'review'), { maxRequests: 10 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'reviews:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: reviews:write access required' },
      { status: 403 }
    )
  }

  const { id } = await params
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid draft ID format' }, { status: 400 })
  }

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
    .select('organization_id, user_id, status')
    .eq('id', id)
    .single()

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (!canAccessAgentUserRecord(auth, post)) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  // Determine target status based on action
  const currentStatus = post.status as PostStatus
  let targetStatus: PostStatus

  if (parsed.data.action === 'approved') {
    targetStatus = 'approved'
  } else {
    targetStatus = 'rejected'
  }

  // Validate the transition
  let response: NextResponse
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
    let mutation = supabase
      .from('posts')
      .update({
        ...updateFields,
        reviewed_by_agent: auth.agentName,
      })
      .eq('id', id)
      .eq('organization_id', auth.organizationId)

    if (!isSharedOrgAgentContext(auth)) {
      mutation = mutation.eq('user_id', auth.userId)
    }

    const { error: updateError } = await mutation

    if (updateError) {
      console.error('[drafts] DB error updating review:', updateError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Create review event
    await supabase.from('review_events').insert({
      post_id: id,
      agent_id: auth.agentId,
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

    response = NextResponse.json(updatedPost)
  } catch (err) {
    if (err instanceof WorkflowError) {
      response = NextResponse.json(
        { error: err.message, code: err.code },
        { status: 409 }
      )
    } else {
      throw err
    }
  }

  // Log activity after try/catch so both successful and WorkflowError-rejected reviews are recorded
  const providerRunId = request.headers.get('x-paperclip-run-id')
  logAgentActivity({
    organizationId: auth.organizationId,
    agentId: auth.agentId,
    postId: id,
    actionType: 'review_submitted',
    metadata: { action: parsed.data.action, from_status: currentStatus, to_status: targetStatus },
    providerMetadata: providerRunId ? { provider_run_id: providerRunId } : undefined,
  })

  return response
}
