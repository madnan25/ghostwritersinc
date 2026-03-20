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
import { buildVersionedContentUpdate } from '@/lib/post-versioning'
import { getLatestBriefVersion } from '@/lib/brief-versioning'
import { rateLimit } from '@/lib/rate-limit'
import { isValidUuid } from '@/lib/validation'
import {
  applyTargetedRevisions,
  type SectionReplacement,
} from '@/lib/targeted-revision'

const ReplacementSchema = z.object({
  start_char: z.number().int().min(0),
  end_char: z.number().int().min(0),
  note: z.string(),
  replacement: z.string(),
})

const ApplyRevisionSchema = z.object({
  revision_id: z.string().uuid(),
  replacements: z.array(ReplacementSchema).min(1),
})

/**
 * POST /api/drafts/:id/targeted-revision/apply
 *
 * Called by the Scribe agent after generating replacement text for each
 * flagged section. Applies the replacements to the draft content, stores
 * diff data, bumps the content version, and transitions to pending_review.
 */
export async function POST(
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

  const parsed = ApplyRevisionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { revision_id, replacements } = parsed.data
  const supabase = createAdminClient()

  // Fetch the post
  const { data: post } = await supabase
    .from('posts')
    .select('organization_id, user_id, status, content, content_version, brief_id, brief_version_id')
    .eq('id', id)
    .single()

  if (!post || !canAccessAgentUserRecord(auth, post)) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (post.status !== 'revision') {
    return NextResponse.json(
      { error: `Cannot apply targeted revision: post status is "${post.status}", expected "revision"` },
      { status: 409 }
    )
  }

  if (!post.content) {
    return NextResponse.json({ error: 'Post has no content to revise' }, { status: 409 })
  }

  // Fetch the pending revision record
  const { data: revisionRecord } = await supabase
    .from('post_revisions')
    .select('id, flagged_sections, diff_sections, content')
    .eq('id', revision_id)
    .eq('post_id', id)
    .eq('revision_type', 'targeted')
    .single()

  if (!revisionRecord) {
    return NextResponse.json(
      { error: 'Targeted revision record not found' },
      { status: 404 }
    )
  }

  // Verify the replacement sections match the original flagged sections
  const flaggedSections = revisionRecord.flagged_sections as Array<{
    start_char: number
    end_char: number
    note: string
  }>

  if (!flaggedSections || flaggedSections.length === 0) {
    return NextResponse.json(
      { error: 'Revision record has no flagged sections' },
      { status: 409 }
    )
  }

  // Use the snapshot content from the revision record to ensure consistency
  // (the post content may have been modified since the revision was requested)
  const snapshotContent = revisionRecord.content as string
  if (snapshotContent !== post.content) {
    return NextResponse.json(
      {
        error: 'Post content has changed since revision was requested. The revision is stale.',
        code: 'CONTENT_MISMATCH',
      },
      { status: 409 }
    )
  }

  // Apply the targeted revisions
  const sectionReplacements: SectionReplacement[] = replacements
  const result = applyTargetedRevisions(snapshotContent, sectionReplacements)

  // Bump content version and transition to pending_review
  const currentVersion = (post.content_version as number) ?? 1
  const versionPlan = buildVersionedContentUpdate({
    status: post.status,
    currentVersion,
  })

  const latestBriefVersion = post.brief_id
    ? await getLatestBriefVersion(supabase, post.brief_id)
    : null

  // Snapshot the pre-revision content as a full version.
  // Cannot use .upsert() with onConflict here: migration 007 replaced the blanket
  // unique constraint with a partial unique index (version IS NOT NULL), which
  // PostgREST cannot use as an ON CONFLICT target. Check-then-insert instead.
  const { data: existingSnapshot } = await supabase
    .from('post_revisions')
    .select('id')
    .eq('post_id', id)
    .eq('version', currentVersion)
    .eq('revision_type', 'full')
    .maybeSingle()

  if (!existingSnapshot) {
    await supabase.from('post_revisions').insert({
      post_id: id,
      version: currentVersion,
      content: snapshotContent,
      revised_by_agent: auth.agentName,
      revision_reason: 'Pre-targeted-revision snapshot',
      brief_version_id: post.brief_version_id ?? null,
      revision_type: 'full',
    })
  }

  // Update the targeted revision record with completed diff data
  await supabase
    .from('post_revisions')
    .update({
      diff_sections: result.diffSections,
      revised_by_agent: auth.agentName,
    })
    .eq('id', revision_id)

  // Update the post with revised content
  const updateFields = {
    content: result.revisedContent,
    ...versionPlan.updateFields,
    brief_version_id: latestBriefVersion?.id ?? post.brief_version_id ?? null,
  }

  let mutation = supabase
    .from('posts')
    .update(updateFields)
    .eq('id', id)
    .eq('organization_id', auth.organizationId)

  if (!isSharedOrgAgentContext(auth)) {
    mutation = mutation.eq('user_id', auth.userId)
  }

  const { data: updatedPost, error: updateError } = await mutation.select().single()

  if (updateError) {
    console.error('[targeted-revision/apply] DB error updating post:', updateError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Log review event
  await supabase.from('review_events').insert({
    post_id: id,
    agent_id: auth.agentId,
    agent_name: auth.agentName,
    action: 'revised',
    notes: `Targeted revision applied: ${result.diffSections.length} section(s) rewritten (v${versionPlan.nextVersion})`,
  })

  const providerRunId = request.headers.get('x-paperclip-run-id')
  logAgentActivity({
    organizationId: auth.organizationId,
    agentId: auth.agentId,
    postId: id,
    actionType: 'draft_updated',
    metadata: {
      revision_type: 'targeted',
      revision_id,
      sections_revised: result.diffSections.length,
      sections_skipped: result.skippedSections.length,
      content_version: versionPlan.nextVersion,
    },
    providerMetadata: providerRunId ? { provider_run_id: providerRunId } : undefined,
  })

  logAgentActivity({
    organizationId: auth.organizationId,
    agentId: auth.agentId,
    postId: id,
    actionType: 'status_changed',
    metadata: {
      from: post.status,
      to: 'pending_review',
      content_version: versionPlan.nextVersion,
    },
    providerMetadata: providerRunId ? { provider_run_id: providerRunId } : undefined,
  })

  return NextResponse.json({
    post: updatedPost,
    revision: {
      id: revision_id,
      sections_revised: result.diffSections.length,
      sections_skipped: result.skippedSections,
      diff_sections: result.diffSections,
      content_version: versionPlan.nextVersion,
    },
  })
}
