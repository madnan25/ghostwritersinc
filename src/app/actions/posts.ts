'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { PostStatus } from '@/lib/types'
import { validateTransition } from '@/lib/workflow'
import { createStrategyReviewTask } from '@/lib/paperclip'

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

async function snapshotRevision(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string,
  opts?: { revisedByAgent?: string; revisedByUser?: string; reason?: string },
) {
  // Fetch current content before it gets overwritten
  const { data: post } = await supabase
    .from('posts')
    .select('content')
    .eq('id', postId)
    .single()

  if (!post?.content) return

  // Use a database-level subquery for atomic version numbering to avoid race conditions.
  // Supabase JS client doesn't support subquery inserts, so we use rpc-style raw SQL.
  const { error } = await supabase.rpc('insert_post_revision', {
    p_post_id: postId,
    p_content: post.content,
    p_revised_by_agent: opts?.revisedByAgent ?? null,
    p_revised_by_user: opts?.revisedByUser ?? null,
    p_revision_reason: opts?.reason ?? null,
  })

  // Silently ignore — revision snapshots are best-effort
  if (error) {
    console.error('[snapshotRevision] Failed to insert revision:', error.message)
  }
}

async function transitionPostStatus(
  postId: string,
  to: PostStatus,
  agentName: string,
  opts?: { rejectionReason?: string; notes?: string }
) {
  const supabase = await createClient()

  // Fetch current post to get its status
  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('status')
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
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  // Auto-create a Strategist review task in Paperclip (best-effort)
  const post = await getPostWithUser(supabase, postId)
  const postTitle =
    post?.content?.slice(0, 80) ?? `Post ${postId.slice(0, 8)}`

  await createStrategyReviewTask({
    postId,
    postTitle,
    commentId: comment.id,
    commentBody: body,
    selectedText: selectedText ?? null,
  })

  revalidatePath(`/post/${postId}`)
}

// ---------------------------------------------------------------------------
// Review actions
// ---------------------------------------------------------------------------

export async function approvePost(postId: string) {
  await transitionPostStatus(postId, 'approved', 'client')

  const supabase = await createClient()
  const post = await getPostWithUser(supabase, postId)
  if (post?.user_id) {
    await tryCreateNotification(supabase, {
      organization_id: post.organization_id,
      user_id: post.user_id,
      type: 'post_approved',
      title: 'Post approved',
      body: post.content.slice(0, 80),
      post_id: postId,
    })
  }
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

  // Snapshot current content as a revision before overwriting
  await snapshotRevision(supabase, postId, { reason: 'Content updated' })

  const { error } = await supabase
    .from('posts')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', postId)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard')
  revalidatePath(`/post/${postId}`)
}

export async function reviseDraft(postId: string) {
  await transitionPostStatus(postId, 'draft', 'client', {
    notes: 'Returned to draft for revision',
  })
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deletePost(postId: string) {
  const supabase = await createClient()

  // Verify post exists and is deletable (draft or rejected only)
  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('id, status')
    .eq('id', postId)
    .single()

  if (fetchError || !post) {
    throw new Error(fetchError?.message ?? 'Post not found')
  }

  if (post.status !== 'draft' && post.status !== 'rejected') {
    throw new Error('Only draft or rejected posts can be deleted')
  }

  // Delete associated data first (comments, review events, revisions)
  await supabase.from('post_comments').delete().eq('post_id', postId)
  await supabase.from('review_events').delete().eq('post_id', postId)
  await supabase.from('post_revisions').delete().eq('post_id', postId)

  // Delete the post itself
  const { error: deleteError } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)

  if (deleteError) throw new Error(deleteError.message)

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

  if (post.status !== 'approved' && post.status !== 'scheduled')
    return {
      success: false,
      error: 'Post must be approved or scheduled to publish',
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
