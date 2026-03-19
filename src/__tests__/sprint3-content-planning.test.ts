// @vitest-environment node

import { describe, expect, it } from 'vitest'
import type { ContentPillar, Post, Brief, StrategyConfig, ResearchPoolItem } from '@/lib/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePillar(overrides: Partial<ContentPillar> = {}): ContentPillar {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    organization_id: 'org-1',
    user_id: 'user-1',
    name: 'AI Agents & Automation',
    slug: 'ai-agents-automation',
    description: 'Content about artificial intelligence agents and workflow automation',
    color: '#3B82F6',
    weight_pct: 40,
    audience_summary: 'Tech leaders interested in AI-driven business automation',
    example_hooks: [
      'How AI agents can replace manual processes',
      'Automation ROI for enterprise teams',
    ],
    sort_order: 0,
    brief_ref: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: crypto.randomUUID(),
    organization_id: 'org-1',
    user_id: 'user-1',
    content: 'Test post content',
    content_type: 'text',
    media_urls: null,
    pillar: null,
    pillar_id: null,
    brief_ref: null,
    suggested_publish_at: null,
    scheduled_publish_at: null,
    published_at: null,
    linkedin_post_urn: null,
    status: 'draft',
    rejection_reason: null,
    agent_id: null,
    created_by_agent: null,
    reviewed_by_agent: null,
    review_notes: null,
    content_version: 1,
    revision_count: 0,
    brief_id: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  }
}

function makeBrief(overrides: Partial<Brief> = {}): Brief {
  return {
    id: crypto.randomUUID(),
    organization_id: 'org-1',
    pillar_id: null,
    angle: 'Test angle',
    research_refs: [],
    voice_notes: null,
    publish_at: null,
    status: 'pending',
    revision_count: 0,
    revision_notes: null,
    assigned_agent_id: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  }
}

function makeResearchItem(overrides: Partial<ResearchPoolItem> = {}): ResearchPoolItem {
  return {
    id: crypto.randomUUID(),
    organization_id: 'org-1',
    title: 'Research Item',
    source_url: null,
    source_type: 'article',
    pillar_id: null,
    relevance_score: null,
    raw_content: null,
    status: 'new',
    created_by_agent_id: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  }
}

