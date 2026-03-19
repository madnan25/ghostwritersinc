import { NextRequest, NextResponse } from 'next/server'
import {
  authenticateAgent,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

/**
 * GET /api/research-pool/stats — aggregate stats for the research pool.
 * Returns: count by status, average score, pillar distribution.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'read'), { maxRequests: 60 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'research:read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: research:read access required' },
      { status: 403 }
    )
  }

  const supabase = createAdminClient()

  // Fetch all pool items for the org (only the fields we need for stats)
  const { data: items, error } = await supabase
    .from('research_pool')
    .select('id, status, relevance_score, pillar_id')
    .eq('organization_id', auth.organizationId)

  if (error) {
    console.error('[research-pool/stats] DB error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const pool = items ?? []

  // Count by status
  const byStatus: Record<string, number> = { new: 0, consumed: 0 }
  for (const item of pool) {
    byStatus[item.status] = (byStatus[item.status] ?? 0) + 1
  }

  // Average relevance score (only scored items)
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

  // Fetch pillar names for the distribution
  const pillarIds = Object.keys(pillarCounts)
  let pillarDistribution: Array<{ pillar_id: string; name: string; count: number }> = []

  if (pillarIds.length > 0) {
    const { data: pillars } = await supabase
      .from('content_pillars')
      .select('id, name')
      .in('id', pillarIds)

    const pillarMap = new Map((pillars ?? []).map((p) => [p.id, p.name]))
    pillarDistribution = pillarIds.map((id) => ({
      pillar_id: id,
      name: pillarMap.get(id) ?? 'Unknown',
      count: pillarCounts[id],
    }))
    pillarDistribution.sort((a, b) => b.count - a.count)
  }

  return NextResponse.json({
    total: pool.length,
    by_status: byStatus,
    avg_relevance_score: avgScore,
    scored_count: scored.length,
    pillar_distribution: pillarDistribution,
    unassigned_count: unassigned,
  })
}
