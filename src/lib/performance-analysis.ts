/**
 * Performance Analysis — query published-post metrics and compute
 * pillar rebalancing, template preferences, and "What's Working" summaries.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PostWithMetrics {
  id: string
  pillar_id: string | null
  pillar_name: string | null
  title: string | null
  content: string
  status: string
  published_at: string | null
  suggested_publish_at: string | null
  created_at: string
  impressions: number
  reactions: number
  comments_count: number
  reposts: number
}

export interface PillarPerformance {
  pillar_id: string
  pillar_name: string
  post_count: number
  avg_impressions: number
  avg_reactions: number
  avg_comments_count: number
  avg_reposts: number
  avg_engagement: number // reactions + comments_count + reposts
  actual_pct: number // actual percentage of published posts
}

export interface WhatsWorkingSummary {
  generated_at: string
  data_points: number
  top_pillars: Array<{
    pillar_id: string
    pillar_name: string
    avg_engagement: number
    post_count: number
  }>
  best_posting_days: Array<{
    day: string // e.g. "Monday"
    avg_engagement: number
    post_count: number
  }>
  engagement_trends: {
    total_posts: number
    avg_impressions: number
    avg_engagement: number
    highest_performing_post: {
      post_id: string
      title: string | null
      engagement: number
    } | null
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetch published posts with their latest metrics for a given organization.
 * Returns posts with status 'published' that have at least one metrics entry.
 */