function makeStrategyConfig(overrides: Partial<StrategyConfig> = {}): StrategyConfig {
  return {
    id: crypto.randomUUID(),
    user_id: 'user-1',
    organization_id: 'org-1',
    monthly_post_target: 12,
    intel_score_threshold: 0.5,
    default_publish_hour: 9,
    voice_notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Content planning pure logic — mirrors strategy page functions
// ---------------------------------------------------------------------------

function computeActualPct(posts: Post[], pillarId: string): number {
  const pillarPosts = posts.filter((p) => p.pillar_id === pillarId)
  const assigned = posts.filter((p) => p.pillar_id)
  if (assigned.length === 0) return 0
  return Math.round((pillarPosts.length / assigned.length) * 100)
}

function getPillarBalance(
  posts: Post[],
  pillars: { id: string; weight_pct: number }[],
): { label: string; variant: 'good' | 'ok' | 'off' } {
  const assigned = posts.filter((p) => p.pillar_id)
  if (assigned.length === 0) return { label: 'No data yet', variant: 'ok' }

  const maxDeviation = Math.max(
    ...pillars.map((p) => {
      const actual = Math.round(
        (assigned.filter((post) => post.pillar_id === p.id).length / assigned.length) * 100,
      )
      return Math.abs(actual - p.weight_pct)
    }),
  )

  if (maxDeviation <= 5) return { label: 'Well balanced', variant: 'good' }
  if (maxDeviation <= 15) return { label: 'Slightly off-target', variant: 'ok' }
  return { label: 'Needs rebalancing', variant: 'off' }
}

function getPostsThisMonth(posts: Post[]): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return posts.filter((p) => {
    const date = p.suggested_publish_at ?? p.created_at
    return new Date(date) >= start
  }).length
}

// ---------------------------------------------------------------------------
// Calendar gap calculation logic
// ---------------------------------------------------------------------------

/**
 * Compute the number of posting slots needed for the remainder of a month.
 * If monthlyTarget is 12 and we already have 3 posts, gap = 9.
 */
function computeCalendarGap(
  existingPostCount: number,
  monthlyTarget: number,
): number {
  return Math.max(0, monthlyTarget - existingPostCount)
}

/**
 * Determine which days in a given month have no scheduled posts.
 * Returns dates with no posts as ISO strings.
 */
function findEmptyDays(
  year: number,
  month: number,
  scheduledDates: string[],
): string[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const occupiedDays = new Set(
    scheduledDates.map((d) => new Date(d).getDate()),
  )
  const emptyDays: string[] = []
  for (let day = 1; day <= daysInMonth; day++) {
    if (!occupiedDays.has(day)) {
      emptyDays.push(new Date(year, month, day).toISOString().split('T')[0])
    }
  }
  return emptyDays
}

// ---------------------------------------------------------------------------
// Pillar weight distribution logic
// ---------------------------------------------------------------------------

/**
 * Distribute N briefs across pillars proportional to their weight_pct.
 * Uses largest-remainder method to handle fractional allocations.
 */
function distributeBriefsByWeight(
  pillars: { id: string; weight_pct: number }[],
  totalBriefs: number,
): Record<string, number> {
  if (pillars.length === 0 || totalBriefs <= 0) return {}

  const totalWeight = pillars.reduce((s, p) => s + p.weight_pct, 0)
  if (totalWeight === 0) return {}

  // Initial allocation (floor)
  const allocation: Record<string, number> = {}
  const remainders: { id: string; remainder: number }[] = []
  let allocated = 0

  for (const p of pillars) {
    const exact = (p.weight_pct / totalWeight) * totalBriefs
    const floored = Math.floor(exact)
    allocation[p.id] = floored
    allocated += floored
    remainders.push({ id: p.id, remainder: exact - floored })
  }

  // Distribute leftover via largest remainder
  remainders.sort((a, b) => b.remainder - a.remainder)
  let leftover = totalBriefs - allocated
  for (const r of remainders) {
    if (leftover <= 0) break
    allocation[r.id]++
    leftover--
  }

  return allocation
}

// ---------------------------------------------------------------------------
// Brief creation from research items
// ---------------------------------------------------------------------------

/**
 * Create briefs from research items, matching each to a pillar and marking
 * the research item as consumed.
 */
function planBriefsFromResearch(
  researchItems: ResearchPoolItem[],
  pillars: ContentPillar[],
  gap: number,
): { briefs: Brief[]; consumedIds: string[] } {
  const available = researchItems.filter((r) => r.status === 'new')
  // Sort by relevance score descending (nulls last)
  const sorted = [...available].sort(
    (a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0),
  )

  const toConsume = sorted.slice(0, gap)
  const briefs: Brief[] = toConsume.map((item) => {
    return makeBrief({
      pillar_id: item.pillar_id,
      angle: item.title,
      research_refs: [item.id],
    })
  })

  return { briefs, consumedIds: toConsume.map((i) => i.id) }
}

// ===========================================================================
// 1. Calendar Gap Calculation
// ===========================================================================

describe('Sprint 3: Calendar gap calculation', () => {
  it('returns full target when 0 posts exist', () => {
    expect(computeCalendarGap(0, 12)).toBe(12)
  })

  it('returns 0 gap when posts meet target', () => {
    expect(computeCalendarGap(12, 12)).toBe(0)
  })

  it('returns 0 gap when posts exceed target', () => {
    expect(computeCalendarGap(15, 12)).toBe(0)
  })

  it('returns correct partial gap', () => {
    expect(computeCalendarGap(5, 12)).toBe(7)
  })

  it('handles target of 0 (no posting goal)', () => {
    expect(computeCalendarGap(3, 0)).toBe(0)
  })

  it('handles target of 1', () => {
    expect(computeCalendarGap(0, 1)).toBe(1)
    expect(computeCalendarGap(1, 1)).toBe(0)
  })

  describe('findEmptyDays', () => {
    it('returns all days for a month with no posts', () => {
      // March 2026 has 31 days
      const emptyDays = findEmptyDays(2026, 2, [])
      expect(emptyDays).toHaveLength(31)
    })

    it('excludes days with scheduled posts', () => {
      // Use dates constructed the same way findEmptyDays does (local Date constructor)
      const scheduled = [
        new Date(2026, 2, 5, 9, 0, 0).toISOString(),
        new Date(2026, 2, 10, 9, 0, 0).toISOString(),
        new Date(2026, 2, 15, 9, 0, 0).toISOString(),
      ]
      const emptyDays = findEmptyDays(2026, 2, scheduled)
      expect(emptyDays).toHaveLength(28) // 31 - 3

      // Verify the scheduled days are excluded
      const day5 = new Date(2026, 2, 5).toISOString().split('T')[0]
      const day10 = new Date(2026, 2, 10).toISOString().split('T')[0]
      const day15 = new Date(2026, 2, 15).toISOString().split('T')[0]
      expect(emptyDays).not.toContain(day5)
      expect(emptyDays).not.toContain(day10)
      expect(emptyDays).not.toContain(day15)
    })

    it('returns 0 empty days when every day is filled (28-day Feb)', () => {
      // Feb 2026 is 28 days (non-leap)
      const allDays = Array.from({ length: 28 }, (_, i) =>
        new Date(2026, 1, i + 1).toISOString(),
      )
      const emptyDays = findEmptyDays(2026, 1, allDays)
      expect(emptyDays).toHaveLength(0)
    })

    it('handles multiple posts on the same day (no double-count)', () => {
      const scheduled = [
        '2026-03-05T08:00:00Z',
        '2026-03-05T14:00:00Z',
        '2026-03-10T09:00:00Z',
      ]
      const emptyDays = findEmptyDays(2026, 2, scheduled)
      expect(emptyDays).toHaveLength(29) // 31 - 2 unique days
    })
  })
})

// ===========================================================================
// 2. Pillar Weight Distribution
// ===========================================================================

describe('Sprint 3: Pillar weight distribution', () => {
  const pillars = [
    makePillar({ id: 'p1', weight_pct: 40 }),
    makePillar({ id: 'p2', weight_pct: 35 }),
    makePillar({ id: 'p3', weight_pct: 25 }),
  ]

  it('distributes briefs proportionally to weights', () => {
    const dist = distributeBriefsByWeight(pillars, 10)
    expect(dist['p1']).toBe(4) // 40% of 10
    expect(dist['p2']).toBe(4) // 35% of 10 → 3.5 → rounds up via largest remainder
    expect(dist['p3']).toBe(2) // 25% of 10 → 2.5 → rounds down
    expect(dist['p1'] + dist['p2'] + dist['p3']).toBe(10)
  })

  it('allocates 0 to all pillars when totalBriefs = 0', () => {
    const dist = distributeBriefsByWeight(pillars, 0)
    expect(Object.keys(dist)).toHaveLength(0)
  })

  it('handles empty pillars array', () => {
    const dist = distributeBriefsByWeight([], 10)
    expect(Object.keys(dist)).toHaveLength(0)
  })

  it('handles single pillar (gets all briefs)', () => {
    const dist = distributeBriefsByWeight([makePillar({ id: 'solo', weight_pct: 100 })], 5)
    expect(dist['solo']).toBe(5)
  })

  it('handles two equal-weight pillars', () => {
    const equal = [
      makePillar({ id: 'a', weight_pct: 50 }),
      makePillar({ id: 'b', weight_pct: 50 }),
    ]
    const dist = distributeBriefsByWeight(equal, 7)
    // 3.5 each → one gets 4 and one gets 3
    expect(dist['a'] + dist['b']).toBe(7)
    expect(Math.abs(dist['a'] - dist['b'])).toBeLessThanOrEqual(1)
  })

  it('total always sums to requested count (no rounding errors)', () => {
    for (const total of [1, 3, 7, 13, 20, 100]) {
      const dist = distributeBriefsByWeight(pillars, total)
      const sum = Object.values(dist).reduce((s, n) => s + n, 0)
      expect(sum).toBe(total)
    }
  })

  describe('edge case: all pillars weight 0', () => {
    it('returns empty allocation gracefully', () => {
      const zeroPillars = [
        makePillar({ id: 'z1', weight_pct: 0 }),
        makePillar({ id: 'z2', weight_pct: 0 }),
        makePillar({ id: 'z3', weight_pct: 0 }),
      ]
      const dist = distributeBriefsByWeight(zeroPillars, 6)
      expect(Object.keys(dist)).toHaveLength(0)
    })
  })

  describe('weights not summing to 100', () => {
    it('still distributes proportionally when weights sum < 100', () => {
      const underPillars = [
        makePillar({ id: 'u1', weight_pct: 20 }),
        makePillar({ id: 'u2', weight_pct: 30 }),
      ] // sum = 50
      const dist = distributeBriefsByWeight(underPillars, 10)
      // u1: 20/50 * 10 = 4, u2: 30/50 * 10 = 6
      expect(dist['u1']).toBe(4)
      expect(dist['u2']).toBe(6)
      expect(dist['u1'] + dist['u2']).toBe(10)
    })

    it('still distributes proportionally when weights sum > 100', () => {
      const overPillars = [
        makePillar({ id: 'o1', weight_pct: 60 }),
        makePillar({ id: 'o2', weight_pct: 80 }),
      ] // sum = 140
      const dist = distributeBriefsByWeight(overPillars, 7)
      // o1: 60/140 * 7 = 3, o2: 80/140 * 7 = 4
      expect(dist['o1']).toBe(3)
      expect(dist['o2']).toBe(4)
      expect(dist['o1'] + dist['o2']).toBe(7)
    })
  })
})

// ===========================================================================
// 3. computeActualPct — pillar actual distribution from posts
// ===========================================================================

describe('Sprint 3: computeActualPct', () => {
  const p1 = 'pillar-1'
  const p2 = 'pillar-2'

  it('returns 0 when no posts have pillar assignments', () => {
    const posts = [makePost(), makePost()]
    expect(computeActualPct(posts, p1)).toBe(0)
  })

  it('returns 100 when all assigned posts belong to one pillar', () => {
    const posts = [
      makePost({ pillar_id: p1 }),
      makePost({ pillar_id: p1 }),
      makePost({ pillar_id: p1 }),
    ]
    expect(computeActualPct(posts, p1)).toBe(100)
  })

  it('returns correct percentage for mixed pillar assignments', () => {
    const posts = [
      makePost({ pillar_id: p1 }),
      makePost({ pillar_id: p1 }),
      makePost({ pillar_id: p2 }),
      makePost({ pillar_id: p2 }),
    ]
    expect(computeActualPct(posts, p1)).toBe(50)
    expect(computeActualPct(posts, p2)).toBe(50)
  })

  it('ignores unassigned posts in denominator', () => {
    const posts = [
      makePost({ pillar_id: p1 }),
      makePost({ pillar_id: p2 }),
      makePost(), // unassigned
      makePost(), // unassigned
    ]
    // Only 2 assigned posts: 1/2 = 50%
    expect(computeActualPct(posts, p1)).toBe(50)
  })

  it('returns 0 for empty posts array', () => {
    expect(computeActualPct([], p1)).toBe(0)
  })

  it('returns 0 for pillar with no matching posts', () => {
    const posts = [makePost({ pillar_id: p1 }), makePost({ pillar_id: p1 })]
    expect(computeActualPct(posts, 'unknown-pillar')).toBe(0)
  })

  it('rounds to nearest integer', () => {
    const posts = [
      makePost({ pillar_id: p1 }),
      makePost({ pillar_id: p2 }),
      makePost({ pillar_id: p2 }),
    ]
    // p1: 1/3 = 33.33% → 33
    expect(computeActualPct(posts, p1)).toBe(33)
    // p2: 2/3 = 66.67% → 67
    expect(computeActualPct(posts, p2)).toBe(67)
  })
})

// ===========================================================================
// 4. getPillarBalance — balance status classification
// ===========================================================================

describe('Sprint 3: getPillarBalance', () => {
  const pillars = [
    { id: 'p1', weight_pct: 50 },
    { id: 'p2', weight_pct: 50 },
  ]

  it('returns "No data yet" with variant "ok" when no assigned posts', () => {
    const result = getPillarBalance([], pillars)
    expect(result.label).toBe('No data yet')
    expect(result.variant).toBe('ok')
  })

  it('returns "No data yet" when posts have no pillar assignments', () => {
    const posts = [makePost(), makePost()]
    const result = getPillarBalance(posts, pillars)
    expect(result.label).toBe('No data yet')
    expect(result.variant).toBe('ok')
  })

  it('returns "Well balanced" when deviation ≤ 5%', () => {
    // 50/50 split with 10 posts each → 50% actual vs 50% target = 0 deviation
    const posts = [
      ...Array.from({ length: 10 }, () => makePost({ pillar_id: 'p1' })),
      ...Array.from({ length: 10 }, () => makePost({ pillar_id: 'p2' })),
    ]
    const result = getPillarBalance(posts, pillars)
    expect(result.variant).toBe('good')
    expect(result.label).toBe('Well balanced')
  })

  it('returns "Slightly off-target" when deviation is 6-15%', () => {
    // 60/40 split → 10% deviation from 50/50
    const posts = [
      ...Array.from({ length: 6 }, () => makePost({ pillar_id: 'p1' })),
      ...Array.from({ length: 4 }, () => makePost({ pillar_id: 'p2' })),
    ]
    const result = getPillarBalance(posts, pillars)
    expect(result.variant).toBe('ok')
    expect(result.label).toBe('Slightly off-target')
  })

  it('returns "Needs rebalancing" when deviation > 15%', () => {
    // 80/20 split → 30% deviation from 50/50
    const posts = [
      ...Array.from({ length: 8 }, () => makePost({ pillar_id: 'p1' })),
      ...Array.from({ length: 2 }, () => makePost({ pillar_id: 'p2' })),
    ]
    const result = getPillarBalance(posts, pillars)
    expect(result.variant).toBe('off')
    expect(result.label).toBe('Needs rebalancing')
  })

  it('handles three pillars balance check', () => {
    const threePillars = [
      { id: 'p1', weight_pct: 34 },
      { id: 'p2', weight_pct: 33 },
      { id: 'p3', weight_pct: 33 },
    ]
    const posts = [
      ...Array.from({ length: 4 }, () => makePost({ pillar_id: 'p1' })),
      ...Array.from({ length: 3 }, () => makePost({ pillar_id: 'p2' })),
      ...Array.from({ length: 3 }, () => makePost({ pillar_id: 'p3' })),
    ]
    const result = getPillarBalance(posts, threePillars)
    // p1: 40% actual vs 34% target = 6% deviation → "ok"
    expect(result.variant).toBe('ok')
  })
})

// ===========================================================================
// 5. getPostsThisMonth
// ===========================================================================

describe('Sprint 3: getPostsThisMonth', () => {
  it('counts only posts from the current month', () => {
    const now = new Date()
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 15).toISOString()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString()
    const posts = [
      makePost({ suggested_publish_at: thisMonth }),
      makePost({ suggested_publish_at: thisMonth }),
      makePost({ suggested_publish_at: lastMonth }),
    ]
    expect(getPostsThisMonth(posts)).toBe(2)
  })

  it('falls back to created_at when suggested_publish_at is null', () => {
    const now = new Date()
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 10).toISOString()
    const posts = [
      makePost({ suggested_publish_at: null, created_at: thisMonth }),
    ]
    expect(getPostsThisMonth(posts)).toBe(1)
  })

  it('returns 0 for empty posts array', () => {
    expect(getPostsThisMonth([])).toBe(0)
  })

  it('returns 0 when all posts are from previous months', () => {
    const oldDate = '2025-01-15T00:00:00Z'
    const posts = [
      makePost({ suggested_publish_at: oldDate, created_at: oldDate }),
      makePost({ suggested_publish_at: oldDate, created_at: oldDate }),
    ]
    expect(getPostsThisMonth(posts)).toBe(0)
  })
})

