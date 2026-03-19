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

const UpdateDraftSchema = z.object({
  content: z.string().min(1).optional(),
  content_type: z.enum(['text', 'image', 'document']).optional(),
  pillar: z.string().nullable().optional(),
  pillar_id: z.string().uuid().nullable().optional(),
  brief_ref: z.string().max(512).nullable().optional(),
  suggested_publish_at: z.string().datetime({ offset: true }).nullable().optional(),
  media_urls: z.array(z.string().url()).nullable().optional(),
  revision_reason: z.string().nullable().optional(),
})

/** GET /api/drafts/:id — fetch a single draft */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'read'), { maxRequests: 60 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'drafts:read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: drafts:read access required' },
      { status: 403 }
    )
  }

  const { id } = await params
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid draft ID format' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: post, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (!post || !canAccessAgentUserRecord(auth, post)) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  return NextResponse.json(post)
}

/** PATCH /api/drafts/:id — update draft content/metadata */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'write'), { maxRequests: 10 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'drafts:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: drafts:write access required' },
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

  const parsed = UpdateDraftSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Verify the post belongs to the agent's organization
  const { data: existing } = await supabase
    .from('posts')
    .select('organization_id, user_id, status, content, content_version')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (!canAccessAgentUserRecord(auth, existing)) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (!['draft', 'rejected'].includes(existing.status)) {
    return NextResponse.json(
      { error: `Cannot update post in "${existing.status}" status` },
      { status: 409 }
    )
  }

  // Snapshot previous content into post_revisions before overwriting
  if (parsed.data.content && existing.content && parsed.data.content !== existing.content) {
    // Get the next version number
    const { data: lastRevision } = await supabase
      .from('post_revisions')
      .select('version')
      .eq('post_id', id)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    const nextVersion = (lastRevision?.version ?? 0) + 1

    await supabase.from('post_revisions').insert({
      post_id: id,
      version: nextVersion,
      content: existing.content,
      revised_by_agent: auth.agentName,
      revision_reason: parsed.data.revision_reason ?? null,
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { revision_reason, ...updateData } = parsed.data
  const updateFields = {
    ...updateData,
    updated_at: new Date().toISOString(),
  }

  if ('media_urls' in parsed.data) {
    updateFields.media_urls = parsed.data.media_urls ?? []
  }

  let mutation = supabase
    .from('posts')
    .update(updateFields)
    .eq('id', id)
    .eq('organization_id', auth.organizationId)

  if (!isSharedOrgAgentContext(auth)) {
    mutation = mutation.eq('user_id', auth.userId)
  }

  const { data: post, error } = await mutation.select().single()

  if (error) {
    console.error('[drafts] DB error updating draft:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const providerRunId = request.headers.get('x-paperclip-run-id')
  logAgentActivity({
    organizationId: auth.organizationId,
    agentId: auth.agentId,
    postId: id,
    actionType: 'draft_updated',
    metadata: { updated_fields: Object.keys(parsed.data) },
    providerMetadata: providerRunId ? { provider_run_id: providerRunId } : undefined,
  })

  // Auto-resubmit: if the agent updated content on a rejected post, transition
  // to pending_review so the Strategist can re-review the revised draft.
  if (existing.status === 'rejected' && parsed.data.content) {
    const currentVersion = (post as Record<string, unknown>).content_version as number ?? 1
    const newVersion = currentVersion + 1

    // Snapshot the previous content (before the agent's update)
    await supabase.from('post_revisions').insert({
      post_id: id,
      version: currentVersion,
      content: existing.content,
    })

    // Transition rejected → pending_review, clear rejection fields, bump version
    const { error: transitionError } = await supabase
      .from('posts')
      .update({
        status: 'pending_review',
        content_version: newVersion,
        rejection_reason: null,
        delete_scheduled_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (!transitionError) {
      // Record the revision event
      await supabase.from('review_events').insert({
        post_id: id,
        agent_name: auth.agentId,
        action: 'revised',
        notes: `Agent revised and resubmitted (v${newVersion})`,
      })

      logAgentActivity({
        organizationId: auth.organizationId,
        agentId: auth.agentId,
        postId: id,
        actionType: 'status_changed',
        metadata: { from: 'rejected', to: 'pending_review', content_version: newVersion },
        providerMetadata: providerRunId ? { provider_run_id: providerRunId } : undefined,
      })

      // Re-fetch for the response
      const { data: updated } = await supabase
        .from('posts')
        .select('*')
        .eq('id', id)
        .single()

      if (updated) return NextResponse.json(updated)
    }
  }

  return NextResponse.json(post)
}

/** DELETE /api/drafts/:id — hard delete a post */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'write'), { maxRequests: 10 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'drafts:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: drafts:write access required' },
      { status: 403 }
    )
  }

  const { id } = await params
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid draft ID format' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Verify the post exists and belongs to the agent's scope
  const { data: existing } = await supabase
    .from('posts')
    .select('organization_id, user_id, status')
    .eq('id', id)
    .single()

  if (!existing || !canAccessAgentUserRecord(auth, existing)) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  let deleteQuery = supabase
    .from('posts')
    .delete()
    .eq('id', id)
    .eq('organization_id', auth.organizationId)

  if (!isSharedOrgAgentContext(auth)) {
    deleteQuery = deleteQuery.eq('user_id', auth.userId)
  }

  const { error } = await deleteQuery

  if (error) {
    console.error('[drafts] DB error deleting post:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const providerRunId = request.headers.get('x-paperclip-run-id')
  logAgentActivity({
    organizationId: auth.organizationId,
    agentId: auth.agentId,
    postId: id,
    actionType: 'status_changed',
    metadata: { status: existing.status },
    providerMetadata: providerRunId ? { provider_run_id: providerRunId } : undefined,
  })

  return new NextResponse(null, { status: 204 })
}
