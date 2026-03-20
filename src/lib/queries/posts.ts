import { createClient } from '@/lib/supabase/server'
import { logQueryError } from '@/lib/queries/errors'
import type {
  Brief,
  BriefVersionWithContext,
  ContentPillar,
  Post,
  PostComment,
  PostRevision,
  PostStatus,
  ReviewEvent,
} from '@/lib/types'

function getLinkedInDisplayNameFromSettings(settings: unknown): string | null {
  if (!settings || typeof settings !== 'object') return null
  const v = (settings as Record<string, unknown>).linkedin_profile_name
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null
}

export async function getCurrentUserLinkedInName(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('settings')
    .eq('id', user.id)
    .maybeSingle()
  return profile ? getLinkedInDisplayNameFromSettings(profile.settings) : null
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
    revision: 1,
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
    revision: 2,
    draft: 3,
    approved: 4,
    scheduled: 5,
    published: 6,
    rejected: 7,
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

export interface BriefWithContext extends Brief {
  pillar_name: string | null
  pillar_color: string | null
  linked_post_count: number
}

export async function getBriefs(status?: string): Promise<BriefWithContext[]> {
  const supabase = await createClient()

  let query = supabase
    .from('briefs')
    .select('*')
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data: briefs, error } = await query

  if (error) {
    logQueryError('briefs list', error)
    return []
  }

  if (!briefs || briefs.length === 0) return []

  const pillarIds = Array.from(
    new Set(briefs.map((b) => b.pillar_id).filter((id): id is string => !!id)),
  )
  const briefIds = briefs.map((b) => b.id)

  const [{ data: pillars }, { data: postCounts }] = await Promise.all([
    pillarIds.length > 0
      ? supabase.from('content_pillars').select('id, name, color').in('id', pillarIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; color: string }> }),
    supabase.from('posts').select('brief_id').in('brief_id', briefIds),
  ])

  const pillarById = new Map(
    ((pillars ?? []) as Array<{ id: string; name: string; color: string }>).map((p) => [p.id, p]),
  )

  const postCountByBriefId = new Map<string, number>()
  for (const post of postCounts ?? []) {
    if (post.brief_id) {
      postCountByBriefId.set(post.brief_id, (postCountByBriefId.get(post.brief_id) ?? 0) + 1)
    }
  }

  return briefs.map((brief) => {
    const pillar = brief.pillar_id ? pillarById.get(brief.pillar_id) : null
    return {
      ...brief,
      pillar_name: pillar?.name ?? null,
      pillar_color: pillar?.color ?? null,
      linked_post_count: postCountByBriefId.get(brief.id) ?? 0,
    }
  })
}

export async function getBriefById(id: string): Promise<Brief | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('briefs')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    logQueryError(`brief ${id}`, error)
    return null
  }
  return data
}

