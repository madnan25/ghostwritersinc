import { createClient } from '@/lib/supabase/server'
import { logQueryError } from '@/lib/queries/errors'
import type { ResearchPoolItem, ContentPillar } from '@/lib/types'

export interface ResearchPoolStats {
  total: number
  by_status: { new: number; consumed: number }
  avg_relevance_score: number | null
  scored_count: number
  pillar_distribution: Array<{
    pillar_id: string
    name: string
    color: string
    count: number
  }>
  unassigned_count: number
}

/** Fetch research pool stats for the current user's org (server component). */
export async function getResearchPoolStats(): Promise<ResearchPoolStats | null> {
  const supabase = await createClient()

  const { data: items, error } = await supabase
    .from('research_pool')
    .select('id, status, relevance_score, pillar_id')

  if (error) {
    logQueryError('research pool stats', error)
    return null
  }

  const pool = items ?? []

  const byStatus = { new: 0, consumed: 0 }
  for (const item of pool) {
    if (item.status === 'new') byStatus.new++
    else if (item.status === 'consumed') byStatus.consumed++
  }

  const scored = pool.filter((i) => i.relevance_score != null)
  const avgScore =
    scored.length > 0
      ? Math.round(
          (scored.reduce((sum, i) => sum + (i.relevance_score ?? 0), 0) / scored.length) * 100
        ) / 100
      : null

  // Pillar distribution
  const pillarCounts: Record<string, number> = {}
  let unassigned = 0
  for (const item of pool) {
    if (item.pillar_id) {
      pillarCounts[item.pillar_id] = (pillarCounts[item.pillar_id] ?? 0) + 1
    } else {
      unassigned++
    }
  }

  const pillarIds = Object.keys(pillarCounts)
  let pillarDistribution: ResearchPoolStats['pillar_distribution'] = []

  if (pillarIds.length > 0) {
    const { data: pillars } = await supabase
      .from('content_pillars')
      .select('id, name, color')
      .in('id', pillarIds)

    const pillarMap = new Map(
      (pillars ?? []).map((p) => [p.id, { name: p.name, color: p.color }])
    )
    pillarDistribution = pillarIds.map((id) => ({
      pillar_id: id,
      name: pillarMap.get(id)?.name ?? 'Unknown',
      color: pillarMap.get(id)?.color ?? '#6b7280',
      count: pillarCounts[id],
    }))
    pillarDistribution.sort((a, b) => b.count - a.count)
  }

  return {
    total: pool.length,
    by_status: byStatus,
    avg_relevance_score: avgScore,
    scored_count: scored.length,
    pillar_distribution: pillarDistribution,
    unassigned_count: unassigned,
  }
}

/** Fetch recent research pool items for display. */
export async function getRecentResearchItems(
  limit = 10
): Promise<(ResearchPoolItem & { pillar_name?: string })[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('research_pool')
    .select('*, content_pillars(name)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    logQueryError('recent research items', error)
    return []
  }

  return (data ?? []).map((item) => ({
    ...item,
    pillar_name: (item.content_pillars as unknown as { name: string } | null)?.name ?? undefined,
    content_pillars: undefined,
  }))
}
