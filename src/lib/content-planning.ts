/**
 * Content Planning — pure logic for the Strategist agent's Monday planning heartbeat.
 *
 * Calendar gap analysis, pillar weight distribution, brief creation from research,
 * and balance assessment.
 */

import type { Brief, ContentPillar, Post, ResearchPoolItem } from '@/lib/types'

// ---------------------------------------------------------------------------
// Calendar gap calculation
// ---------------------------------------------------------------------------

/** Number of posting slots still needed this month. */
export function computeCalendarGap(
  existingPostCount: number,
  monthlyTarget: number,
): number {
  return Math.max(0, monthlyTarget - existingPostCount)
}

/** Days in a given month that have no scheduled posts (ISO date strings). */
export function findEmptyDays(
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
// Monthly post count
// ---------------------------------------------------------------------------

/** Count posts that belong to the current calendar month. */
export function getPostsThisMonth(posts: Pick<Post, 'suggested_publish_at' | 'created_at'>[]): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return posts.filter((p) => {
    const date = p.suggested_publish_at ?? p.created_at
    return new Date(date) >= start
  }).length
}

// ---------------------------------------------------------------------------
// Pillar weight distribution (largest-remainder method)
// ---------------------------------------------------------------------------

/**
 * Distribute N briefs across pillars proportional to their weight_pct.
 * Uses the largest-remainder method so the total always sums exactly.
 */
export function distributeBriefsByWeight(
  pillars: { id: string; weight_pct: number }[],
  totalBriefs: number,
): Record<string, number> {
  if (pillars.length === 0 || totalBriefs <= 0) return {}

  const totalWeight = pillars.reduce((s, p) => s + p.weight_pct, 0)
  if (totalWeight === 0) return {}

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
// Pillar balance assessment
// ---------------------------------------------------------------------------

/** Percentage of assigned posts belonging to a given pillar. */
export function computeActualPct(posts: Post[], pillarId: string): number {
  const pillarPosts = posts.filter((p) => p.pillar_id === pillarId)
  const assigned = posts.filter((p) => p.pillar_id)
  if (assigned.length === 0) return 0
  return Math.round((pillarPosts.length / assigned.length) * 100)
}

/** Classify how well the current post mix matches target pillar weights. */
export function getPillarBalance(
  posts: Post[],
  pillars: { id: string; weight_pct: number }[],
): { label: string; variant: 'good' | 'ok' | 'off' } {
  const assigned = posts.filter((p) => p.pillar_id)
  if (assigned.length === 0) return { label: 'No data yet', variant: 'ok' }

  const maxDeviation = Math.max(
    ...pillars.map((p) => {
      const actual = Math.round(
        (assigned.filter((post) => post.pillar_id === p.id).length /
          assigned.length) *
          100,
      )
      return Math.abs(actual - p.weight_pct)
    }),
  )

  if (maxDeviation <= 5) return { label: 'Well balanced', variant: 'good' }
  if (maxDeviation <= 15) return { label: 'Slightly off-target', variant: 'ok' }
  return { label: 'Needs rebalancing', variant: 'off' }
}

// ---------------------------------------------------------------------------
// Research → Brief creation
// ---------------------------------------------------------------------------

export interface PlanResult {
  briefs: Omit<Brief, 'id' | 'organization_id' | 'created_at' | 'updated_at'>[]
  consumedIds: string[]
}

/**
 * Create brief payloads from the highest-relevance new research items,
 * capped at `gap`. Returns brief data (without DB-generated fields) and
 * the IDs of research items to mark as consumed.
 */
export function planBriefsFromResearch(
  researchItems: ResearchPoolItem[],
  _pillars: ContentPillar[],
  gap: number,
): PlanResult {
  const available = researchItems.filter((r) => r.status === 'new')
  const sorted = [...available].sort(
    (a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0),
  )

  const toConsume = sorted.slice(0, gap)
  const briefs = toConsume.map((item) => ({
    pillar_id: item.pillar_id,
    angle: item.title,
    research_refs: [item.id],
    voice_notes: null,
    publish_at: null,
    status: 'pending' as const,
    revision_count: 0,
    revision_notes: null,
    assigned_agent_id: null,
  }))

  return { briefs, consumedIds: toConsume.map((i) => i.id) }
}
