import { createClient } from '@/lib/supabase/server'
import type { ContentPillar, Post, PostComment, PostRevision, PostStatus, ReviewEvent } from '@/lib/types'

export async function getPendingReviewPosts(): Promise<Post[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'pending_review')
    .order('suggested_publish_at', { ascending: true })

  if (error) {
    console.error('Error fetching pending review posts:', error)
    return []
  }
  return data ?? []
}

export async function getPostById(id: string): Promise<Post | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching post:', error)
    return null
  }
  return data
}

export async function getPostReviewEvents(postId: string): Promise<ReviewEvent[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('review_events')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching review events:', error)
    return []
  }
  return data ?? []
}

export async function getPostComments(postId: string): Promise<PostComment[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('post_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching post comments:', error)
    return []
  }
  return data ?? []
}

export async function getPostsByStatus(status: PostStatus | PostStatus[]): Promise<Post[]> {
  const supabase = await createClient()
  const statuses = Array.isArray(status) ? status : [status]

  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .in('status', statuses)
    .order('suggested_publish_at', { ascending: true })

  if (error) {
    console.error('Error fetching posts by status:', error)
    return []
  }
  return data ?? []
}

export async function getAllPosts(): Promise<Post[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('suggested_publish_at', { ascending: true })

  if (error) {
    console.error('Error fetching all posts:', error)
    return []
  }

  const STATUS_ORDER: Record<string, number> = {
    pending_review: 0,
    agent_review: 1,
    draft: 2,
    approved: 3,
    scheduled: 4,
    published: 5,
    rejected: 6,
  }

  return (data ?? []).sort((a, b) => {
    const aOrder = STATUS_ORDER[a.status] ?? 99
    const bOrder = STATUS_ORDER[b.status] ?? 99
    return aOrder - bOrder
  })
}

export async function getPostRevisions(postId: string): Promise<PostRevision[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('post_revisions')
    .select('*')
    .eq('post_id', postId)
    .order('version_number', { ascending: false })

  if (error) {
    console.error('Error fetching post revisions:', error)
    return []
  }
  return data ?? []
}

export async function getRevisionCount(postId: string): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('post_revisions')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId)

  if (error) {
    console.error('Error fetching revision count:', error)
    return 0
  }
  return count ?? 0
}

export type PostWithRevisionCount = Post & { revision_count: number }

export async function getAllPostsWithRevisions(): Promise<PostWithRevisionCount[]> {
  const supabase = await createClient()

  // Fetch all posts
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select('*')
    .order('suggested_publish_at', { ascending: true })

  if (postsError) {
    console.error('Error fetching all posts:', postsError)
    return []
  }

  const allPosts = posts ?? []
  if (allPosts.length === 0) return []

  // Batch fetch revision counts
  const postIds = allPosts.map((p) => p.id)
  const { data: revisionRows, error: revError } = await supabase
    .from('post_revisions')
    .select('post_id')
    .in('post_id', postIds)

  const revisionCounts: Record<string, number> = {}
  if (!revError && revisionRows) {
    for (const row of revisionRows) {
      revisionCounts[row.post_id] = (revisionCounts[row.post_id] ?? 0) + 1
    }
  }

  const STATUS_ORDER: Record<string, number> = {
    pending_review: 0,
    agent_review: 1,
    draft: 2,
    approved: 3,
    scheduled: 4,
    published: 5,
    rejected: 6,
  }

  return allPosts
    .map((p) => ({ ...p, revision_count: revisionCounts[p.id] ?? 0 }))
    .sort((a, b) => {
      const aOrder = STATUS_ORDER[a.status] ?? 99
      const bOrder = STATUS_ORDER[b.status] ?? 99
      return aOrder - bOrder
    })
}

export async function getScheduledPosts(): Promise<Post[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .in('status', ['scheduled', 'approved'])
    .not('scheduled_publish_at', 'is', null)
    .order('scheduled_publish_at', { ascending: true })

  if (error) {
    console.error('Error fetching scheduled posts:', error)
    return []
  }
  return data ?? []
}

export async function getPillars(): Promise<ContentPillar[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_pillars')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching pillars:', error)
    return []
  }
  return data ?? []
}