export async function getBriefVersionsForPost(
  postId: string,
  briefId: string | null,
  currentPostVersion: number,
  currentBriefVersionId?: string | null,
): Promise<BriefVersionWithContext[]> {
  if (!briefId) return []

  const supabase = await createClient()
  const { data: versions, error } = await supabase
    .from('brief_versions')
    .select('*')
    .eq('brief_id', briefId)
    .order('version', { ascending: false })

  if (error) {
    logQueryError(`brief versions for brief ${briefId}`, error)
    return []
  }

  const briefVersions = versions ?? []
  if (briefVersions.length === 0) return []

  const assignedAgentIds = Array.from(
    new Set(
      briefVersions
        .map((version) => version.assigned_agent_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  )
  const researchIds = Array.from(
    new Set(
      briefVersions.flatMap((version) => version.research_refs ?? []),
    ),
  )

  const [{ data: agents }, { data: researchItems }, { data: postRevisions }] = await Promise.all([
    assignedAgentIds.length > 0
      ? supabase.from('agents').select('id, name').in('id', assignedAgentIds)
      : Promise.resolve({ data: [], error: null as unknown }),
    researchIds.length > 0
      ? supabase.from('research_pool').select('id, title, source_type').in('id', researchIds)
      : Promise.resolve({ data: [], error: null as unknown }),
    supabase
      .from('post_revisions')
      .select('version, brief_version_id')
      .eq('post_id', postId),
  ])

  const agentNameById = new Map(
    ((agents ?? []) as Array<{ id: string; name: string | null }>).map((agent) => [
      agent.id,
      agent.name ?? null,
    ]),
  )
  const researchById = new Map(
    ((researchItems ?? []) as Array<{ id: string; title: string; source_type: string }>).map((item) => [
      item.id,
      item,
    ]),
  )
  const linkedVersionsByBriefVersionId = new Map<string, number[]>()
  for (const revision of (postRevisions ?? []) as Array<{ version: number; brief_version_id: string | null }>) {
    if (!revision.brief_version_id) continue
    const existing = linkedVersionsByBriefVersionId.get(revision.brief_version_id) ?? []
    existing.push(revision.version)
    linkedVersionsByBriefVersionId.set(revision.brief_version_id, existing)
  }

  if (currentBriefVersionId) {
    const currentPostVersions = linkedVersionsByBriefVersionId.get(currentBriefVersionId) ?? []
    linkedVersionsByBriefVersionId.set(
      currentBriefVersionId,
      Array.from(new Set([...currentPostVersions, currentPostVersion])),
    )
  }

  return briefVersions.map((version) => ({
    ...version,
    assigned_agent_name: version.assigned_agent_id
      ? agentNameById.get(version.assigned_agent_id) ?? null
      : null,
    research_items: (version.research_refs ?? [])
      .map((id: string) => researchById.get(id))
      .filter(
        (item: { id: string; title: string; source_type: string } | undefined): item is {
          id: string
          title: string
          source_type: string
        } => Boolean(item),
      ),
    linked_post_versions: linkedVersionsByBriefVersionId.get(version.id) ?? [],
  }))
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

// ---------------------------------------------------------------------------
// Post performance (LIN-473) — reads from post_performance table (LIN-472)
// ---------------------------------------------------------------------------

export interface PostPerformanceRow {
  id: string
  post_id: string
  impressions: number | null
  reactions: number | null
  comments_count: number | null
  reposts: number | null
  qualitative_notes: string | null
  logged_at: string
}

export async function getPostPerformance(postId: string): Promise<PostPerformanceRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('post_performance')
    .select('id, post_id, impressions, reactions, comments_count, reposts, qualitative_notes, logged_at')
    .eq('post_id', postId)
    .maybeSingle()

  if (error) {
    logQueryError('post_performance', error)
    return null
  }
  return data ?? null
}

// ---------------------------------------------------------------------------
// Pillar weight overrides (LIN-473) — reads pillar_weights from strategy_config
// ---------------------------------------------------------------------------

export interface PillarWeightOverride {
  pillarId: string
  weightPct: number
}

export interface PillarWeightsConfig {
  weights: Record<string, number>
  scope: 'default' | 'monthly'
  monthlyExpired: boolean
}

export async function getPillarWeightsConfig(): Promise<PillarWeightsConfig | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile) return null

  const { data, error } = await supabase
    .from('strategy_config')
    .select('pillar_weights, pillar_weights_scope, pillar_weights_month')
    .eq('user_id', user.id)
    .eq('organization_id', profile.organization_id)
    .maybeSingle()

  if (error) {
    logQueryError('strategy_config pillar_weights', error)
    return null
  }
  if (!data || !data.pillar_weights) return null

  const scope = (data.pillar_weights_scope ?? 'default') as 'default' | 'monthly'
  const monthlyExpired =
    scope === 'monthly' && !!data.pillar_weights_month
      ? (() => {
          const now = new Date()
          const [year, mon] = (data.pillar_weights_month as string).split('-').map(Number)
          return !(year > now.getFullYear() || (year === now.getFullYear() && mon >= now.getMonth() + 1))
        })()
      : false

  return {
    weights: data.pillar_weights as Record<string, number>,
    scope,
    monthlyExpired,
  }
}

// ---------------------------------------------------------------------------
// Insights data — joins posts with post_performance and content_pillars
// ---------------------------------------------------------------------------

export interface PostWithPerformance {
  id: string
  content_type: string
  pillar_id: string | null
  pillar_name: string | null
  pillar_color: string | null
  published_at: string | null
  suggested_publish_at: string | null
  created_at: string
  impressions: number
  reactions: number
  comments_count: number
  reposts: number
}

export async function getInsightsData(): Promise<PostWithPerformance[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .select(`
      id,
      content_type,
      pillar_id,
      published_at,
      suggested_publish_at,
      created_at,
      content_pillars!posts_pillar_id_fkey (name, color),
      post_performance (impressions, reactions, comments_count, reposts)
    `)
    .eq('status', 'published')
    .not('post_performance', 'is', null)

  if (error) {
    logQueryError('insights data', error)
    return []
  }

  return (data ?? [])
    .filter((p: Record<string, unknown>) => {
      const perf = p.post_performance as unknown
      return perf !== null && typeof perf === 'object'
    })
    .map((p: Record<string, unknown>) => {
      const perf = p.post_performance as {
        impressions: number | null
        reactions: number | null
        comments_count: number | null
        reposts: number | null
      }
      const pillar = p.content_pillars as { name: string; color: string } | null

      return {
        id: p.id as string,
        content_type: (p.content_type as string) ?? 'text',
        pillar_id: p.pillar_id as string | null,
        pillar_name: pillar?.name ?? null,
        pillar_color: pillar?.color ?? null,
        published_at: p.published_at as string | null,
        suggested_publish_at: p.suggested_publish_at as string | null,
        created_at: p.created_at as string,
        impressions: perf.impressions ?? 0,
        reactions: perf.reactions ?? 0,
        comments_count: perf.comments_count ?? 0,
        reposts: perf.reposts ?? 0,
      }
    })
}
