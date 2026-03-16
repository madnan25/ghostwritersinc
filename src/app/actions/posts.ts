'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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

  const { error } = await supabase.from('post_comments').insert({
    post_id: postId,
    author_type: 'user',
    author_id: user.id,
    body,
    selected_text: selectedText ?? null,
    selection_start: selectionStart ?? null,
    selection_end: selectionEnd ?? null,
  })

  if (error) throw new Error(error.message)

  revalidatePath(`/post/${postId}`)
}

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

export async function approvePost(postId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('posts')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', postId)

  if (error) throw new Error(error.message)

  await supabase.from('review_events').insert({
    post_id: postId,
    agent_name: 'client',
    action: 'approved',
    notes: null,
  })

  const post = await getPostWithUser(supabase, postId)
  if (post) {
    await tryCreateNotification(supabase, {
      organization_id: post.organization_id,
      user_id: post.user_id,
      type: 'post_approved',
      title: 'Post approved',
      body: post.content.slice(0, 80),
      post_id: postId,
    })
  }

  revalidatePath('/dashboard')
  revalidatePath(`/post/${postId}`)
}

async function linkedInPostWithBackoff(
  token: string,
  authorUrn: string,
  content: string,
  maxRetries = 3,
): Promise<{ urn: string }> {
  const body = {
    author: authorUrn,
    commentary: content,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202406',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    })

    if (res.status === 429 && attempt < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000))
      continue
    }

    if (res.status === 401) throw new Error('LinkedIn token expired. Please sign out and sign in again.')
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`LinkedIn API error ${res.status}: ${text}`)
    }

    // LinkedIn returns the post URN in the X-RestLi-Id header
    const urn = res.headers.get('X-RestLi-Id') ?? res.headers.get('x-restli-id') ?? ''
    return { urn }
  }

  throw new Error('LinkedIn rate limit exceeded. Please try again later.')
}

export async function publishPost(postId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Fetch the post and user record in parallel
  const [{ data: post }, { data: dbUser }] = await Promise.all([
    supabase.from('posts').select('content, status').eq('id', postId).single(),
    supabase.from('users').select('linkedin_id, settings').eq('id', user.id).single(),
  ])

  if (!post) throw new Error('Post not found')
  if (post.status !== 'approved') throw new Error('Only approved posts can be published')
  if (!dbUser) throw new Error('User profile not found')

  const settings = (dbUser.settings ?? {}) as Record<string, string>
  const token = settings.linkedin_access_token
  if (!token) throw new Error('No LinkedIn access token found. Please sign out and sign in again.')

  if (!dbUser.linkedin_id) throw new Error('LinkedIn account not linked. Please sign out and sign in again.')
  const authorUrn = `urn:li:person:${dbUser.linkedin_id}`

  const { urn } = await linkedInPostWithBackoff(token, authorUrn, post.content)

  const { error } = await supabase
    .from('posts')
    .update({
      status: 'published',
      linkedin_post_urn: urn || null,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)

  if (error) throw new Error(error.message)

  const { data: dbPost } = await supabase
    .from('posts')
    .select('user_id, organization_id')
    .eq('id', postId)
    .single()
  if (dbPost) {
    await tryCreateNotification(supabase, {
      organization_id: dbPost.organization_id,
      user_id: dbPost.user_id,
      type: 'post_published',
      title: 'Post published to LinkedIn',
      post_id: postId,
    })
  }

  revalidatePath('/dashboard')
  revalidatePath(`/post/${postId}`)
}

export async function rejectPost(postId: string, reason: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('posts')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)

  if (error) throw new Error(error.message)

  await supabase.from('review_events').insert({
    post_id: postId,
    agent_name: 'client',
    action: 'rejected',
    notes: reason,
  })

  const post = await getPostWithUser(supabase, postId)
  if (post) {
    await tryCreateNotification(supabase, {
      organization_id: post.organization_id,
      user_id: post.user_id,
      type: 'post_rejected',
      title: 'Post rejected',
      body: reason.slice(0, 80),
      post_id: postId,
    })
  }

  revalidatePath('/dashboard')
  revalidatePath(`/post/${postId}`)
}
