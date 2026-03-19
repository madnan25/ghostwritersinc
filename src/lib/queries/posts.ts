import { createClient } from '@/lib/supabase/server'
import { logQueryError } from '@/lib/queries/errors'
import type { ContentPillar, Post, PostComment, PostRevision, PostStatus, ReviewEvent } from '@/lib/types'

function getLinkedInDisplayNameFromSettings(settings: unknown): string | null {
  if (!settings || typeof settings !== 'object') return null
  const v = (settings as Record<string, unknown>).linkedin_profile_name
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null
}

export async function getPendingReviewPosts(): Promise<Post[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'pending_review')
    .order('suggested_publish_at', { ascending: true })

  if (error) {
    logQueryError('pending review posts', error)
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
    logQueryError(`post ${id}`, error)
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
    logQueryError(`review events for post ${postId}`, error)
    return []
  }
  return data ?? []
}

export async function getPostComments(
  postId: string,
  /** When provided, only comments for this content version are returned */
  contentVersion?: number,
): Promise<PostComment[]> {
  const supabase = await createClient()
  let query = supabase
    .from('post_comments')
    .select('*')
    .eq('post_id', postId)

  if (contentVersion != null) {
    if (contentVersion === 1) {
      query = query.or('content_version.eq.1,content_version.is.null')
    } else {
      query = query.eq('content_version', contentVersion)
    }
  }

  const { data, error } = await query
    .order('created_at', { ascending: true })

  if (error) {
    logQueryError(`post comments for post ${postId}`, error)
    return []
  }

  const comments = data ?? []
  if (comments.length === 0) return comments

  const userIds = Array.from(
    new Set(
      comments
        .filter((c) => c.author_type === 'user')
        .map((c) => c.author_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  )

  const agentIds = Array.from(
    new Set(
      comments
        .filter((c) => c.author_type === 'agent')
        .map((c) => c.author_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  )

  const [usersResult, agentsResult, agentKeysResult] = await Promise.all([
    userIds.length
      ? supabase
          .from('users')
          .select('id, name, email, settings')
          .in('id', userIds)
      : Promise.resolve({ data: [], error: null as unknown }),
    agentIds.length
      ? supabase.from('agents').select('id, name').in('id', agentIds)
      : Promise.resolve({ data: [], error: null as unknown }),
    agentIds.length
      ? supabase.from('agent_keys').select('id, agent_name').in('id', agentIds)
      : Promise.resolve({ data: [], error: null as unknown }),
  ])

  const userById = new Map<
    string,
    { name: string | null; email: string | null; settings: unknown }
  >()
  for (const u of (usersResult.data ?? []) as Array<{
    id: string
    name: string | null
    email: string | null
    settings: unknown
  }>) {
    userById.set(u.id, { name: u.name ?? null, email: u.email ?? null, settings: u.settings })
  }

  const agentNameById = new Map<string, string>()
  for (const agent of (agentsResult.data ?? []) as Array<{ id: string; name: string }>) {
    if (agent?.id && agent?.name) agentNameById.set(agent.id, agent.name)
  }

  const agentNameByKeyId = new Map<string, string>()
  for (const k of (agentKeysResult.data ?? []) as Array<{ id: string; agent_name: string }>) {
    if (k?.id && k?.agent_name) agentNameByKeyId.set(k.id, k.agent_name)
  }

  return comments.map((comment) => {
    if (comment.author_type === 'user') {
      const profile = userById.get(comment.author_id)
      const linkedInName = profile ? getLinkedInDisplayNameFromSettings(profile.settings) : null
      const author_name = linkedInName ?? profile?.name ?? profile?.email ?? 'User'
      return { ...comment, author_name }
    }

    const author_name =
      agentNameById.get(comment.author_id) ??
      agentNameByKeyId.get(comment.author_id) ??
      comment.author_id ??
      'Agent'
    return { ...comment, author_name }
  })
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
    logQueryError(`posts by status ${statuses.join(',')}`, error)
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
    logQueryError('all posts', error)
    return []
  }

  const STATUS_ORDER: Record<string, number> = {
    pending_review: 0,
    draft: 1,
    approved: 2,
    scheduled: 3,
    published: 4,
    rejected: 5,
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
    .order('version', { ascending: false })

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
    logQueryError('scheduled posts', error)
    return []
  }
  return data ?? []
}

export interface CalendarPosts {
  scheduled: Post[]
  unscheduled: Post[]
}

/** Returns all approved/scheduled posts, split into scheduled (has date) and unscheduled (no date) */
export async function getCalendarPosts(): Promise<CalendarPosts> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .in('status', ['scheduled', 'approved'])
    .order('suggested_publish_at', { ascending: true })

  if (error) {
    logQueryError('calendar posts', error)
    return { scheduled: [], unscheduled: [] }
  }

  const all = data ?? []
  return {
    scheduled: all.filter((p) => !!p.scheduled_publish_at),
    unscheduled: all.filter((p) => !p.scheduled_publish_at),
  }
}

export async function getPillars(): Promise<ContentPillar[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_pillars')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    logQueryError('content pillars', error)
    return []
  }
  return data ?? []
}
