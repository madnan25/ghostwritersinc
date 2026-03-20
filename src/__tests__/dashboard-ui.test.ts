import { describe, expect, it } from 'vitest'
import type { ContentPillar, Post } from '@/lib/types'
import {
  DASHBOARD_STATUS_FILTERS,
  filterPostsByDashboardRule,
  filterPostsByPillars,
  getPillarFilterOptions,
  getStatusFilterCount,
  sortDashboardPosts,
  WILDCARD_PILLAR_ID,
} from '@/lib/dashboard-ui'

const PILLARS: ContentPillar[] = [
  {
    id: 'pillar-1',
    organization_id: 'org-1',
    user_id: 'user-1',
    name: 'AI',
    slug: 'ai',
    description: null,
    color: '#7CFF6B',
    weight_pct: 40,
    active: true,
    audience_summary: null,
    example_hooks: [],
    sort_order: 1,
    brief_ref: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'pillar-2',
    organization_id: 'org-1',
    user_id: 'user-1',
    name: 'Growth',
    slug: 'growth',
    description: null,
    color: '#66B3FF',
    weight_pct: 60,
    active: true,
    audience_summary: null,
    example_hooks: [],
    sort_order: 2,
    brief_ref: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

function makePost(overrides: Partial<Post>): Post {
  return {
    id: crypto.randomUUID(),
    organization_id: 'org-1',
    user_id: 'user-1',
    title: null,
    content: 'Post title\nBody copy',
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('dashboard filter model', () => {
  const posts: Post[] = [
    makePost({ status: 'pending_review', reviewed_by_agent: null, pillar_id: 'pillar-1' }),
    makePost({ status: 'pending_review', reviewed_by_agent: 'scribe', pillar_id: 'pillar-1' }),
    makePost({ status: 'approved', pillar_id: 'pillar-2' }),
    makePost({ status: 'scheduled', scheduled_publish_at: '2026-03-21T10:00:00.000Z', pillar_id: 'pillar-1' }),
    makePost({ status: 'publish_failed', pillar_id: 'pillar-2' }),
  ]

  it('treats scheduled as its own explicit dashboard filter', () => {
    const scheduledFilter = DASHBOARD_STATUS_FILTERS.find((filter) => filter.id === 'scheduled')
    expect(scheduledFilter).toBeDefined()

    const result = filterPostsByDashboardRule(posts, scheduledFilter!)
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('scheduled')
  })

  it('keeps approved separate from scheduled', () => {
    const approvedFilter = DASHBOARD_STATUS_FILTERS.find((filter) => filter.id === 'approved')
    const result = filterPostsByDashboardRule(posts, approvedFilter!)

    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('approved')
  })

  it('counts statuses against the active pillar filter', () => {
    const scheduledFilter = DASHBOARD_STATUS_FILTERS.find((filter) => filter.id === 'scheduled')!
    const selectedPillars = new Set(['pillar-1'])

    expect(getStatusFilterCount(posts, scheduledFilter, selectedPillars)).toBe(1)
    expect(
      getStatusFilterCount(posts, scheduledFilter, new Set(['pillar-2']))
    ).toBe(0)
  })

  it('returns pillar counts within the active status filter', () => {
    const options = getPillarFilterOptions(PILLARS, posts, 'scheduled')

    expect(options.find((option) => option.id === 'pillar-1')?.count).toBe(1)
    expect(options.find((option) => option.id === 'pillar-2')?.count).toBe(0)
  })

  it('supports multi-select pillar filtering on top of status filtering', () => {
    const pendingApproval = DASHBOARD_STATUS_FILTERS.find((filter) => filter.id === 'needs_approval')!
    const filtered = filterPostsByPillars(
      filterPostsByDashboardRule(posts, pendingApproval),
      new Set(['pillar-1'])
    )

    expect(filtered).toHaveLength(1)
    expect(filtered[0].reviewed_by_agent).toBe('scribe')
  })

  it('adds a wildcard pillar option for uncategorized posts', () => {
    const options = getPillarFilterOptions(
      PILLARS,
      [...posts, makePost({ status: 'scheduled', pillar_id: null })],
      'scheduled'
    )

    expect(options.find((option) => option.id === WILDCARD_PILLAR_ID)?.count).toBe(1)
  })

  it('filters uncategorized posts through the wildcard pillar', () => {
    const filtered = filterPostsByPillars(
      [...posts, makePost({ status: 'draft', pillar_id: null })],
      new Set([WILDCARD_PILLAR_ID])
    )

    expect(filtered).toHaveLength(1)
    expect(filtered[0].pillar_id).toBeNull()
  })

  it('sorts the all view by workflow priority', () => {
    const sorted = sortDashboardPosts(posts, 'all')

    expect(sorted.map((post) => post.status)).toEqual([
      'pending_review',
      'pending_review',
      'approved',
      'scheduled',
      'publish_failed',
    ])
    expect(sorted[0].reviewed_by_agent).toBe('scribe')
    expect(sorted[1].reviewed_by_agent).toBeNull()
  })
})
