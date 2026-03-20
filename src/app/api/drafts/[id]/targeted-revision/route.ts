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

/** Max targeted revisions allowed per draft before a full rewrite is prompted */
const MAX_TARGETED_REVISIONS = 3

const RevisionRangeSchema = z.object({
  start_char: z.number().int().min(0),
  end_char: z.number().int().min(1),
  note: z.string().min(1).max(1000),
})

const TargetedRevisionSchema = z.object({
  revisions: z.array(RevisionRangeSchema).min(1).max(20),
})

/**
 * POST /api/drafts/:id/targeted-revision
 *
 * Accepts a structured set of character-range revision requests for a draft.
 * Validates ranges, enforces a max-3-targeted-revisions-per-draft cap,
 * snapshots the flagged sections, and transitions the post to 'revision'
 * status so the Scribe agent can pick it up.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  // Targeted revision is a heavier write — tighter rate limit than plain drafts:write
  const limited = await rateLimit(getAgentRateLimitKey(auth, 'write'), {
    maxRequests: 5,
  })
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

  const parsed = TargetedRevisionSchema.safeParse(body)
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
    .select('organization_id, user_id, status, content, content_version, brief_version_id')
    .eq('id', id)
    .single()

  if (!post || !canAccessAgentUserRecord(auth, post)) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  // Only allow targeted revisions on posts at the review/revision stage
  if (!['pending_review', 'revision'].includes(post.status)) {
    return NextResponse.json(
      {
        error: `Targeted revision requires post status 'pending_review' or 'revision', got '${post.status}'`,
      },
      { status: 409 }
    )
  }

  const content: string = post.content ?? ''
  const contentLength = content.length

  // --- Validate character ranges ---
  const revisions = parsed.data.revisions

  for (const rev of revisions) {
    if (rev.end_char <= rev.start_char) {
      return NextResponse.json(
        { error: `Invalid range: end_char (${rev.end_char}) must be greater than start_char (${rev.start_char})` },
        { status: 400 }
      )
    }
    if (rev.end_char > contentLength) {
      return NextResponse.json(
        {
          error: `Range [${rev.start_char}, ${rev.end_char}) exceeds content length (${contentLength})`,
        },
        { status: 400 }
      )
    }
  }

  // Check for overlapping ranges (sort by start_char then check consecutive pairs)
  const sorted = [...revisions].sort((a, b) => a.start_char - b.start_char)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start_char < sorted[i - 1].end_char) {
      return NextResponse.json(
        {
          error: `Overlapping ranges: [${sorted[i - 1].start_char}, ${sorted[i - 1].end_char}) and [${sorted[i].start_char}, ${sorted[i].end_char})`,
        },
        { status: 400 }
      )
    }
  }

  // --- Enforce max targeted revisions cap ---
  const { count: existingCount, error: countError } = await supabase
    .from('post_revisions')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', id)
    .eq('revision_type', 'targeted')

  if (countError) {
    console.error('[targeted-revision] DB error counting revisions:', countError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const targetedCount = existingCount ?? 0

  if (targetedCount >= MAX_TARGETED_REVISIONS) {
    return NextResponse.json(
      {
        error: `Maximum targeted revisions (${MAX_TARGETED_REVISIONS}) reached for this draft. Consider requesting a full rewrite instead.`,
        code: 'MAX_TARGETED_REVISIONS_EXCEEDED',
        targeted_revision_count: targetedCount,
      },
      { status: 409 }
    )
  }

  // --- Build flagged_sections and diff_sections payloads ---
  const flaggedSections = revisions.map(({ start_char, end_char, note }) => ({
    start_char,
    end_char,
    note,
  }))

  const diffSections = revisions.map(({ start_char, end_char }) => ({
    start_char,
    end_char,
    before_text: content.slice(start_char, end_char),
    after_text: null, // Filled by Scribe after applying the revision
  }))

  // --- Insert targeted revision record ---
  const { data: revision, error: insertError } = await supabase
    .from('post_revisions')
    .insert({
      post_id: id,
      version: null, // Targeted revisions don't represent a full content version
      content, // Snapshot of full content at time of request
      revised_by_agent: auth.agentName,
      revision_type: 'targeted',
      flagged_sections: flaggedSections,
      diff_sections: diffSections,
      brief_version_id: post.brief_version_id ?? null,
    })
    .select('id, created_at')
    .single()

  if (insertError || !revision) {
    // DB trigger fires when the cap is hit concurrently — surface it as 409 not 500
    if (insertError?.code === 'P0001' && insertError?.message === 'max_targeted_revisions_exceeded') {
      return NextResponse.json(
        {
          error: `Maximum targeted revisions (${MAX_TARGETED_REVISIONS}) reached for this draft. Consider requesting a full rewrite instead.`,
          code: 'MAX_TARGETED_REVISIONS_EXCEEDED',
          targeted_revision_count: MAX_TARGETED_REVISIONS,
        },
        { status: 409 }
      )
    }
    console.error('[targeted-revision] DB error inserting revision:', insertError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // --- Transition post to 'revision' status if not already there ---
  if (post.status === 'pending_review') {
    let statusUpdate = supabase
      .from('posts')
      .update({ status: 'revision', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', auth.organizationId)

    if (!isSharedOrgAgentContext(auth)) {
      statusUpdate = statusUpdate.eq('user_id', auth.userId)
    }

    const { error: statusError } = await statusUpdate

    if (statusError) {
      console.error('[targeted-revision] DB error transitioning status:', statusError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  // --- Log activity ---
  const providerRunId = request.headers.get('x-paperclip-run-id')
  logAgentActivity({
    organizationId: auth.organizationId,
    agentId: auth.agentId,
    postId: id,
    actionType: 'draft_updated',
    metadata: {
      action: 'targeted_revision_requested',
      revision_id: revision.id,
      range_count: revisions.length,
      previous_status: post.status,
      targeted_revision_count: targetedCount + 1,
    },
    providerMetadata: providerRunId ? { provider_run_id: providerRunId } : undefined,
  })

  return NextResponse.json(
    {
      id: revision.id,
      post_id: id,
      status: 'revision',
      targeted_revision_count: targetedCount + 1,
      range_count: revisions.length,
      created_at: revision.created_at,
    },
    { status: 201 }
  )
}
