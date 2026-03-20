'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { PostStatus } from '@/lib/types'
import { getLatestBriefVersion } from '@/lib/brief-versioning'
import { buildVersionedContentUpdate } from '@/lib/post-versioning'
import { validateTransition } from '@/lib/workflow'
import { createStrategyReviewTask, createReReviewTask } from '@/lib/paperclip'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function tryCreateNotification(
  supabase: Awaited<ReturnType<typeof createClient>>,
  notification: {
    organization_id: string
    user_id: string
    type: string
    title: string
    body?: string
    post_id?: string
  },
) {
  // Best-effort — silently ignore if RLS blocks the insert
  try {
    await supabase.from('notifications').insert(notification)
  } catch {
    // ignore
  }
}

async function getPostWithUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string,
) {
  const { data } = await supabase
    .from('posts')
    .select('user_id, content, organization_id')
    .eq('id', postId)
    .single()
  return data
}

async function transitionPostStatus(
  postId: string,
  to: PostStatus,
  agentName: string,
  opts?: { rejectionReason?: string; notes?: string }
) {
  const supabase = await createClient()

  // Fetch current post to get its status + version info for snapshotting
  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('status, content, content_version, brief_id, brief_version_id')
    .eq('id', postId)
    .single()

  if (fetchError || !post) {
    throw new Error(fetchError?.message ?? 'Post not found')
  }

  const from = post.status as PostStatus

  // Validate the transition — throws WorkflowError if invalid
  const { reviewAction, updateFields } = validateTransition({
    postId,
    from,
    to,
    agentName,
    notes: opts?.notes ?? null,
    rejectionReason: opts?.rejectionReason ?? null,
  })

  // Snapshot content into post_revisions on pending_review transitions
  if (to === 'pending_review') {
    const version = post.content_version ?? 1
    await supabase.from('post_revisions').upsert(
      {
        post_id: postId,
        version,
        content: post.content,
        brief_version_id: post.brief_version_id ?? null,
      },
      { onConflict: 'post_id,version' }
    )
  }

  // Update the post status
  const { error: updateError } = await supabase
    .from('posts')
    .update(updateFields)
    .eq('id', postId)

  if (updateError) throw new Error(updateError.message)

  // Create review event for the transition
  await supabase.from('review_events').insert({
    post_id: postId,
    agent_name: agentName,
    action: reviewAction,
    notes: opts?.rejectionReason ?? opts?.notes ?? null,
  })

  revalidatePath('/dashboard')
  revalidatePath(`/post/${postId}`)
}

async function approveThenSchedulePost(postId: string, publishAt: string) {
  const supabase = await createClient()

  await transitionPostStatus(postId, 'approved', 'client')
  await transitionPostStatus(postId, 'scheduled', 'client', {
    notes: `Approved and scheduled for ${publishAt}`,
  })

  const { error } = await supabase
    .from('posts')
    .update({ scheduled_publish_at: publishAt })
    .eq('id', postId)

  if (error) throw new Error(error.message)

  return supabase
}

// ---------------------------------------------------------------------------
// Inline comments
// ---------------------------------------------------------------------------

