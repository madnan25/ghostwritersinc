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
  title: z.string().max(200).nullable().optional(),
  content_type: z.enum(['text', 'image', 'document']).optional(),
  pillar: z.string().nullable().optional(),
  pillar_id: z.string().uuid().nullable().optional(),
  brief_ref: z.string().max(512).nullable().optional(),
  suggested_publish_at: z.string().datetime({ offset: true }).nullable().optional(),
  media_urls: z.array(z.string().url()).nullable().optional(),
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
    .select('organization_id, user_id, status, title')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (!canAccessAgentUserRecord(auth, existing)) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  // Allow title-only updates on pre-publish statuses (backfill), but not on published/scheduled
  const isTitleOnlyUpdate = Object.keys(parsed.data).length === 1 && 'title' in parsed.data
  const editableStatuses = isTitleOnlyUpdate
    ? ['draft', 'rejected', 'pending_review', 'approved']
    : ['draft', 'rejected']
  if (!editableStatuses.includes(existing.status)) {
    return NextResponse.json(
      { error: `Cannot update post in "${existing.status}" status` },
      { status: 409 }
    )
  }

  // Snapshot current content as a revision before overwriting (agent edits should be tracked)
  if (parsed.data.content) {
    const { data: currentPost } = await supabase
      .from('posts')
      .select('content')
      .eq('id', id)
      .single()

    if (currentPost?.content) {
      await supabase.rpc('insert_post_revision', {
        p_post_id: id,
        p_content: currentPost.content,
        p_revised_by_agent: auth.agentId,
        p_revised_by_user: null,
        p_revision_reason: 'Agent content update',
      }).then(({ error }) => {
        if (error) console.error('[drafts] Revision snapshot failed:', error.message)
      })
    }
  }

  const updateFields = {
    ...parsed.data,
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
    metadata: { updated_fields: Object.keys(parsed.data), title: parsed.data.title ?? existing.title ?? null },
    providerMetadata: providerRunId ? { provider_run_id: providerRunId } : undefined,
  })

  return NextResponse.json(post)
}