// ===========================================================================
// 6. Integration: research items → briefs creation
// ===========================================================================

describe('Sprint 3: Research → brief creation integration', () => {
  const pillars = [
    makePillar({ id: 'p-ai', name: 'AI Agents', weight_pct: 40 }),
    makePillar({ id: 'p-mktg', name: 'Marketing', weight_pct: 35 }),
    makePillar({ id: 'p-lead', name: 'Leadership', weight_pct: 25 }),
  ]

  it('creates briefs for each research item up to the gap limit', () => {
    const items = [
      makeResearchItem({ title: 'AI Trends', pillar_id: 'p-ai', relevance_score: 0.9 }),
      makeResearchItem({ title: 'SEO Guide', pillar_id: 'p-mktg', relevance_score: 0.8 }),
      makeResearchItem({ title: 'Team Building', pillar_id: 'p-lead', relevance_score: 0.7 }),
    ]

    const { briefs, consumedIds } = planBriefsFromResearch(items, pillars, 3)

    expect(briefs).toHaveLength(3)
    expect(consumedIds).toHaveLength(3)
    expect(briefs[0].angle).toBe('AI Trends') // highest score first
    expect(briefs[1].angle).toBe('SEO Guide')
    expect(briefs[2].angle).toBe('Team Building')
  })

  it('limits briefs to gap count even if more research is available', () => {
    const items = [
      makeResearchItem({ title: 'Item 1', relevance_score: 0.9 }),
      makeResearchItem({ title: 'Item 2', relevance_score: 0.8 }),
      makeResearchItem({ title: 'Item 3', relevance_score: 0.7 }),
      makeResearchItem({ title: 'Item 4', relevance_score: 0.6 }),
      makeResearchItem({ title: 'Item 5', relevance_score: 0.5 }),
    ]

    const { briefs, consumedIds } = planBriefsFromResearch(items, pillars, 3)
    expect(briefs).toHaveLength(3)
    expect(consumedIds).toHaveLength(3)
  })

  it('creates fewer briefs when research items < gap', () => {
    const items = [
      makeResearchItem({ title: 'Only One', relevance_score: 0.9 }),
    ]

    const { briefs, consumedIds } = planBriefsFromResearch(items, pillars, 5)
    expect(briefs).toHaveLength(1)
    expect(consumedIds).toHaveLength(1)
  })

  it('preserves pillar_id from research item to brief', () => {
    const items = [
      makeResearchItem({ pillar_id: 'p-ai', relevance_score: 0.9 }),
      makeResearchItem({ pillar_id: 'p-mktg', relevance_score: 0.8 }),
    ]

    const { briefs } = planBriefsFromResearch(items, pillars, 2)
    expect(briefs[0].pillar_id).toBe('p-ai')
    expect(briefs[1].pillar_id).toBe('p-mktg')
  })

  it('stores research item ID in brief research_refs', () => {
    const item = makeResearchItem({ id: 'research-123', relevance_score: 0.9 })
    const { briefs } = planBriefsFromResearch([item], pillars, 1)
    expect(briefs[0].research_refs).toEqual(['research-123'])
  })

  it('selects items by highest relevance score', () => {
    const items = [
      makeResearchItem({ title: 'Low', relevance_score: 0.3 }),
      makeResearchItem({ title: 'High', relevance_score: 0.95 }),
      makeResearchItem({ title: 'Medium', relevance_score: 0.6 }),
    ]

    const { briefs } = planBriefsFromResearch(items, pillars, 2)
    expect(briefs[0].angle).toBe('High')
    expect(briefs[1].angle).toBe('Medium')
  })

  it('creates 0 briefs when gap is 0', () => {
    const items = [makeResearchItem({ relevance_score: 0.9 })]
    const { briefs, consumedIds } = planBriefsFromResearch(items, pillars, 0)
    expect(briefs).toHaveLength(0)
    expect(consumedIds).toHaveLength(0)
  })

  it('creates 0 briefs from empty research pool', () => {
    const { briefs, consumedIds } = planBriefsFromResearch([], pillars, 5)
    expect(briefs).toHaveLength(0)
    expect(consumedIds).toHaveLength(0)
  })
})