export async function getPublishedPostsWithMetrics(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<PostWithMetrics[]> {
  // Join posts with their post_performance entry and pillar name
  const { data, error } = await supabase
    .from('posts')
    .select(`
      id,
      pillar_id,
      title,
      content,
      status,
      published_at,
      suggested_publish_at,
      created_at,
      content_pillars!posts_pillar_id_fkey (name),
      post_performance!inner (impressions, reactions, comments_count, reposts, logged_at)
    `)
    .eq('organization_id', organizationId)
    .eq('status', 'published')

  if (error) {
    console.error('[performance-analysis] query error:', error)
    return []
  }

  return (data ?? [])
    .filter((p: Record<string, unknown>) => {
      // post_performance is a 1:1 relation (unique on post_id) — Supabase returns
      // it as a single object, not an array.
      const perf = p.post_performance
      return perf !== null && typeof perf === 'object' && !Array.isArray(perf)
    })
    .map((p: Record<string, unknown>) => {
      const latest = p.post_performance as {
        impressions: number
        reactions: number
        comments_count: number
        reposts: number
        logged_at: string
      }

      const pillarData = p.content_pillars as { name: string } | null

      return {
        id: p.id as string,
        pillar_id: p.pillar_id as string | null,
        pillar_name: pillarData?.name ?? null,
        title: p.title as string | null,
        content: p.content as string,
        status: p.status as string,
        published_at: p.published_at as string | null,
        suggested_publish_at: p.suggested_publish_at as string | null,
        created_at: p.created_at as string,
        impressions: latest.impressions ?? 0,
        reactions: latest.reactions ?? 0,
        comments_count: latest.comments_count ?? 0,
        reposts: latest.reposts ?? 0,
      }
    })
}

// ---------------------------------------------------------------------------
// Performance-aware pillar distribution
// ---------------------------------------------------------------------------

/**
 * Compute per-pillar performance stats from published posts with metrics.
 */
export function computePillarPerformance(
  posts: PostWithMetrics[],
  pillars: { id: string; name: string; weight_pct: number }[],
): PillarPerformance[] {
  const totalAssigned = posts.filter((p) => p.pillar_id).length

  return pillars.map((pillar) => {
    const pillarPosts = posts.filter((p) => p.pillar_id === pillar.id)
    const count = pillarPosts.length

    const sum = (fn: (p: PostWithMetrics) => number) =>
      count > 0 ? pillarPosts.reduce((s, p) => s + fn(p), 0) / count : 0

    return {
      pillar_id: pillar.id,
      pillar_name: pillar.name,
      post_count: count,
      avg_impressions: Math.round(sum((p) => p.impressions)),
      avg_reactions: Math.round(sum((p) => p.reactions)),
      avg_comments_count: Math.round(sum((p) => p.comments_count)),
      avg_reposts: Math.round(sum((p) => p.reposts)),
      avg_engagement: Math.round(sum((p) => p.reactions + p.comments_count + p.reposts)),
      actual_pct: totalAssigned > 0 ? Math.round((count / totalAssigned) * 100) : 0,
    }
  })
}

/**
 * Adjust pillar distribution to compensate for underweight pillars.
 * Uses 10% tolerance — only boosts pillars that deviate by more than
 * 10% of their target weight (e.g., target 30% → ±3% is acceptable).
 *
 * Returns an adjusted weight map that can be passed to distributeBriefsByWeight.
 */
export function computePerformanceAwareWeights(
  pillars: { id: string; weight_pct: number }[],
  pillarPerformance: PillarPerformance[],
): { id: string; weight_pct: number }[] {
  if (pillarPerformance.length === 0) return pillars

  const perfMap = new Map(pillarPerformance.map((p) => [p.pillar_id, p]))

  // Calculate deviation for each pillar
  const deviations = pillars.map((pillar) => {
    const perf = perfMap.get(pillar.id)
    const actualPct = perf?.actual_pct ?? 0
    const targetPct = pillar.weight_pct
    const tolerance = targetPct * 0.1 // 10% of target weight
    const deviation = targetPct - actualPct // positive means underweight

    return {
      id: pillar.id,
      weight_pct: pillar.weight_pct,
      deviation,
      needsBoost: deviation > tolerance,
      needsReduction: deviation < -tolerance,
    }
  })

  // Apply boost/reduction: increase underweight pillars by a proportional amount
  const adjusted = deviations.map((d) => {
    let adjustedWeight = d.weight_pct

    if (d.needsBoost) {
      // Boost by half the deviation (gradual correction)
      adjustedWeight = d.weight_pct + Math.round(d.deviation * 0.5)
    } else if (d.needsReduction) {
      // Reduce by half the deviation
      adjustedWeight = d.weight_pct + Math.round(d.deviation * 0.5)
    }

    return {
      id: d.id,
      weight_pct: Math.max(1, adjustedWeight), // never go below 1%
    }
  })

  // Renormalize so adjusted weights sum to 100
  const totalAdjusted = adjusted.reduce((s, p) => s + p.weight_pct, 0)
  if (totalAdjusted !== 100 && totalAdjusted > 0) {
    const normalized = adjusted.map((p) => ({
      id: p.id,
      weight_pct: Math.max(1, Math.round((p.weight_pct / totalAdjusted) * 100)),
    }))
    // Fix rounding drift: add remainder to the largest weight
    const normTotal = normalized.reduce((s, p) => s + p.weight_pct, 0)
    if (normTotal !== 100) {
      const maxEntry = normalized.reduce((a, b) => (a.weight_pct >= b.weight_pct ? a : b))
      maxEntry.weight_pct += 100 - normTotal
    }
    return normalized
  }

  return adjusted
}

/**
 * Score research items by how well they match high-performing topics/pillars.
 * Items in high-engagement pillars get a boost to their relevance score.
 */
export function boostResearchByPerformance(
  items: Array<{ id: string; pillar_id: string | null; relevance_score: number | null }>,
  pillarPerformance: PillarPerformance[],
): Map<string, number> {
  if (pillarPerformance.length === 0) return new Map()

  // Find the max avg_engagement to normalize
  const maxEngagement = Math.max(...pillarPerformance.map((p) => p.avg_engagement), 1)
  const perfMap = new Map(pillarPerformance.map((p) => [p.pillar_id, p]))

  const boosts = new Map<string, number>()

  for (const item of items) {
    const baseScore = item.relevance_score ?? 0.5
    if (!item.pillar_id) {
      boosts.set(item.id, baseScore)
      continue
    }

    const perf = perfMap.get(item.pillar_id)
    if (!perf || perf.post_count === 0) {
      boosts.set(item.id, baseScore)
      continue
    }

    // Boost by up to 20% based on pillar engagement performance
    const engagementFactor = perf.avg_engagement / maxEngagement
    const boost = baseScore * (1 + engagementFactor * 0.2)
    boosts.set(item.id, Math.min(1, boost))
  }

  return boosts
}

// ---------------------------------------------------------------------------
// "What's Working" summary generation
// ---------------------------------------------------------------------------

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Generate a "What's Working" summary from published posts with metrics.
 * Requires at least 5 data points (published posts with metrics).
 * Returns null if insufficient data.
 */
export function generateWhatsWorking(
  posts: PostWithMetrics[],
): WhatsWorkingSummary | null {
  if (posts.length < 5) return null

  const engagement = (p: PostWithMetrics) => p.reactions + p.comments_count + p.reposts

  // Top pillars by average engagement
  const pillarMap = new Map<string, { name: string; engagements: number[]; count: number }>()
  for (const p of posts) {
    if (!p.pillar_id) continue
    const key = p.pillar_id
    if (!pillarMap.has(key)) {
      pillarMap.set(key, { name: p.pillar_name ?? 'Unknown', engagements: [], count: 0 })
    }
    const entry = pillarMap.get(key)!
    entry.engagements.push(engagement(p))
    entry.count++
  }

  const topPillars = Array.from(pillarMap.entries())
    .map(([pillar_id, data]) => ({
      pillar_id,
      pillar_name: data.name,
      avg_engagement: Math.round(data.engagements.reduce((s, e) => s + e, 0) / data.count),
      post_count: data.count,
    }))
    .sort((a, b) => b.avg_engagement - a.avg_engagement)
    .slice(0, 5)

  // Best posting days
  const dayMap = new Map<number, { engagements: number[]; count: number }>()
  for (const p of posts) {
    const dateStr = p.published_at ?? p.suggested_publish_at ?? p.created_at
    const day = new Date(dateStr).getDay()
    if (!dayMap.has(day)) dayMap.set(day, { engagements: [], count: 0 })
    const entry = dayMap.get(day)!
    entry.engagements.push(engagement(p))
    entry.count++
  }

  const bestPostingDays = Array.from(dayMap.entries())
    .map(([day, data]) => ({
      day: DAY_NAMES[day],
      avg_engagement: Math.round(data.engagements.reduce((s, e) => s + e, 0) / data.count),
      post_count: data.count,
    }))
    .sort((a, b) => b.avg_engagement - a.avg_engagement)

  // Highest performing post
  const sorted = [...posts].sort((a, b) => engagement(b) - engagement(a))
  const top = sorted[0]

  // Overall engagement trends
  const totalImpressions = posts.reduce((s, p) => s + p.impressions, 0)
  const totalEngagement = posts.reduce((s, p) => s + engagement(p), 0)

  return {
    generated_at: new Date().toISOString(),
    data_points: posts.length,
    top_pillars: topPillars,
    best_posting_days: bestPostingDays,
    engagement_trends: {
      total_posts: posts.length,
      avg_impressions: Math.round(totalImpressions / posts.length),
      avg_engagement: Math.round(totalEngagement / posts.length),
      highest_performing_post: top
        ? {
            post_id: top.id,
            title: top.title,
            engagement: engagement(top),
          }
        : null,
    },
  }
}

/**
 * Store the "What's Working" summary in strategy_config.
 */
export async function saveWhatsWorking(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  summary: WhatsWorkingSummary,
): Promise<boolean> {
  const { error } = await supabase
    .from('strategy_config')
    .upsert(
      {
        user_id: userId,
        organization_id: organizationId,
        whats_working: summary,
        whats_working_updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,organization_id' },
    )

  if (error) {
    console.error('[performance-analysis] save whats_working error:', error)
    return false
  }
  return true
}
