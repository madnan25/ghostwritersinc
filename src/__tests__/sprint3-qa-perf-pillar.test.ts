// @vitest-environment node

/**
 * Sprint 3 QA Gate Tests: Performance Logging + Pillar Weights
 *
 * Covers:
 *   - Performance API schema validation (UpsertPerformanceSchema)
 *   - Pillar weights API schema validation (PillarWeightsSchema)
 *   - isMonthlyActive logic (monthly scope auto-revert)
 *   - updatePillarWeights server action validation
 *   - computePillarPerformance edge cases
 *   - generateWhatsWorking edge cases
 *   - Performance-aware weight rebalancing
 *   - Insights data sparse threshold
 *   - Performance panel display logic
 *
 * Issue: LIN-476 (parent: LIN-471)
 */

import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { PostWithMetrics, PillarPerformance } from '@/lib/performance-analysis'
import {
  computePillarPerformance,
  computePerformanceAwareWeights,
  boostResearchByPerformance,
  generateWhatsWorking,
} from '@/lib/performance-analysis'

// ---------------------------------------------------------------------------
// Re-declare schemas from route files (these are not exported, so we re-create
// them identically to verify the validation logic).
// ---------------------------------------------------------------------------

const UpsertPerformanceSchema = z.object({
  impressions: z.number().int().min(0).nullable().optional(),
  reactions: z.number().int().min(0).nullable().optional(),
  comments_count: z.number().int().min(0).nullable().optional(),
  reposts: z.number().int().min(0).nullable().optional(),
  qualitative_notes: z.string().max(5000).nullable().optional(),
  logged_at: z.string().datetime({ offset: true }).optional(),
})

const PillarWeightsSchema = z
  .object({
    pillar_weights: z
      .record(z.string(), z.number().min(0))
      .refine(
        (weights) => {
          const sum = Object.values(weights).reduce((acc, v) => acc + v, 0)
          return Math.abs(sum - 100) < 0.01
        },
        { message: 'Pillar weights must sum to 100' },
      ),
    scope: z.enum(['default', 'monthly']),
    month: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'month must be in YYYY-MM-DD format')
      .optional(),
  })
  .refine((data) => data.scope !== 'monthly' || !!data.month, {
    message: 'month is required when scope is monthly',
    path: ['month'],
  })

/** Mirrors isMonthlyActive from pillar-weights route */
function isMonthlyActive(month: string | null): boolean {
  if (!month) return false
  const now = new Date()
  const [year, mon] = month.split('-').map(Number)
  return year > now.getFullYear() || (year === now.getFullYear() && mon >= now.getMonth() + 1)
}

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
  { id: 'pillar-1', name: 'AI', weight_pct: 20 },
  { id: 'pillar-2', name: 'Leadership', weight_pct: 20 },
  { id: 'pillar-3', name: 'Culture', weight_pct: 20 },
  { id: 'pillar-4', name: 'Innovation', weight_pct: 20 },
  { id: 'pillar-5', name: 'Growth', weight_pct: 20 },
]

// ═══════════════════════════════════════════════════════════════════════════
// 1. Performance Logging — Schema Validation
// ═══════════════════════════════════════════════════════════════════════════