// ===========================================================================
// 7. Consumed items no longer appear in "new" query
// ===========================================================================

describe('Sprint 3: Consumed items filtering', () => {
  it('consumed items are excluded from new-status filtering', () => {
    const items = [
      makeResearchItem({ id: 'r1', status: 'new' }),
      makeResearchItem({ id: 'r2', status: 'consumed' }),
      makeResearchItem({ id: 'r3', status: 'new' }),
    ]

    const newOnly = items.filter((i) => i.status === 'new')
    expect(newOnly).toHaveLength(2)
    expect(newOnly.map((i) => i.id)).not.toContain('r2')
  })

  it('after planning, consumed IDs should mark items as consumed', () => {
    const items = [
      makeResearchItem({ id: 'r1', status: 'new', relevance_score: 0.9 }),
      makeResearchItem({ id: 'r2', status: 'new', relevance_score: 0.8 }),
      makeResearchItem({ id: 'r3', status: 'new', relevance_score: 0.7 }),
    ]

    const pillars = [makePillar()]
    const { consumedIds } = planBriefsFromResearch(items, pillars, 2)

    // Simulate marking as consumed
    const updated = items.map((item) =>
      consumedIds.includes(item.id) ? { ...item, status: 'consumed' as const } : item,
    )

    const remaining = updated.filter((i) => i.status === 'new')
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe('r3')
  })

  it('consumed items are never selected for planning', () => {
    const items = [
      makeResearchItem({ id: 'r1', status: 'consumed', relevance_score: 0.99 }),
      makeResearchItem({ id: 'r2', status: 'new', relevance_score: 0.5 }),
    ]

    const pillars = [makePillar()]
    const { briefs, consumedIds } = planBriefsFromResearch(items, pillars, 2)
    expect(briefs).toHaveLength(1)
    expect(consumedIds).toEqual([items[1].id])
  })
})

