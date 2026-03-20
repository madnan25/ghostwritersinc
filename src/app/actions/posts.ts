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