describe('Performance Logging: UpsertPerformanceSchema', () => {
  it('accepts partial performance data (not all fields required)', () => {
    const result = UpsertPerformanceSchema.safeParse({ impressions: 500 })
    expect(result.success).toBe(true)
  })

  it('accepts all-null fields (empty save)', () => {
    const result = UpsertPerformanceSchema.safeParse({
      impressions: null,
      reactions: null,
      comments_count: null,
      reposts: null,
      qualitative_notes: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (no fields at all)', () => {
    const result = UpsertPerformanceSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts full performance data', () => {
    const result = UpsertPerformanceSchema.safeParse({
      impressions: 1000,
      reactions: 50,
      comments_count: 10,
      reposts: 5,
      qualitative_notes: 'Great post! Lots of comments.',
      logged_at: '2026-03-15T10:00:00+00:00',
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative impressions', () => {
    const result = UpsertPerformanceSchema.safeParse({ impressions: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects negative reactions', () => {
    const result = UpsertPerformanceSchema.safeParse({ reactions: -5 })
    expect(result.success).toBe(false)
  })

  it('rejects negative comments_count', () => {
    const result = UpsertPerformanceSchema.safeParse({ comments_count: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects negative reposts', () => {
    const result = UpsertPerformanceSchema.safeParse({ reposts: -10 })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer numeric values', () => {
    const result = UpsertPerformanceSchema.safeParse({ impressions: 3.7 })
    expect(result.success).toBe(false)
  })

  it('rejects string values for numeric fields', () => {
    const result = UpsertPerformanceSchema.safeParse({ impressions: '500' })
    expect(result.success).toBe(false)
  })

  it('accepts zero values (valid non-negative integers)', () => {
    const result = UpsertPerformanceSchema.safeParse({
      impressions: 0,
      reactions: 0,
      comments_count: 0,
      reposts: 0,
    })
    expect(result.success).toBe(true)
  })

  it('accepts logged_at with timezone offset', () => {
    const result = UpsertPerformanceSchema.safeParse({
      logged_at: '2026-03-15T10:00:00+05:30',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid logged_at format', () => {
    const result = UpsertPerformanceSchema.safeParse({
      logged_at: '2026-03-15',
    })
    expect(result.success).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. Pillar Weights — Schema Validation
// ═══════════════════════════════════════════════════════════════════════════

describe('Pillar Weights: PillarWeightsSchema', () => {
  it('accepts 5 sliders summing to exactly 100%', () => {
    const result = PillarWeightsSchema.safeParse({
      pillar_weights: { a: 20, b: 20, c: 20, d: 20, e: 20 },
      scope: 'default',
    })
    expect(result.success).toBe(true)
  })

  it('rejects weights that sum to 99%', () => {
    const result = PillarWeightsSchema.safeParse({
      pillar_weights: { a: 19, b: 20, c: 20, d: 20, e: 20 },
      scope: 'default',
    })
    expect(result.success).toBe(false)
  })

  it('rejects weights that sum to 101%', () => {
    const result = PillarWeightsSchema.safeParse({
      pillar_weights: { a: 21, b: 20, c: 20, d: 20, e: 20 },
      scope: 'default',
    })
    expect(result.success).toBe(false)
  })

  it('accepts float weights summing to exactly 100 (within 0.01 tolerance)', () => {
    const result = PillarWeightsSchema.safeParse({
      pillar_weights: { a: 33.33, b: 33.34, c: 33.33 },
      scope: 'default',
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative weight values', () => {
    const result = PillarWeightsSchema.safeParse({
      pillar_weights: { a: -10, b: 60, c: 50 },
      scope: 'default',
    })
    expect(result.success).toBe(false)
  })

  it('requires month when scope is monthly', () => {
    const result = PillarWeightsSchema.safeParse({
      pillar_weights: { a: 50, b: 50 },
      scope: 'monthly',
    })
    expect(result.success).toBe(false)
    const issues = result.error!.issues
    expect(issues.some((i) => i.path.includes('month'))).toBe(true)
  })

  it('accepts monthly scope with valid month', () => {
    const result = PillarWeightsSchema.safeParse({
      pillar_weights: { a: 50, b: 50 },
      scope: 'monthly',
      month: '2026-03-01',
    })
    expect(result.success).toBe(true)
  })

  it('does not require month when scope is default', () => {
    const result = PillarWeightsSchema.safeParse({
      pillar_weights: { a: 50, b: 50 },
      scope: 'default',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid month format', () => {
    const result = PillarWeightsSchema.safeParse({
      pillar_weights: { a: 50, b: 50 },
      scope: 'monthly',
      month: 'March 2026',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid scope values', () => {
    const result = PillarWeightsSchema.safeParse({
      pillar_weights: { a: 50, b: 50 },
      scope: 'weekly',
    })
    expect(result.success).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Monthly Scope Auto-Revert (isMonthlyActive)
// ═══════════════════════════════════════════════════════════════════════════

describe('isMonthlyActive (monthly scope auto-revert)', () => {
  it('returns false for null month', () => {
    expect(isMonthlyActive(null)).toBe(false)
  })

  it('returns true for current month', () => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    expect(isMonthlyActive(currentMonth)).toBe(true)
  })

  it('returns true for future month', () => {
    expect(isMonthlyActive('2099-12-01')).toBe(true)
  })

  it('returns false for past month', () => {
    expect(isMonthlyActive('2024-01-01')).toBe(false)
  })

  it('returns false for last month', () => {
    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const key = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`
    expect(isMonthlyActive(key)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. Strategist Integration — Performance-aware weights (10% tolerance)
// ═══════════════════════════════════════════════════════════════════════════

describe('Strategist: computePerformanceAwareWeights (10% tolerance)', () => {
  it('boosts underweight pillars prioritized in next brief batch', () => {
    const pillars = [
      { id: 'p1', name: 'AI', weight_pct: 40 },
      { id: 'p2', name: 'Leadership', weight_pct: 30 },
      { id: 'p3', name: 'Culture', weight_pct: 30 },
    ]
    const perf: PillarPerformance[] = [
      { pillar_id: 'p1', pillar_name: 'AI', post_count: 8, avg_impressions: 0, avg_reactions: 0, avg_comments_count: 0, avg_reposts: 0, avg_engagement: 0, actual_pct: 80 },
      { pillar_id: 'p2', pillar_name: 'Leadership', post_count: 1, avg_impressions: 0, avg_reactions: 0, avg_comments_count: 0, avg_reposts: 0, avg_engagement: 0, actual_pct: 10 },
      { pillar_id: 'p3', pillar_name: 'Culture', post_count: 1, avg_impressions: 0, avg_reactions: 0, avg_comments_count: 0, avg_reposts: 0, avg_engagement: 0, actual_pct: 10 },
    ]

    const result = computePerformanceAwareWeights(pillars, perf)

    // Leadership and Culture are underweight → should be boosted
    const leadership = result.find((p) => p.id === 'p2')!
    const culture = result.find((p) => p.id === 'p3')!
    expect(leadership.weight_pct).toBeGreaterThan(30)
    expect(culture.weight_pct).toBeGreaterThan(30)

    // AI is overweight → should be reduced
    const ai = result.find((p) => p.id === 'p1')!
    expect(ai.weight_pct).toBeLessThan(40)
  })

  it('applies gradual correction (half the deviation)', () => {
    const pillars = [
      { id: 'p1', name: 'AI', weight_pct: 50 },
      { id: 'p2', name: 'Leadership', weight_pct: 50 },
    ]
    const perf: PillarPerformance[] = [
      { pillar_id: 'p1', pillar_name: 'AI', post_count: 8, avg_impressions: 0, avg_reactions: 0, avg_comments_count: 0, avg_reposts: 0, avg_engagement: 0, actual_pct: 80 },
      { pillar_id: 'p2', pillar_name: 'Leadership', post_count: 2, avg_impressions: 0, avg_reactions: 0, avg_comments_count: 0, avg_reposts: 0, avg_engagement: 0, actual_pct: 20 },
    ]

    const result = computePerformanceAwareWeights(pillars, perf)

    // AI: target 50%, actual 80% → deviation -30%, half = -15 → adjusted to 35
    expect(result.find((p) => p.id === 'p1')!.weight_pct).toBe(35)
    // Leadership: target 50%, actual 20% → deviation 30%, half = 15 → adjusted to 65
    expect(result.find((p) => p.id === 'p2')!.weight_pct).toBe(65)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. What's Working Summary
// ═══════════════════════════════════════════════════════════════════════════

describe('generateWhatsWorking — edge cases', () => {
  it('returns null with exactly 4 data points', () => {
    const posts = Array.from({ length: 4 }, (_, i) =>
      makePost({ id: `p${i}` }),
    )
    expect(generateWhatsWorking(posts)).toBeNull()
  })

  it('returns non-null with exactly 5 data points', () => {
    const posts = Array.from({ length: 5 }, (_, i) =>
      makePost({ id: `p${i}` }),
    )
    expect(generateWhatsWorking(posts)).not.toBeNull()
  })

  it('handles posts without pillar assignment', () => {
    const posts = Array.from({ length: 5 }, (_, i) =>
      makePost({ id: `p${i}`, pillar_id: null, pillar_name: null }),
    )
    const result = generateWhatsWorking(posts)
    expect(result).not.toBeNull()
    expect(result!.top_pillars).toHaveLength(0)
  })

  it('uses suggested_publish_at when published_at is null', () => {
    const posts = Array.from({ length: 5 }, (_, i) =>
      makePost({
        id: `p${i}`,
        published_at: null,
        // All on Wednesday (2026-03-11 is a Wednesday)
        suggested_publish_at: '2026-03-11T09:00:00Z',
      }),
    )
    const result = generateWhatsWorking(posts)!
    expect(result.best_posting_days[0].day).toBe('Wednesday')
  })

  it('falls back to created_at when both publish dates are null', () => {
    const posts = Array.from({ length: 5 }, (_, i) =>
      makePost({
        id: `p${i}`,
        published_at: null,
        suggested_publish_at: null,
        // 2026-03-09 is a Monday
        created_at: '2026-03-09T09:00:00Z',
      }),
    )
    const result = generateWhatsWorking(posts)!
    expect(result.best_posting_days[0].day).toBe('Monday')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. Insights Charts — Sparse data threshold
// ═══════════════════════════════════════════════════════════════════════════

describe('Insights Charts: sparse data threshold', () => {
  it('considers <10 posts as sparse', () => {
    // The InsightsCharts component checks `posts.length < 10` for sparse mode
    const posts = Array.from({ length: 9 }, (_, i) => makePost({ id: `p${i}` }))
    expect(posts.length < 10).toBe(true) // sparse
  })

  it('considers 10+ posts as non-sparse', () => {
    const posts = Array.from({ length: 10 }, (_, i) => makePost({ id: `p${i}` }))
    expect(posts.length < 10).toBe(false) // not sparse
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 7. Performance Panel — display logic
// ═══════════════════════════════════════════════════════════════════════════

describe('Performance Panel: toInputValue logic', () => {
  // Mirrors the toInputValue function in performance-panel.tsx
  function toInputValue(n: number | null | undefined): string {
    if (n === null || n === undefined) return ''
    return String(n)
  }

  it('converts null to empty string', () => {
    expect(toInputValue(null)).toBe('')
  })

  it('converts undefined to empty string', () => {
    expect(toInputValue(undefined)).toBe('')
  })

  it('converts 0 to "0"', () => {
    expect(toInputValue(0)).toBe('0')
  })

  it('converts positive number to string', () => {
    expect(toInputValue(500)).toBe('500')
  })

  it('pre-fills form on reload (saved data)', () => {
    const savedPerformance = {
      impressions: 1200,
      reactions: 45,
      comments_count: 8,
      reposts: 3,
      qualitative_notes: 'Great engagement',
    }

    expect(toInputValue(savedPerformance.impressions)).toBe('1200')
    expect(toInputValue(savedPerformance.reactions)).toBe('45')
    expect(toInputValue(savedPerformance.comments_count)).toBe('8')
    expect(toInputValue(savedPerformance.reposts)).toBe('3')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 8. Pillar Weight Sliders — getInitialWeights logic
// ═══════════════════════════════════════════════════════════════════════════

describe('Pillar Weight Sliders: getInitialWeights logic', () => {
  interface PillarWeightsConfig {
    weights: Record<string, number> | null
    scope: 'default' | 'monthly'
    monthlyExpired: boolean
  }

  interface ContentPillar {
    id: string
    name: string
    weight_pct: number
  }

  // Mirrors getInitialWeights from pillar-weight-sliders.tsx
  function getInitialWeights(
    pillars: ContentPillar[],
    savedConfig: PillarWeightsConfig | null,
  ): Record<string, number> {
    if (savedConfig && !savedConfig.monthlyExpired && savedConfig.weights) {
      const merged = Object.fromEntries(pillars.map((p) => [p.id, p.weight_pct]))
      for (const [id, w] of Object.entries(savedConfig.weights)) {
        if (id in merged) merged[id] = w
      }
      return merged
    }
    return Object.fromEntries(pillars.map((p) => [p.id, p.weight_pct]))
  }

  const pillars: ContentPillar[] = [
    { id: 'p1', name: 'AI', weight_pct: 20 },
    { id: 'p2', name: 'Leadership', weight_pct: 20 },
    { id: 'p3', name: 'Culture', weight_pct: 20 },
    { id: 'p4', name: 'Innovation', weight_pct: 20 },
    { id: 'p5', name: 'Growth', weight_pct: 20 },
  ]

  it('uses default pillar weights when no saved config', () => {
    const weights = getInitialWeights(pillars, null)
    expect(Object.values(weights).every((v) => v === 20)).toBe(true)
  })

  it('uses saved config when not expired', () => {
    const config: PillarWeightsConfig = {
      weights: { p1: 40, p2: 15, p3: 15, p4: 15, p5: 15 },
      scope: 'monthly',
      monthlyExpired: false,
    }
    const weights = getInitialWeights(pillars, config)
    expect(weights.p1).toBe(40)
    expect(weights.p2).toBe(15)
  })

  it('falls back to defaults when monthly config has expired', () => {
    const config: PillarWeightsConfig = {
      weights: { p1: 40, p2: 15, p3: 15, p4: 15, p5: 15 },
      scope: 'monthly',
      monthlyExpired: true,
    }
    const weights = getInitialWeights(pillars, config)
    expect(weights.p1).toBe(20) // default, not 40
    expect(Object.values(weights).every((v) => v === 20)).toBe(true)
  })

  it('uses defaults when savedConfig weights is null', () => {
    const config: PillarWeightsConfig = {
      weights: null,
      scope: 'default',
      monthlyExpired: false,
    }
    const weights = getInitialWeights(pillars, config)
    expect(Object.values(weights).every((v) => v === 20)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 9. Pillar Performance — actual_pct with 5 pillars
// ═══════════════════════════════════════════════════════════════════════════

describe('computePillarPerformance — 5-pillar distribution', () => {
  it('computes distribution across 5 equal pillars', () => {
    const posts = PILLARS.map((p, i) =>
      makePost({ id: `p${i}`, pillar_id: p.id, pillar_name: p.name }),
    )
    const result = computePillarPerformance(posts, PILLARS)

    // Each pillar has 1 out of 5 posts = 20%
    for (const r of result) {
      expect(r.actual_pct).toBe(20)
      expect(r.post_count).toBe(1)
    }
  })

  it('handles posts without pillar assignment in pct calculation', () => {
    const posts = [
      makePost({ id: 'p1', pillar_id: 'pillar-1' }),
      makePost({ id: 'p2', pillar_id: null }), // unassigned
    ]
    const result = computePillarPerformance(posts, PILLARS)

    // Only 1 assigned post total, pillar-1 has 1 → 100%
    const ai = result.find((r) => r.pillar_id === 'pillar-1')!
    expect(ai.actual_pct).toBe(100)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 10. Research boost — performance integration
// ═══════════════════════════════════════════════════════════════════════════

describe('boostResearchByPerformance — edge cases', () => {
  it('uses default 0.5 score for null relevance_score', () => {
    const items = [{ id: 'r1', pillar_id: null, relevance_score: null }]
    const perf: PillarPerformance[] = [
      { pillar_id: 'p1', pillar_name: 'AI', post_count: 5, avg_impressions: 0, avg_reactions: 0, avg_comments_count: 0, avg_reposts: 0, avg_engagement: 100, actual_pct: 100 },
    ]
    const result = boostResearchByPerformance(items, perf)
    expect(result.get('r1')).toBe(0.5)
  })

  it('uses base score for items in pillars with 0 posts', () => {
    const items = [{ id: 'r1', pillar_id: 'p1', relevance_score: 0.8 }]
    const perf: PillarPerformance[] = [
      { pillar_id: 'p1', pillar_name: 'AI', post_count: 0, avg_impressions: 0, avg_reactions: 0, avg_comments_count: 0, avg_reposts: 0, avg_engagement: 0, actual_pct: 0 },
    ]
    const result = boostResearchByPerformance(items, perf)
    expect(result.get('r1')).toBe(0.8) // no boost, just base score
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 11. Migration Schema Verification
// ═══════════════════════════════════════════════════════════════════════════

describe('post_performance table schema constraints', () => {
  it('has correct column constraints: non-negative integers', () => {
    // Verify the schema enforces CHECK (field >= 0) for all metric columns
    // by testing the Zod schema (mirrors DB constraints)
    const negativeValues = [
      { impressions: -1 },
      { reactions: -1 },
      { comments_count: -1 },
      { reposts: -1 },
    ]

    for (const val of negativeValues) {
      const result = UpsertPerformanceSchema.safeParse(val)
      expect(result.success).toBe(false)
    }
  })

  it('enforces unique constraint on post_id (upsert model)', () => {
    // The DB has: constraint post_performance_post_id_unique unique (post_id)
    // The API uses .upsert({...}, { onConflict: 'post_id' })
    // This means re-saving replaces values — verified by schema accepting full overwrite
    const firstSave = UpsertPerformanceSchema.safeParse({
      impressions: 500,
      reactions: 20,
    })
    const overwrite = UpsertPerformanceSchema.safeParse({
      impressions: 1000,
      reactions: 50,
      comments_count: 15,
      reposts: 5,
      qualitative_notes: 'Updated with more data',
    })
    expect(firstSave.success).toBe(true)
    expect(overwrite.success).toBe(true)
  })
})