export async function addPostComment(
  postId: string,
  body: string,
  selectedText?: string,
  selectionStart?: number,
  selectionEnd?: number,
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Fetch current post state to stamp content_version and check for auto-revert
  const { data: post } = await supabase
    .from('posts')
    .select('status, content_version, user_id, organization_id, content')
    .eq('id', postId)
    .single()

  const { data: comment, error } = await supabase
    .from('post_comments')
    .insert({
      post_id: postId,
      author_type: 'user',
      author_id: user.id,
      body,
      selected_text: selectedText ?? null,
      selection_start: selectionStart ?? null,
      selection_end: selectionEnd ?? null,
      content_version: post?.content_version ?? 1,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  // Create a Strategist review task in Paperclip so the agent picks up the comment
  const postTitle = post?.content?.slice(0, 80) ?? `Post ${postId.slice(0, 8)}`
  await createStrategyReviewTask({
    postId,
    postTitle,
    commentId: comment.id,
    commentBody: body,
    selectedText: selectedText ?? null,
  })

  // Auto-revert approved posts to pending_review when a user comments (LIN-225)
  if (post?.status === 'approved') {
    await transitionPostStatus(postId, 'pending_review', 'user', {
      notes: 'Reverted from approved — user commented',
    })

    if (post.user_id) {
      await tryCreateNotification(supabase, {
        organization_id: post.organization_id,
        user_id: post.user_id,
        type: 'post_reverted',
        title: 'Post reverted for review',
        body: 'Your comment triggered a re-review of this post.',
        post_id: postId,
      })
    }
  }

  revalidatePath(`/post/${postId}`)
}

// ---------------------------------------------------------------------------
// Review actions
// ---------------------------------------------------------------------------

export async function approvePost(postId: string) {
  const supabase = await createClient()

  // If the post has a suggested_publish_at, auto-schedule it
  const { data: postData } = await supabase
    .from('posts')
    .select('suggested_publish_at, user_id, content, organization_id')
    .eq('id', postId)
    .single()

  if (postData?.suggested_publish_at) {
    // Auto-schedule with the brief's suggested date after explicit approval.
    await approveThenSchedulePost(postId, postData.suggested_publish_at)
  } else {
    await transitionPostStatus(postId, 'approved', 'client')
  }

  const post = postData ?? await getPostWithUser(supabase, postId)
  if (post?.user_id) {
    await tryCreateNotification(supabase, {
      organization_id: post.organization_id,
      user_id: post.user_id,
      type: 'post_approved',
      title: postData?.suggested_publish_at ? 'Post approved and scheduled' : 'Post approved',
      body: (postData?.content ?? '').slice(0, 80),
      post_id: postId,
    })
  }

  revalidatePath('/dashboard')
  revalidatePath(`/post/${postId}`)
}

export async function approveAndSchedulePost(postId: string, publishAt: string) {
  const supabase = await approveThenSchedulePost(postId, publishAt)

  const post = await getPostWithUser(supabase, postId)
  if (post?.user_id) {
    await tryCreateNotification(supabase, {
      organization_id: post.organization_id,
      user_id: post.user_id,
      type: 'post_approved',
      title: 'Post approved and scheduled',
      body: post.content.slice(0, 80),
      post_id: postId,
    })
  }

  revalidatePath('/dashboard')
  revalidatePath(`/post/${postId}`)
}

export async function rejectPost(postId: string, reason: string) {
  await transitionPostStatus(postId, 'rejected', 'client', {
    rejectionReason: reason,
  })

  const supabase = await createClient()
  const post = await getPostWithUser(supabase, postId)
  if (post?.user_id) {
    await tryCreateNotification(supabase, {
      organization_id: post.organization_id,
      user_id: post.user_id,
      type: 'post_rejected',
      title: 'Post rejected',
      body: reason.slice(0, 80),
      post_id: postId,
    })
  }
}

export async function submitForAgentReview(postId: string, notes?: string) {
  await transitionPostStatus(postId, 'pending_review', 'system', { notes })
}

export async function submitForClientReview(
  postId: string,
  agentName: string,
  notes?: string
) {
  await transitionPostStatus(postId, 'pending_review', agentName, { notes })
}

export async function schedulePost(postId: string, publishAt: string) {
  const supabase = await createClient()

  // First transition status
  await transitionPostStatus(postId, 'scheduled', 'client', {
    notes: `Scheduled for ${publishAt}`,
  })

  // Then set the scheduled publish time
  const { error } = await supabase
    .from('posts')
    .update({ scheduled_publish_at: publishAt })
    .eq('id', postId)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard')
  revalidatePath(`/post/${postId}`)
}

export async function cancelScheduledPost(postId: string) {
  const supabase = await createClient()

  await transitionPostStatus(postId, 'approved', 'client', {
    notes: 'Scheduled publish cancelled',
  })

  const { error } = await supabase
    .from('posts')
    .update({ scheduled_publish_at: null })
    .eq('id', postId)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard')
  revalidatePath(`/post/${postId}`)
}

export async function reschedulePost(postId: string, publishAt: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('posts')
    .update({ scheduled_publish_at: publishAt })
    .eq('id', postId)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard')
  revalidatePath(`/post/${postId}`)
}

export async function publishPost(postId: string, linkedinPostUrn?: string) {
  const supabase = await createClient()

  await transitionPostStatus(postId, 'published', 'system', {
    notes: linkedinPostUrn
      ? `Published to LinkedIn (${linkedinPostUrn})`
      : 'Published',
  })

  const updateFields: Record<string, unknown> = {
    published_at: new Date().toISOString(),
  }
  if (linkedinPostUrn) {
    updateFields.linkedin_post_urn = linkedinPostUrn
  }

  const { error } = await supabase
    .from('posts')
    .update(updateFields)
    .eq('id', postId)

  if (error) throw new Error(error.message)

  const post = await getPostWithUser(supabase, postId)
  if (post?.user_id) {
    await tryCreateNotification(supabase, {
      organization_id: post.organization_id,
      user_id: post.user_id,
      type: 'post_published',
      title: 'Post published to LinkedIn',
      post_id: postId,
    })
  }

  revalidatePath('/dashboard')
  revalidatePath(`/post/${postId}`)
}

export async function updatePostContent(postId: string, content: string) {
  const supabase = await createClient()

  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('status, content, content_version, brief_id, brief_version_id')
    .eq('id', postId)
    .single()

  if (fetchError || !post) {
    throw new Error(fetchError?.message ?? 'Post not found')
  }

  const nextContent = content.trim()
  if (nextContent === post.content) {
    revalidatePath('/dashboard')
    revalidatePath(`/post/${postId}`)
    return
  }

  const currentVersion = post.content_version ?? 1
  const latestBriefVersion =
    post.brief_id ? await getLatestBriefVersion(supabase, post.brief_id) : null
  const { updateFields } = buildVersionedContentUpdate({
    status: post.status as PostStatus,
    currentVersion,
  })

  await supabase.from('post_revisions').upsert(
    {
      post_id: postId,
      version: currentVersion,
      content: post.content,
      brief_version_id: post.brief_version_id ?? null,
    },
    { onConflict: 'post_id,version' },
  )

  const { error } = await supabase
    .from('posts')
    .update({
      ...updateFields,
      content: nextContent,
      brief_version_id: latestBriefVersion?.id ?? post.brief_version_id ?? null,
    })
    .eq('id', postId)

  if (error) throw new Error(error.message)

  if (post.status !== 'draft') {
    await supabase.from('review_events').insert({
      post_id: postId,
      agent_name: 'client',
      action: 'revised' as const,
      notes: `Content updated and resubmitted for review (v${currentVersion + 1})`,
    })
  }

  revalidatePath('/dashboard')
  revalidatePath(`/post/${postId}`)
}

export async function reviseAndResubmit(postId: string) {
  const supabase = await createClient()

  // Fetch current post state
  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('status, content, content_version, user_id, organization_id, brief_version_id')
    .eq('id', postId)
    .single()

  if (fetchError || !post) {
    throw new Error(fetchError?.message ?? 'Post not found')
  }

  if (post.status !== 'rejected') {
    throw new Error('Only rejected posts can be revised and resubmitted')
  }

  const currentVersion = post.content_version ?? 1
  const newVersion = currentVersion + 1

  // Snapshot current content into post_revisions
  await supabase.from('post_revisions').insert({
    post_id: postId,
    version: currentVersion,
    content: post.content,
    brief_version_id: post.brief_version_id ?? null,
  })

  // Transition rejected → pending_review via validateTransition
  const { updateFields } = validateTransition({
    postId,
    from: 'rejected' as PostStatus,
    to: 'pending_review',
    agentName: 'client',
    notes: `Revised and resubmitted (v${newVersion})`,
  })

  // Increment content_version alongside the transition fields
  const { error: updateError } = await supabase
    .from('posts')
    .update({ ...updateFields, content_version: newVersion })
    .eq('id', postId)

  if (updateError) throw new Error(updateError.message)

  // Record review event
  await supabase.from('review_events').insert({
    post_id: postId,
    agent_name: 'client',
    action: 'revised' as const,
    notes: `Revised and resubmitted (v${newVersion})`,
  })

  // Notify the post owner for Strategist re-review
  if (post.user_id) {
    await tryCreateNotification(supabase, {
      organization_id: post.organization_id,
      user_id: post.user_id,
      type: 'post_submitted',
      title: 'Revised post resubmitted for review',
      body: post.content.slice(0, 80),
      post_id: postId,
    })
  }

  revalidatePath('/dashboard')
  revalidatePath(`/post/${postId}`)
}

export async function reviseDraft(postId: string) {
  await transitionPostStatus(postId, 'draft', 'client', {
    notes: 'Returned to draft for revision',
  })
}

/** Reopen a rejected post that has been through 3+ revision cycles.
 *  Resets content_version to 1 and sends back to pending_review for a fresh start.
 */
export async function reopenRejectedPost(postId: string, notes: string) {
  const supabase = await createClient()

  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('status, content, content_version, user_id, organization_id, brief_version_id')
    .eq('id', postId)
    .single()

  if (fetchError || !post) {
    throw new Error(fetchError?.message ?? 'Post not found')
  }

  if (post.status !== 'rejected') {
    throw new Error('Only rejected posts can be reopened')
  }

  // Snapshot current content before resetting
  const currentVersion = post.content_version ?? 1
  await supabase.from('post_revisions').insert({
    post_id: postId,
    version: currentVersion,
    content: post.content,
    revision_reason: `Reopened: ${notes}`,
    brief_version_id: post.brief_version_id ?? null,
  })

  // Transition back to pending_review and reset version to 1
  const { updateFields } = validateTransition({
    postId,
    from: 'rejected' as PostStatus,
    to: 'pending_review',
    agentName: 'client',
    notes: `Reopened after ${currentVersion} revision cycles: ${notes}`,
  })

  const { error: updateError } = await supabase
    .from('posts')
    .update({ ...updateFields, content_version: 1, rejection_reason: null })
    .eq('id', postId)

  if (updateError) throw new Error(updateError.message)

  await supabase.from('review_events').insert({
    post_id: postId,
    agent_name: 'client',
    action: 'revised' as const,
    notes: `Reopened: ${notes}`,
  })

  if (post.user_id) {
    await tryCreateNotification(supabase, {
      organization_id: post.organization_id,
      user_id: post.user_id,
      type: 'revision_requested',
      title: 'Post reopened for revision',
      body: notes.slice(0, 80),
      post_id: postId,
    })
  }

  revalidatePath('/dashboard')
  revalidatePath(`/post/${postId}`)
}

export async function requestReReview(postId: string) {
  const supabase = await createClient()

  const { data: post } = await supabase
    .from('posts')
    .select('status, reviewed_by_agent, content')
    .eq('id', postId)
    .single()

  if (!post) throw new Error('Post not found')
  if (post.status !== 'pending_review') throw new Error('Post must be at pending_review')
  if (!post.reviewed_by_agent) throw new Error('Post has not been reviewed by an agent')

  // Clear reviewed_by_agent — no status transition needed
  const { error } = await supabase
    .from('posts')
    .update({ reviewed_by_agent: null })
    .eq('id', postId)

  if (error) throw new Error(error.message)

  const postTitle = post.content?.slice(0, 80) ?? `Post ${postId.slice(0, 8)}`
  await createReReviewTask({ postId, postTitle })

  revalidatePath('/dashboard')
  revalidatePath(`/post/${postId}`)
}

export async function requestAgentReview(postId: string) {
  const supabase = await createClient()

  const { data: post } = await supabase
    .from('posts')
    .select('status, content, scheduled_publish_at')
    .eq('id', postId)
    .single()

  if (!post) throw new Error('Post not found')

  await transitionPostStatus(postId, 'pending_review', 'client', {
    notes: 'User requested agent review',
  })

  if (post.status === 'scheduled' && post.scheduled_publish_at) {
    await supabase
      .from('posts')
      .update({ scheduled_publish_at: null })
      .eq('id', postId)
  }

  const postTitle = post.content?.slice(0, 80) ?? `Post ${postId.slice(0, 8)}`
  await createStrategyReviewTask({
    postId,
    postTitle,
    commentId: '',
    commentBody: 'User requested agent review',
    selectedText: null,
  })

  revalidatePath('/dashboard')
  revalidatePath(`/post/${postId}`)
}

export async function requestRevision(postId: string) {
  const supabase = await createClient()

  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('status, organization_id')
    .eq('id', postId)
    .single()

  if (fetchError || !post) {
    throw new Error(fetchError?.message ?? 'Post not found')
  }

  if (post.status !== 'pending_review') {
    throw new Error(`Revision can only be requested from pending_review (got '${post.status}')`)
  }

  const { error: updateError } = await supabase
    .from('posts')
    .update({ status: 'revision', updated_at: new Date().toISOString() })
    .eq('id', postId)

  if (updateError) throw new Error(updateError.message)

  await supabase.from('review_events').insert({
    post_id: postId,
    agent_name: 'client',
    action: 'revised' as const,
    notes: 'User requested revision',
  })

  revalidatePath('/dashboard')
  revalidatePath(`/post/${postId}`)
}

export async function deletePost(postId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard')
}

// ---------------------------------------------------------------------------
// LinkedIn publishing
// ---------------------------------------------------------------------------

export async function publishToLinkedIn(
  postId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Fetch post
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id, status, content')
    .eq('id', postId)
    .single()

  if (postError || !post)
    return { success: false, error: 'Post not found' }

  if (post.status !== 'approved' && post.status !== 'scheduled' && post.status !== 'publish_failed')
    return {
      success: false,
      error: 'Post must be approved, scheduled, or in a failed state to publish',
    }

  // Fetch user's LinkedIn credentials
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('linkedin_id, settings')
    .eq('id', user.id)
    .single()

  if (userError || !userData)
    return { success: false, error: 'User profile not found' }

  const linkedinId = userData.linkedin_id
  const encryptedToken = (userData.settings as Record<string, unknown>)
    ?.linkedin_access_token_encrypted as string | undefined

  if (!linkedinId || !encryptedToken)
    return {
      success: false,
      error:
        'LinkedIn account not connected. Please connect your LinkedIn account in settings.',
    }

  // Decrypt token
  const { decrypt } = await import('@/lib/crypto')
  let accessToken: string
  try {
    accessToken = decrypt(encryptedToken)
  } catch {
    return {
      success: false,
      error:
        'LinkedIn token is invalid. Please reconnect your LinkedIn account.',
    }
  }

  // Call LinkedIn API with retry
  let linkedinPostUrn: string | undefined
  let lastError: string | undefined

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(
        'https://api.linkedin.com/rest/posts',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'LinkedIn-Version': '202503',
            'X-Restli-Protocol-Version': '2.0.0',
          },
          body: JSON.stringify({
            author: `urn:li:person:${linkedinId}`,
            commentary: post.content,
            visibility: 'PUBLIC',
            distribution: {
              feedDistribution: 'MAIN_FEED',
              targetEntities: [],
              thirdPartyDistributionChannels: [],
            },
            lifecycleState: 'PUBLISHED',
            isReshareDisabledByAuthor: false,
          }),
        }
      )

      if (response.status === 401) {
        return {
          success: false,
          error:
            'LinkedIn token expired. Please reconnect your LinkedIn account.',
        }
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after')
        return {
          success: false,
          error: `LinkedIn rate limit reached. Please try again ${retryAfter ? `in ${retryAfter} seconds` : 'later'}.`,
        }
      }

      if (!response.ok) {
        const body = await response.text()
        lastError = `LinkedIn API error (${response.status}): ${body}`
        // Retry on 5xx
        if (response.status >= 500) {
          await new Promise((r) =>
            setTimeout(r, Math.pow(2, attempt) * 1000)
          )
          continue
        }
        return { success: false, error: lastError }
      }

      linkedinPostUrn =
        response.headers.get('x-restli-id') ?? undefined
      break
    } catch (err) {
      lastError = `Network error: ${err instanceof Error ? err.message : 'Unknown error'}`
      if (attempt < 2) {
        await new Promise((r) =>
          setTimeout(r, Math.pow(2, attempt) * 1000)
        )
        continue
      }
    }
  }

  if (!linkedinPostUrn && lastError) {
    return { success: false, error: lastError }
  }

  // Transition to published
  try {
    await publishPost(postId, linkedinPostUrn)
  } catch (err) {
    return {
      success: false,
      error: `Failed to update post status: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// Human brief request (user-initiated)
// ---------------------------------------------------------------------------

export async function createHumanBriefRequest(data: {
  topic: string
  angle?: string
  publishWeek?: string | null
  priority?: 'normal' | 'urgent'
  notes?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile) throw new Error('Profile not found')

  // Server-side validation
  if (!data.topic?.trim()) throw new Error('Topic is required')
  if (data.topic.trim().length > 500) throw new Error('Topic too long')
  if (data.angle && data.angle.trim().length > 2000) throw new Error('Angle too long')
  if (data.notes && data.notes.trim().length > 5000) throw new Error('Notes too long')
  if (data.priority && !['normal', 'urgent'].includes(data.priority)) {
    throw new Error('Invalid priority')
  }

  // Parse YYYY-Www week input → Monday of that week
  let publishAt: string | null = null
  if (data.publishWeek) {
    const match = data.publishWeek.match(/^(\d{4})-W(\d{2})$/)
    if (!match) throw new Error('Invalid publish week format')
    const year = parseInt(match[1], 10)
    const week = parseInt(match[2], 10)
    if (week < 1 || week > 53) throw new Error('Invalid week number')
    // ISO week date: Jan 4 is always in week 1
    const jan4 = new Date(Date.UTC(year, 0, 4))
    const dayOfWeek = jan4.getUTCDay() || 7 // Mon=1..Sun=7
    const monday = new Date(jan4.getTime() + ((week - 1) * 7 - (dayOfWeek - 1)) * 86400000)
    publishAt = monday.toISOString()
  }

  // Compose voice_notes from optional fields
  const voiceParts: string[] = []
  if (data.angle) voiceParts.push(`Hook: ${data.angle}`)
  if (data.notes) voiceParts.push(data.notes)

  const { error } = await supabase.from('briefs').insert({
    organization_id: profile.organization_id,
    angle: data.topic.trim(),
    voice_notes: voiceParts.length > 0 ? voiceParts.join('\n') : null,
    publish_at: publishAt,
    source: 'human_request',
    priority: data.priority ?? 'normal',
  })

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard')
  revalidatePath('/calendar')
  revalidatePath('/strategy')
}

// ---------------------------------------------------------------------------
// Targeted revision (user-initiated)
// ---------------------------------------------------------------------------

const MAX_TARGETED_REVISIONS = 3

export async function submitTargetedRevision(
  postId: string,
  revisions: { start_char: number; end_char: number; note: string }[]
) {
  if (!revisions.length || revisions.length > MAX_TARGETED_REVISIONS) {
    throw new Error(`Must provide 1-${MAX_TARGETED_REVISIONS} revision sections`)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile) throw new Error('Profile not found')

  // Validate each revision range
  for (const rev of revisions) {
    if (!Number.isInteger(rev.start_char) || !Number.isInteger(rev.end_char)) {
      throw new Error('Character offsets must be integers')
    }
    if (rev.start_char < 0 || rev.end_char <= rev.start_char) {
      throw new Error(`Invalid range: [${rev.start_char}, ${rev.end_char})`)
    }
    if (!rev.note || rev.note.length > 1000) {
      throw new Error('Each revision note must be 1-1000 characters')
    }
  }

  // Check for overlapping ranges
  const sorted = [...revisions].sort((a, b) => a.start_char - b.start_char)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start_char < sorted[i - 1].end_char) {
      throw new Error('Revision ranges must not overlap')
    }
  }

  // Fetch the post (scoped to user's org)
  const { data: post } = await supabase
    .from('posts')
    .select('id, organization_id, status, content, content_version, brief_version_id')
    .eq('id', postId)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!post) throw new Error('Post not found')

  if (!['pending_review', 'revision'].includes(post.status)) {
    throw new Error(`Cannot request targeted revision on a post with status '${post.status}'`)
  }

  const content: string = post.content ?? ''

  // Validate ranges against actual content length
  for (const rev of revisions) {
    if (rev.end_char > content.length) {
      throw new Error(`Range [${rev.start_char}, ${rev.end_char}) exceeds content length (${content.length})`)
    }
  }

  // Check cap on existing targeted revisions for this draft
  const { count: existingCount } = await supabase
    .from('post_revisions')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', postId)
    .eq('revision_type', 'targeted')

  if ((existingCount ?? 0) >= MAX_TARGETED_REVISIONS) {
    throw new Error('Maximum targeted revisions reached for this draft. Consider a full rewrite.')
  }

  // Build revision data
  const flaggedSections = revisions.map(({ start_char, end_char, note }) => ({
    start_char,
    end_char,
    note,
  }))

  const diffSections = revisions.map(({ start_char, end_char }) => ({
    start_char,
    end_char,
    before_text: content.slice(start_char, end_char),
    after_text: null,
  }))

  // Insert targeted revision record
  const { error: insertError } = await supabase
    .from('post_revisions')
    .insert({
      post_id: postId,
      version: null,
      content,
      revised_by_agent: null,
      revision_type: 'targeted',
      flagged_sections: flaggedSections,
      diff_sections: diffSections,
      brief_version_id: post.brief_version_id ?? null,
    })

  if (insertError) throw new Error(insertError.message)

  // Transition post to 'revision' status
  if (post.status === 'pending_review') {
    await supabase
      .from('posts')
      .update({ status: 'revision', updated_at: new Date().toISOString() })
      .eq('id', postId)
      .eq('organization_id', profile.organization_id)
  }

  revalidatePath(`/post/${postId}`)
}

// ---------------------------------------------------------------------------
// Staleness actions (LIN-510)
// ---------------------------------------------------------------------------

export async function archivePost(postId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('posts')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', postId)

  if (error) throw new Error(error.message)

  revalidatePath('/calendar')
  revalidatePath(`/post/${postId}`)
}

export async function restorePost(postId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('posts')
    .update({ archived_at: null })
    .eq('id', postId)

  if (error) throw new Error(error.message)

  revalidatePath('/calendar')
  revalidatePath(`/post/${postId}`)
}

export async function markPostStillValid(postId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: post } = await supabase
    .from('posts')
    .select('freshness_type')
    .eq('id', postId)
    .single()

  if (!post || post.freshness_type !== 'time_sensitive') {
    return // no-op for non-time_sensitive posts
  }

  const { error } = await supabase
    .from('posts')
    .update({ expiry_date: null })
    .eq('id', postId)

  if (error) throw new Error(error.message)

  revalidatePath(`/post/${postId}`)
  revalidatePath('/calendar')
}

export async function requestPostUpdate(postId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('status, organization_id, user_id, content')
    .eq('id', postId)
    .single()

  if (fetchError || !post) throw new Error('Post not found')

  // For non-published posts, send back to draft for a content refresh
  if (['approved', 'scheduled', 'revision', 'pending_review'].includes(post.status)) {
    const { error } = await supabase
      .from('posts')
      .update({
        status: 'draft',
        scheduled_publish_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)

    if (error) throw new Error(error.message)

    await supabase.from('review_events').insert({
      post_id: postId,
      agent_name: 'client',
      action: 'revised' as const,
      notes: 'Update requested due to content staleness',
    })
  }

  // Always create a notification for the content team
  if (post.user_id) {
    await tryCreateNotification(supabase, {
      organization_id: post.organization_id,
      user_id: post.user_id,
      type: 'update_requested',
      title: 'Content update requested',
      body: 'A post was flagged for update due to staleness.',
      post_id: postId,
    })
  }

  revalidatePath('/dashboard')
  revalidatePath('/calendar')
  revalidatePath(`/post/${postId}`)
}

// ---------------------------------------------------------------------------
// Performance logging (LIN-473)
// ---------------------------------------------------------------------------

export interface PostPerformanceInput {
  impressions?: number | null
  reactions?: number | null
  comments_count?: number | null
  reposts?: number | null
  qualitative_notes?: string | null
}

export async function logPostPerformance(postId: string, data: PostPerformanceInput) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Verify post is published and belongs to the user's org
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('id, status, organization_id, user_id')
    .eq('id', postId)
    .single()

  if (postError || !post) throw new Error('Post not found')
  if (post.status !== 'published') throw new Error('Performance data can only be logged for published posts')

  // Validate non-negative integers
  const numericFields = ['impressions', 'reactions', 'comments_count', 'reposts'] as const
  for (const field of numericFields) {
    const val = data[field]
    if (val !== null && val !== undefined) {
      if (!Number.isInteger(val) || val < 0) {
        throw new Error(`${field} must be a non-negative integer`)
      }
    }
  }

  // Upsert into post_performance (one record per post — overwrite model)
  const { error } = await supabase
    .from('post_performance')
    .upsert(
      {
        post_id: postId,
        organization_id: post.organization_id,
        user_id: post.user_id,
        impressions: data.impressions ?? null,
        reactions: data.reactions ?? null,
        comments_count: data.comments_count ?? null,
        reposts: data.reposts ?? null,
        qualitative_notes: data.qualitative_notes ?? null,
        logged_at: new Date().toISOString(),
      },
      { onConflict: 'post_id' },
    )

  if (error) throw new Error(error.message)

  revalidatePath(`/post/${postId}`)
}