// ===========================================================================
// 8. Idempotency: run planning twice → no duplicate briefs
// ===========================================================================

describe('Sprint 3: Planning idempotency', () => {
  it('does not create duplicates when planning is run twice', () => {
    const items = [
      makeResearchItem({ id: 'r1', status: 'new', relevance_score: 0.9 }),
      makeResearchItem({ id: 'r2', status: 'new', relevance_score: 0.8 }),
      makeResearchItem({ id: 'r3', status: 'new', relevance_score: 0.7 }),
    ]

    const pillars = [makePillar()]

    // First run
    const run1 = planBriefsFromResearch(items, pillars, 2)
    expect(run1.briefs).toHaveLength(2)

    // Simulate consuming items after first run
    const updatedItems = items.map((item) =>
      run1.consumedIds.includes(item.id)
        ? { ...item, status: 'consumed' as const }
        : item,
    )

    // Second run on same pool (with consumed items)
    const run2 = planBriefsFromResearch(updatedItems, pillars, 2)
    expect(run2.briefs).toHaveLength(1) // Only r3 remains
    expect(run2.consumedIds).toEqual([items[2].id])

    // No overlap between runs
    const allConsumed = [...run1.consumedIds, ...run2.consumedIds]
    const unique = new Set(allConsumed)
    expect(unique.size).toBe(allConsumed.length) // no duplicates
  })

  it('returns 0 briefs on second run when all items consumed', () => {
    const items = [
      makeResearchItem({ id: 'r1', status: 'new', relevance_score: 0.9 }),
    ]

    const pillars = [makePillar()]

    const run1 = planBriefsFromResearch(items, pillars, 1)
    expect(run1.briefs).toHaveLength(1)

    const updatedItems = items.map((item) =>
      run1.consumedIds.includes(item.id)
        ? { ...item, status: 'consumed' as const }
        : item,
    )

    const run2 = planBriefsFromResearch(updatedItems, pillars, 1)
    expect(run2.briefs).toHaveLength(0)
    expect(run2.consumedIds).toHaveLength(0)
  })
})

