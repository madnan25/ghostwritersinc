import { describe, expect, it } from 'vitest'
import type { PostWithMetrics } from '@/lib/performance-analysis'
import {
  boostResearchByPerformance,
  computePerformanceAwareWeights,
  computePillarPerformance,
  generateWhatsWorking,
} from '@/lib/performance-analysis'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePost(overrides: Partial<PostWithMetrics> = {}): PostWithMetrics {
  return {
    id: 'post-1',
    pillar_id: 'pillar-1',
    pillar_name: 'AI',
    title: 'Test Post',
    content: 'Hello world',
    status: 'published',
    published_at: '2026-03-10T09:00:00Z',
    suggested_publish_at: null,
    created_at: '2026-03-09T09:00:00Z',
    impressions: 1000,
    reactions: 50,
    comments_count: 10,
    reposts: 5,
    ...overrides,
  }
}

const PILLARS = [
  { id: 'pillar-1', name: 'AI', weight_pct: 40 },
  { id: 'pillar-2', name: 'Leadership', weight_pct: 30 },
  { id: 'pillar-3', name: 'Culture', weight_pct: 30 },
]

// ---------------------------------------------------------------------------
// computePillarPerformance
// ---------------------------------------------------------------------------

describe('computePillarPerformance', () => {
  it('computes average metrics per pillar', () => {
    const posts = [
      makePost({ id: 'p1', pillar_id: 'pillar-1', impressions: 1000, reactions: 50, comments_count: 10, reposts: 5 }),
      makePost({ id: 'p2', pillar_id: 'pillar-1', impressions: 2000, reactions: 100, comments_count: 20, reposts: 10 }),
      makePost({ id: 'p3', pillar_id: 'pillar-2', impressions: 500, reactions: 20, comments_count: 5, reposts: 2 }),
    ]

    const result = computePillarPerformance(posts, PILLARS)

    const ai = result.find((p) => p.pillar_id === 'pillar-1')!
    expect(ai.post_count).toBe(2)
    expect(ai.avg_impressions).toBe(1500)
    expect(ai.avg_reactions).toBe(75)
    expect(ai.avg_engagement).toBe(98) // (50+10+5 + 100+20+10) / 2 = 97.5 → 98

    const leadership = result.find((p) => p.pillar_id === 'pillar-2')!
    expect(leadership.post_count).toBe(1)
    expect(leadership.avg_engagement).toBe(27)
  })

  it('returns zero stats for pillars with no posts', () => {
    const posts = [makePost({ pillar_id: 'pillar-1' })]
    const result = computePillarPerformance(posts, PILLARS)

    const culture = result.find((p) => p.pillar_id === 'pillar-3')!
    expect(culture.post_count).toBe(0)
    expect(culture.avg_engagement).toBe(0)
    expect(culture.actual_pct).toBe(0)
  })

  it('computes actual_pct correctly', () => {
    const posts = [
      makePost({ id: 'p1', pillar_id: 'pillar-1' }),
      makePost({ id: 'p2', pillar_id: 'pillar-1' }),
      makePost({ id: 'p3', pillar_id: 'pillar-1' }),
      makePost({ id: 'p4', pillar_id: 'pillar-2' }),
    ]

    const result = computePillarPerformance(posts, PILLARS)
    expect(result.find((p) => p.pillar_id === 'pillar-1')!.actual_pct).toBe(75)
    expect(result.find((p) => p.pillar_id === 'pillar-2')!.actual_pct).toBe(25)
  })
})

// ---------------------------------------------------------------------------
// computePerformanceAwareWeights
// ---------------------------------------------------------------------------

