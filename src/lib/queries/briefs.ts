import { createClient } from '@/lib/supabase/server'
import type { BriefStatus } from '@/lib/types'

export interface BriefFilters {
  status?: BriefStatus
  pillar_id?: string
  publish_at_from?: string
  publish_at_to?: string
}

export interface BriefWithContext {
  id: string
  organization_id: string
  pillar_id: string | null
  angle: string
  research_refs: string[]
  voice_notes: string | null
  publish_at: string | null
  status: BriefStatus
  source: string
  priority: string
  revision_count: number
  revision_notes: string | null
  assigned_agent_id: string | null
  created_at: string
  updated_at: string
  pillar_name: string | null
  pillar_color: string | null
  linked_post_count: number
  linked_post_id: string | null
}

function logQueryError(context: string, error: unknown) {
  console.error(`[briefs:${context}]`, error)
}

export async function getBriefs(filters: BriefFilters = {}): Promise<BriefWithContext[]> {
  const supabase = await createClient()

  let query = supabase
    .from('briefs')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.pillar_id) {
    query = query.eq('pillar_id', filters.pillar_id)
  }
  if (filters.publish_at_from) {
    query = query.gte('publish_at', filters.publish_at_from)
  }
  if (filters.publish_at_to) {
    query = query.lte('publish_at', filters.publish_at_to)
  }

  const { data: briefs, error } = await query

  if (error) {
    logQueryError('list', error)
    return []
  }

  if (!briefs || briefs.length === 0) return []

  const pillarIds = Array.from(
    new Set(briefs.map((b) => b.pillar_id).filter((id): id is string => !!id)),
  )
  const briefIds = briefs.map((b) => b.id)

  const [{ data: pillars }, { data: linkedPosts }] = await Promise.all([
    pillarIds.length > 0
      ? supabase.from('content_pillars').select('id, name, color').in('id', pillarIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; color: string }> }),
    supabase
      .from('posts')
      .select('id, brief_id')
      .in('brief_id', briefIds)
      .order('created_at', { ascending: false }),
  ])

  const pillarById = new Map(
    ((pillars ?? []) as Array<{ id: string; name: string; color: string }>).map((p) => [p.id, p]),
  )

  const postCountByBriefId = new Map<string, number>()
  const firstPostByBriefId = new Map<string, string>()
  for (const post of linkedPosts ?? []) {
    if (post.brief_id) {
      postCountByBriefId.set(post.brief_id, (postCountByBriefId.get(post.brief_id) ?? 0) + 1)
      if (!firstPostByBriefId.has(post.brief_id)) {
        firstPostByBriefId.set(post.brief_id, post.id)
      }
    }
  }

  return briefs.map((brief) => {
    const pillar = brief.pillar_id ? pillarById.get(brief.pillar_id) : null
    return {
      ...brief,
      pillar_name: pillar?.name ?? null,
      pillar_color: pillar?.color ?? null,
      linked_post_count: postCountByBriefId.get(brief.id) ?? 0,
      linked_post_id: firstPostByBriefId.get(brief.id) ?? null,
    }
  })
}