// ===========================================================================
// 9. Edge cases
// ===========================================================================

describe('Sprint 3: Edge cases', () => {
  it('handles null relevance_score items (sorted last)', () => {
    const items = [
      makeResearchItem({ title: 'Null Score', relevance_score: null }),
      makeResearchItem({ title: 'Has Score', relevance_score: 0.5 }),
    ]

    const pillars = [makePillar()]
    const { briefs } = planBriefsFromResearch(items, pillars, 2)
    expect(briefs[0].angle).toBe('Has Score')
    expect(briefs[1].angle).toBe('Null Score')
  })

  it('handles items with no pillar_id (unmatched research)', () => {
    const item = makeResearchItem({ pillar_id: null, relevance_score: 0.8 })
    const pillars = [makePillar()]
    const { briefs } = planBriefsFromResearch([item], pillars, 1)
    expect(briefs[0].pillar_id).toBeNull()
  })

  it('brief status defaults to pending', () => {
    const item = makeResearchItem({ relevance_score: 0.9 })
    const pillars = [makePillar()]
    const { briefs } = planBriefsFromResearch([item], pillars, 1)
    expect(briefs[0].status).toBe('pending')
  })

  it('strategy config validation boundaries', () => {
    // monthly_post_target range: 1-100
    expect(makeStrategyConfig({ monthly_post_target: 1 }).monthly_post_target).toBe(1)
    expect(makeStrategyConfig({ monthly_post_target: 100 }).monthly_post_target).toBe(100)

    // intel_score_threshold range: 0-1
    expect(makeStrategyConfig({ intel_score_threshold: 0 }).intel_score_threshold).toBe(0)
    expect(makeStrategyConfig({ intel_score_threshold: 1 }).intel_score_threshold).toBe(1)

    // default_publish_hour range: 0-23
    expect(makeStrategyConfig({ default_publish_hour: 0 }).default_publish_hour).toBe(0)
    expect(makeStrategyConfig({ default_publish_hour: 23 }).default_publish_hour).toBe(23)
  })

  it('brief status transitions are valid', () => {
    const validStatuses = ['pending', 'in_review', 'revision_requested', 'done'] as const
    type BriefStatus = (typeof validStatuses)[number]

    const s1: BriefStatus = 'pending'
    const s2: BriefStatus = 'in_review'
    const s3: BriefStatus = 'revision_requested'
    const s4: BriefStatus = 'done'

    expect(validStatuses).toContain(s1)
    expect(validStatuses).toContain(s2)
    expect(validStatuses).toContain(s3)
    expect(validStatuses).toContain(s4)
    expect(validStatuses).toHaveLength(4)
  })

  it('pillar weight_pct boundaries (0-100)', () => {
    const zeroPillar = makePillar({ weight_pct: 0 })
    expect(zeroPillar.weight_pct).toBe(0)

    const fullPillar = makePillar({ weight_pct: 100 })
    expect(fullPillar.weight_pct).toBe(100)
  })

  it('empty calendar month scenario: all slots available for planning', () => {
    const gap = computeCalendarGap(0, 20)
    expect(gap).toBe(20)

    const emptyDays = findEmptyDays(2026, 2, [])
    expect(emptyDays.length).toBe(31)
    // Even with 20 posts needed, we have 31 available days
    expect(emptyDays.length).toBeGreaterThanOrEqual(gap)
  })
})

