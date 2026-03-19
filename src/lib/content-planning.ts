import type { Brief, ContentPillar, Post, ResearchPoolItem, StrategyConfig } from './types'

// ---------------------------------------------------------------------------
// Calendar gap analysis
// ---------------------------------------------------------------------------

/**
 * Compute the number of posting slots needed for the remainder of a month.
 * If monthlyTarget is 12 and we already have 3 posts, gap = 9.
 */
export function computeCalendarGap(
  existingPostCount: number,
  monthlyTarget: number,
): number {
  return Math.max(0, monthlyTarget - existingPostCount)
}

/**
 * Determine which days in a given month have no scheduled posts.
 * Returns dates with no posts as ISO date strings (YYYY-MM-DD).
 */
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

/**
 * Count posts from the current month using suggested_publish_at (falls back to created_at).
 */
export function getPostsThisMonth(posts: Post[]): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return posts.filter((p) => {
    const date = p.suggested_publish_at ?? p.created_at
    return new Date(date) >= start
  }).length
}

// ---------------------------------------------------------------------------
// Pillar weight distribution
// ---------------------------------------------------------------------------

/**
 * Distribute N briefs across pillars proportional to their weight_pct.
 * Uses largest-remainder method to handle fractional allocations.
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

/**
 * Compute actual percentage of posts assigned to a pillar.
 */
export function computeActualPct(posts: Post[], pillarId: string): number {
  const pillarPosts = posts.filter((p) => p.pillar_id === pillarId)
  const assigned = posts.filter((p) => p.pillar_id)
  if (assigned.length === 0) return 0
  return Math.round((pillarPosts.length / assigned.length) * 100)
}

/**
 * Classify pillar balance as good/ok/off based on max deviation from targets.
 */
export function getPillarBalance(
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

// ---------------------------------------------------------------------------
// Brief planning from research items
// ---------------------------------------------------------------------------

/**
 * Assign publish_at dates to briefs, spreading them across empty days in the month.
 */
export function assignPublishDates(
  count: number,
  emptyDays: string[],
  defaultHour: number,
): (string | null)[] {
  if (emptyDays.length === 0 || count === 0) return Array(count).fill(null)

  const dates: (string | null)[] = []
  // Spread evenly across available empty days
  const step = Math.max(1, Math.floor(emptyDays.length / count))
  for (let i = 0; i < count; i++) {
    const dayIndex = Math.min(i * step, emptyDays.length - 1)
    const day = emptyDays[dayIndex]
    // Construct ISO datetime with the default hour
    const dt = new Date(`${day}T${String(defaultHour).padStart(2, '0')}:00:00Z`)
    dates.push(dt.toISOString())
  }
  return dates
}

export interface PlanResult {
  briefs: Array<{
    pillar_id: string | null
    angle: string
    research_refs: string[]
    voice_notes: string | null
    publish_at: string | null
  }>
  consumedIds: string[]
  gap: number
  unscheduledBriefs: Array<{
    pillar_id: string | null
    angle: string
    research_refs: string[]
    voice_notes: string | null
    publish_at: null
  }>
}

/**
 * Core planning logic: analyze calendar, select research, create brief payloads.
 *
 * Decision tree:
 * 1. Count posts this month vs target → compute gap
 * 2. If gap > 0: pull top research items up to gap, assign publish dates
 * 3. If gap = 0 + strong intel (above threshold): create unscheduled briefs
 * 4. If gap = 0 + no strong intel: exit (empty result)
 * 5. Mark consumed research items
 */
export function planContent(
  config: StrategyConfig,
  posts: Post[],
  researchItems: ResearchPoolItem[],
  pillars: ContentPillar[],
  now: Date = new Date(),
): PlanResult {
  const postsThisMonth = getPostsThisMonth(posts)
  const gap = computeCalendarGap(postsThisMonth, config.monthly_post_target)

  // Only "new" items, sorted by relevance score descending
  const available = researchItems
    .filter((r) => r.status === 'new')
    .sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0))

  if (gap > 0) {
    // Fill calendar gaps
    const toConsume = available.slice(0, gap)
    const consumedIds = toConsume.map((i) => i.id)

    // Find empty days for scheduling
    const scheduledDates = posts
      .filter((p) => p.scheduled_publish_at || p.suggested_publish_at)
      .map((p) => (p.scheduled_publish_at ?? p.suggested_publish_at)!)
    const emptyDays = findEmptyDays(now.getFullYear(), now.getMonth(), scheduledDates)
    const publishDates = assignPublishDates(toConsume.length, emptyDays, config.default_publish_hour)

    const briefs = toConsume.map((item, i) => ({
      pillar_id: item.pillar_id,
      angle: item.title,
      research_refs: [item.id],
      voice_notes: config.voice_notes,
      publish_at: publishDates[i] ?? null,
    }))

    return { briefs, consumedIds, gap, unscheduledBriefs: [] }
  }

  // Calendar full — check for strong intel
  const strongIntel = available.filter(
    (r) => (r.relevance_score ?? 0) >= config.intel_score_threshold,
  )

  if (strongIntel.length > 0) {
    // Create unscheduled briefs for strong intel
    const consumedIds = strongIntel.map((i) => i.id)
    const unscheduledBriefs = strongIntel.map((item) => ({
      pillar_id: item.pillar_id,
      angle: item.title,
      research_refs: [item.id],
      voice_notes: config.voice_notes,
      publish_at: null as null,
    }))

    return { briefs: [], consumedIds, gap: 0, unscheduledBriefs }
  }

  // Calendar full, no strong intel → exit
  return { briefs: [], consumedIds: [], gap: 0, unscheduledBriefs: [] }
}
