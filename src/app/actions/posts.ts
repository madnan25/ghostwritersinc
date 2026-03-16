'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { PostStatus } from '@/lib/types'
import { validateTransition } from '@/lib/workflow'

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

export async function approvePost(postId: string) {
  await transitionPostStatus(postId, 'approved', 'client')
}

export async function rejectPost(postId: string, reason: string) {
  await transitionPostStatus(postId, 'rejected', 'client', {
    rejectionReason: reason,
  })
}

export async function submitForAgentReview(postId: string, notes?: string) {
  await transitionPostStatus(postId, 'agent_review', 'system', { notes })
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

  revalidatePath('/dashboard')
  revalidatePath(`/post/${postId}`)
}

export async function reviseDraft(postId: string) {
  await transitionPostStatus(postId, 'draft', 'client', {
    notes: 'Returned to draft for revision',
  })
}