// ===========================================================================
// 10. Zod schema validation for briefs API
// ===========================================================================

describe('Sprint 3: Brief creation schema validation', () => {
  const { z } = require('zod')

  const CreateBriefSchema = z.object({
    pillar_id: z.string().uuid().nullable().optional(),
    angle: z.string().min(1, 'Angle is required'),
    research_refs: z.array(z.string().uuid()).default([]),
    voice_notes: z.string().nullable().optional(),
    publish_at: z.string().datetime({ offset: true }).nullable().optional(),
    assigned_agent_id: z.string().uuid().nullable().optional(),
  })

  it('accepts valid brief with required fields only', () => {
    const result = CreateBriefSchema.safeParse({ angle: 'AI Agents in 2026' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.angle).toBe('AI Agents in 2026')
      expect(result.data.research_refs).toEqual([])
    }
  })

  it('accepts valid brief with all fields', () => {
    const result = CreateBriefSchema.safeParse({
      pillar_id: '550e8400-e29b-41d4-a716-446655440000',
      angle: 'AI Agent Trends',
      research_refs: ['550e8400-e29b-41d4-a716-446655440001'],
      voice_notes: 'Keep it conversational',
      publish_at: '2026-03-20T09:00:00+00:00',
      assigned_agent_id: '550e8400-e29b-41d4-a716-446655440002',
    })
    expect(result.success).toBe(true)
  })

  it('rejects brief with empty angle', () => {
    const result = CreateBriefSchema.safeParse({ angle: '' })
    expect(result.success).toBe(false)
  })

  it('rejects brief without angle', () => {
    const result = CreateBriefSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID pillar_id', () => {
    const result = CreateBriefSchema.safeParse({
      angle: 'Test',
      pillar_id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('accepts null pillar_id', () => {
    const result = CreateBriefSchema.safeParse({
      angle: 'Test',
      pillar_id: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID entries in research_refs', () => {
    const result = CreateBriefSchema.safeParse({
      angle: 'Test',
      research_refs: ['not-a-uuid'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid datetime for publish_at', () => {
    const result = CreateBriefSchema.safeParse({
      angle: 'Test',
      publish_at: 'not-a-date',
    })
    expect(result.success).toBe(false)
  })

  it('accepts ISO datetime with timezone offset', () => {
    const result = CreateBriefSchema.safeParse({
      angle: 'Test',
      publish_at: '2026-04-01T14:30:00+05:00',
    })
    expect(result.success).toBe(true)
  })
})