describe('computePerformanceAwareWeights', () => {
  it('returns original weights when no performance data', () => {
    const result = computePerformanceAwareWeights(PILLARS, [])
    expect(result).toEqual(PILLARS)
  })

  it('boosts underweight pillars beyond 10% tolerance', () => {
    const perf = [
      { pillar_id: 'pillar-1', pillar_name: 'AI', post_count: 6, avg_impressions: 0, avg_reactions: 0, avg_comments_count: 0, avg_reposts: 0, avg_engagement: 0, actual_pct: 60 },
      { pillar_id: 'pillar-2', pillar_name: 'Leadership', post_count: 3, avg_impressions: 0, avg_reactions: 0, avg_comments_count: 0, avg_reposts: 0, avg_engagement: 0, actual_pct: 30 },
      { pillar_id: 'pillar-3', pillar_name: 'Culture', post_count: 1, avg_impressions: 0, avg_reactions: 0, avg_comments_count: 0, avg_reposts: 0, avg_engagement: 0, actual_pct: 10 },
    ]

    const result = computePerformanceAwareWeights(PILLARS, perf)

    // Culture: target 30%, actual 10% → deviation 20%, tolerance 3% → needs boost
    const culture = result.find((p) => p.id === 'pillar-3')!
    expect(culture.weight_pct).toBeGreaterThan(30) // boosted

    // AI: target 40%, actual 60% → deviation -20%, tolerance 4% → needs reduction
    const ai = result.find((p) => p.id === 'pillar-1')!
    expect(ai.weight_pct).toBeLessThan(40) // reduced
  })

  it('does not adjust pillars within 10% tolerance', () => {
    const perf = [
      { pillar_id: 'pillar-1', pillar_name: 'AI', post_count: 4, avg_impressions: 0, avg_reactions: 0, avg_comments_count: 0, avg_reposts: 0, avg_engagement: 0, actual_pct: 38 },
      { pillar_id: 'pillar-2', pillar_name: 'Leadership', post_count: 3, avg_impressions: 0, avg_reactions: 0, avg_comments_count: 0, avg_reposts: 0, avg_engagement: 0, actual_pct: 31 },
      { pillar_id: 'pillar-3', pillar_name: 'Culture', post_count: 3, avg_impressions: 0, avg_reactions: 0, avg_comments_count: 0, avg_reposts: 0, avg_engagement: 0, actual_pct: 31 },
    ]

    const result = computePerformanceAwareWeights(PILLARS, perf)

    // All within tolerance — weights unchanged
    expect(result.find((p) => p.id === 'pillar-1')!.weight_pct).toBe(40)
    expect(result.find((p) => p.id === 'pillar-2')!.weight_pct).toBe(30)
    expect(result.find((p) => p.id === 'pillar-3')!.weight_pct).toBe(30)
  })

  it('never drops weight below 1%', () => {
    const pillars = [
      { id: 'pillar-1', name: 'AI', weight_pct: 5 },
      { id: 'pillar-2', name: 'Leadership', weight_pct: 95 },
    ]
    const perf = [
      { pillar_id: 'pillar-1', pillar_name: 'AI', post_count: 90, avg_impressions: 0, avg_reactions: 0, avg_comments_count: 0, avg_reposts: 0, avg_engagement: 0, actual_pct: 90 },
      { pillar_id: 'pillar-2', pillar_name: 'Leadership', post_count: 10, avg_impressions: 0, avg_reactions: 0, avg_comments_count: 0, avg_reposts: 0, avg_engagement: 0, actual_pct: 10 },
    ]

    const result = computePerformanceAwareWeights(pillars, perf)
    expect(result.every((p) => p.weight_pct >= 1)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// boostResearchByPerformance
// ---------------------------------------------------------------------------

describe('boostResearchByPerformance', () => {
  it('returns empty map when no performance data', () => {
    const items = [{ id: 'r1', pillar_id: 'pillar-1', relevance_score: 0.8 }]
    const result = boostResearchByPerformance(items, [])
    expect(result.size).toBe(0)
  })

  it('boosts items in high-engagement pillars', () => {
    const items = [
      { id: 'r1', pillar_id: 'pillar-1', relevance_score: 0.8 },
      { id: 'r2', pillar_id: 'pillar-2', relevance_score: 0.8 },
    ]
    const perf = [
      { pillar_id: 'pillar-1', pillar_name: 'AI', post_count: 5, avg_impressions: 1000, avg_reactions: 100, avg_comments_count: 20, avg_reposts: 10, avg_engagement: 130, actual_pct: 50 },
      { pillar_id: 'pillar-2', pillar_name: 'Leadership', post_count: 5, avg_impressions: 500, avg_reactions: 20, avg_comments_count: 5, avg_reposts: 2, avg_engagement: 27, actual_pct: 50 },
    ]

    const result = boostResearchByPerformance(items, perf)

    // AI pillar has higher engagement, so r1 should have a higher boosted score
    expect(result.get('r1')!).toBeGreaterThan(result.get('r2')!)
  })

  it('uses base relevance score for items without pillar', () => {
    const items = [{ id: 'r1', pillar_id: null, relevance_score: 0.7 }]
    const perf = [
      { pillar_id: 'pillar-1', pillar_name: 'AI', post_count: 5, avg_impressions: 1000, avg_reactions: 100, avg_comments_count: 20, avg_reposts: 10, avg_engagement: 130, actual_pct: 100 },
    ]

    const result = boostResearchByPerformance(items, perf)
    expect(result.get('r1')).toBe(0.7)
  })

  it('caps boosted score at 1.0', () => {
    const items = [{ id: 'r1', pillar_id: 'pillar-1', relevance_score: 0.95 }]
    const perf = [
      { pillar_id: 'pillar-1', pillar_name: 'AI', post_count: 5, avg_impressions: 5000, avg_reactions: 500, avg_comments_count: 100, avg_reposts: 50, avg_engagement: 650, actual_pct: 100 },
    ]

    const result = boostResearchByPerformance(items, perf)
    expect(result.get('r1')!).toBeLessThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// generateWhatsWorking
// ---------------------------------------------------------------------------

describe('generateWhatsWorking', () => {
  it('returns null with fewer than 5 posts', () => {
    const posts = [makePost(), makePost({ id: 'p2' }), makePost({ id: 'p3' })]
    expect(generateWhatsWorking(posts)).toBeNull()
  })

  it('generates summary with 5+ posts', () => {
    const posts = [
      makePost({ id: 'p1', pillar_id: 'pillar-1', pillar_name: 'AI', reactions: 100, comments_count: 20, reposts: 10 }),
      makePost({ id: 'p2', pillar_id: 'pillar-1', pillar_name: 'AI', reactions: 80, comments_count: 15, reposts: 8 }),
      makePost({ id: 'p3', pillar_id: 'pillar-2', pillar_name: 'Leadership', reactions: 50, comments_count: 10, reposts: 5 }),
      makePost({ id: 'p4', pillar_id: 'pillar-2', pillar_name: 'Leadership', reactions: 30, comments_count: 5, reposts: 2 }),
      makePost({ id: 'p5', pillar_id: 'pillar-3', pillar_name: 'Culture', reactions: 200, comments_count: 40, reposts: 20 }),
    ]

    const result = generateWhatsWorking(posts)

    expect(result).not.toBeNull()
    expect(result!.data_points).toBe(5)
    expect(result!.top_pillars.length).toBeGreaterThan(0)
    expect(result!.best_posting_days.length).toBeGreaterThan(0)
    expect(result!.engagement_trends.total_posts).toBe(5)
  })

  it('ranks top pillars by average engagement', () => {
    // Culture has highest engagement per post
    const posts = [
      makePost({ id: 'p1', pillar_id: 'pillar-1', pillar_name: 'AI', reactions: 10, comments_count: 2, reposts: 1 }),
      makePost({ id: 'p2', pillar_id: 'pillar-1', pillar_name: 'AI', reactions: 10, comments_count: 2, reposts: 1 }),
      makePost({ id: 'p3', pillar_id: 'pillar-2', pillar_name: 'Leadership', reactions: 50, comments_count: 10, reposts: 5 }),
      makePost({ id: 'p4', pillar_id: 'pillar-2', pillar_name: 'Leadership', reactions: 50, comments_count: 10, reposts: 5 }),
      makePost({ id: 'p5', pillar_id: 'pillar-3', pillar_name: 'Culture', reactions: 200, comments_count: 40, reposts: 20 }),
    ]

    const result = generateWhatsWorking(posts)!

    expect(result.top_pillars[0].pillar_name).toBe('Culture')
    expect(result.top_pillars[0].avg_engagement).toBe(260)
  })

  it('identifies highest performing post', () => {
    const posts = [
      makePost({ id: 'p1', reactions: 10, comments_count: 2, reposts: 1 }),
      makePost({ id: 'p2', reactions: 500, comments_count: 100, reposts: 50, title: 'Viral Post' }),
      makePost({ id: 'p3', reactions: 20, comments_count: 5, reposts: 2 }),
      makePost({ id: 'p4', reactions: 30, comments_count: 5, reposts: 3 }),
      makePost({ id: 'p5', reactions: 15, comments_count: 3, reposts: 1 }),
    ]

    const result = generateWhatsWorking(posts)!

    expect(result.engagement_trends.highest_performing_post!.post_id).toBe('p2')
    expect(result.engagement_trends.highest_performing_post!.title).toBe('Viral Post')
    expect(result.engagement_trends.highest_performing_post!.engagement).toBe(650)
  })

  it('computes best posting days', () => {
    // All posts on a Tuesday (2026-03-10 is a Tuesday)
    const posts = Array.from({ length: 5 }, (_, i) =>
      makePost({
        id: `p${i + 1}`,
        published_at: '2026-03-10T09:00:00Z',
        reactions: 50,
        comments_count: 10,
        reposts: 5,
      }),
    )

    const result = generateWhatsWorking(posts)!

    expect(result.best_posting_days).toHaveLength(1)
    expect(result.best_posting_days[0].day).toBe('Tuesday')
    expect(result.best_posting_days[0].post_count).toBe(5)
  })
})
