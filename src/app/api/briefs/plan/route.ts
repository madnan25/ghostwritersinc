import { NextRequest, NextResponse } from 'next/server'
import {
  authenticateAgent,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAgentActivity } from '@/lib/agent-activity'
import { rateLimit } from '@/lib/rate-limit'
import {
  computeCalendarGap,
  distributeBriefsByWeight,
  distributeWildcards,
  findEmptyDays,
  getPostsThisMonth,
} from '@/lib/content-planning'
import { normalizePillarInput } from '@/lib/pillar-normalization'
import {
  boostResearchByPerformance,
  computePerformanceAwareWeights,
  computePillarPerformance,
  generateWhatsWorking,
  getPublishedPostsWithMetrics,
  saveWhatsWorking,
} from '@/lib/performance-analysis'

/**
 * POST /api/briefs/plan — Strategist Monday planning endpoint.
 *
 * Reads strategy_config, counts this month's posts, identifies calendar gaps,
 * pulls top-scored research items, creates briefs respecting pillar weights,
 * marks consumed research items, and returns the plan summary.
 *
 * Idempotent: consumed items are never re-selected.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'write'), { maxRequests: 5 })
  if (limited) return limited

  if (
    !hasAgentPermission(auth.permissions, 'briefs:write') ||
    !hasAgentPermission(auth.permissions, 'research:write') ||
    !hasAgentPermission(auth.permissions, 'strategy:read')
  ) {
    return NextResponse.json(
      { error: 'Insufficient permissions: requires briefs:write, research:write, strategy:read' },
      { status: 403 },
    )
  }

  const supabase = createAdminClient()
  const providerRunId = request.headers.get('x-paperclip-run-id')

  // 1. Load strategy config
  const { data: config, error: configErr } = await supabase
    .from('strategy_config')
    .select('*')
    .eq('user_id', auth.userId)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (configErr) {
    console.error('[briefs/plan] strategy_config error:', configErr)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const monthlyTarget = config?.monthly_post_target ?? 12
  const intelThreshold = config?.intel_score_threshold ?? 0.7
  const defaultHour = config?.default_publish_hour ?? 9
  const wildcardCount = config?.wildcard_count ?? 0

  // 2. Count posts this month
  const { data: posts, error: postsErr } = await supabase
    .from('posts')
    .select('id, pillar_id, suggested_publish_at, created_at, status')
    .eq('organization_id', auth.organizationId)

  if (postsErr) {
    console.error('[briefs/plan] posts query error:', postsErr)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const thisMonthCount = getPostsThisMonth(posts ?? [])
  const gap = computeCalendarGap(thisMonthCount, monthlyTarget)

  // 3. Load content pillars
  const { data: pillars, error: pillarsErr } = await supabase
    .from('content_pillars')
    .select('id, name, weight_pct')
    .eq('user_id', auth.userId)
    .order('sort_order')

  if (pillarsErr) {
    console.error('[briefs/plan] pillars query error:', pillarsErr)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // 4. Load new research items sorted by relevance
  const { data: researchItems, error: researchErr } = await supabase
    .from('research_pool')
    .select('*')
    .eq('organization_id', auth.organizationId)
    .eq('status', 'new')
    .order('relevance_score', { ascending: false, nullsFirst: false })

  if (researchErr) {
    console.error('[briefs/plan] research_pool error:', researchErr)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const items = researchItems ?? []
  const pillarList = pillars ?? []

  // 4b. Load performance data for published posts
  const postsWithMetrics = await getPublishedPostsWithMetrics(supabase, auth.organizationId)
  const pillarPerformance = computePillarPerformance(
    postsWithMetrics,
    pillarList.map((p) => ({ id: p.id, name: p.name, weight_pct: p.weight_pct })),
  )

  // 4c. Apply performance-aware weight adjustments (10% tolerance)
  const adjustedPillars =
    postsWithMetrics.length > 0
      ? computePerformanceAwareWeights(pillarList, pillarPerformance)
      : pillarList

  // 4d. Boost research item scores by high-performing pillar data
  const researchBoosts = boostResearchByPerformance(items, pillarPerformance)

  // 4e. Regenerate "What's Working" summary when new performance data exists
  const whatsWorking = generateWhatsWorking(postsWithMetrics)
  if (whatsWorking) {
    await saveWhatsWorking(supabase, auth.userId, auth.organizationId, whatsWorking)
  }

  // 5. Determine how many briefs to create
  let briefsToCreate = gap
  let unscheduled = false

  if (gap === 0) {
    // Calendar full — only create unscheduled briefs if strong intel exists
    const strongIntel = items.filter(
      (r) => (r.relevance_score ?? 0) >= intelThreshold,
    )
    if (strongIntel.length === 0) {
      return NextResponse.json({
        status: 'no_action',
        message: 'Calendar is full and no high-relevance research available.',
        this_month_posts: thisMonthCount,
        monthly_target: monthlyTarget,
        gap: 0,
        briefs_created: 0,
      })
    }
    briefsToCreate = strongIntel.length
    unscheduled = true
  }

  // 5b. Split allocation: pillar briefs vs wildcard briefs
  // Wildcard count is capped so it never exceeds the total gap.
  const effectiveWildcardCount = unscheduled ? 0 : Math.min(wildcardCount, briefsToCreate)
  const pillarBriefCount = briefsToCreate - effectiveWildcardCount

  // 6. Distribute pillar briefs by weight (performance-adjusted)
  const distribution = distributeBriefsByWeight(adjustedPillars, pillarBriefCount)

  // 7. Find empty calendar days for scheduling
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const scheduledDates = (posts ?? [])
    .filter((p) => {
      if (!p.suggested_publish_at) return false
      const d = new Date(p.suggested_publish_at)
      return d >= monthStart && d < monthEnd
    })
    .map((p) => p.suggested_publish_at as string)
  const emptyDays = findEmptyDays(now.getFullYear(), now.getMonth(), scheduledDates)

  // 8. Pick research items per pillar and create briefs
  const createdBriefs: Array<Record<string, unknown>> = []
  const consumedIds: string[] = []
  let dayIndex = 0

  // Build a pool index by pillar, sorted by boosted relevance score
  const sortByBoosted = (a: (typeof items)[0], b: (typeof items)[0]) => {
    const aScore = researchBoosts.get(a.id) ?? a.relevance_score ?? 0
    const bScore = researchBoosts.get(b.id) ?? b.relevance_score ?? 0
    return bScore - aScore
  }

  const poolByPillar = new Map<string | null, typeof items>()
  for (const item of items) {
    const key = item.pillar_id
    if (!poolByPillar.has(key)) poolByPillar.set(key, [])
    poolByPillar.get(key)!.push(item)
  }
  // Sort each pool by performance-boosted relevance
  for (const pool of poolByPillar.values()) pool.sort(sortByBoosted)
  // Fallback pool for pillars with no matching research
  const anyPool = [...items].sort(sortByBoosted)

  for (const pillar of pillarList) {
    const count = distribution[pillar.id] ?? 0
    const pillarPool = poolByPillar.get(pillar.id) ?? []

    for (let i = 0; i < count; i++) {
      // Pick from pillar-specific pool first, then fallback
      let item = pillarPool.find((r) => !consumedIds.includes(r.id))
      if (!item) {
        item = anyPool.find((r) => !consumedIds.includes(r.id))
      }
      if (!item) break // no more research available

      const publishAt =
        unscheduled || dayIndex >= emptyDays.length
          ? null
          : `${emptyDays[dayIndex]}T${String(defaultHour).padStart(2, '0')}:00:00Z`

      if (!unscheduled) dayIndex++

      // Resolve the brief's pillar_id: use the research item's pillar, falling
      // back to the planned distribution pillar. If the item has no pillar_id,
      // attempt normalization using its title as a hint.
      let briefPillarId = item.pillar_id ?? pillar.id
      let briefMappingStatus: 'auto' | 'needs_review' = 'auto'

      if (!item.pillar_id) {
        const normalized = await normalizePillarInput(item.title, auth.userId, supabase)
        if (normalized) {
          briefPillarId = normalized.pillarId
        } else {
          // Fall back to distribution pillar but flag for review
          briefMappingStatus = 'needs_review'
        }
      }

      const { data: brief, error: briefErr } = await supabase
        .from('briefs')
        .insert({
          organization_id: auth.organizationId,
          pillar_id: briefPillarId,
          pillar_mapping_status: briefMappingStatus,
          angle: item.title,
          research_refs: [item.id],
          voice_notes: null,
          publish_at: publishAt,
          assigned_agent_id: null,
        })
        .select()
        .single()

      if (briefErr) {
        console.error('[briefs/plan] brief insert error:', briefErr)
        continue
      }

      consumedIds.push(item.id)
      createdBriefs.push(brief)
    }
  }

  // 8b. Create wildcard briefs (pillar_id: null), spread evenly across empty days
  if (effectiveWildcardCount > 0) {
    // Use remaining empty days after pillar scheduling
    const remainingEmptyDays = emptyDays.filter(
      (d) => !scheduledDates.includes(`${d}T${String(defaultHour).padStart(2, '0')}:00:00Z`) &&
        // also exclude days already assigned during pillar loop
        !createdBriefs.some(
          (b) => (b.publish_at as string | null) === `${d}T${String(defaultHour).padStart(2, '0')}:00:00Z`,
        ),
    )
    const wildcardDays = distributeWildcards(remainingEmptyDays, effectiveWildcardCount)

    for (let i = 0; i < effectiveWildcardCount; i++) {
      const item = anyPool.find((r) => !consumedIds.includes(r.id))
      if (!item) break

      const publishAt = wildcardDays[i]
        ? `${wildcardDays[i]}T${String(defaultHour).padStart(2, '0')}:00:00Z`
        : null

      const { data: brief, error: briefErr } = await supabase
        .from('briefs')
        .insert({
          organization_id: auth.organizationId,
          pillar_id: null,
          pillar_mapping_status: 'auto',
          angle: item.title,
          research_refs: [item.id],
          voice_notes: null,
          publish_at: publishAt,
          assigned_agent_id: null,
        })
        .select()
        .single()

      if (briefErr) {
        console.error('[briefs/plan] wildcard brief insert error:', briefErr)
        continue
      }

      consumedIds.push(item.id)
      createdBriefs.push(brief)
    }
  }

  // 9. Mark consumed research items
  if (consumedIds.length > 0) {
    const { error: consumeErr } = await supabase
      .from('research_pool')
      .update({ status: 'consumed' })
      .in('id', consumedIds)

    if (consumeErr) {
      console.error('[briefs/plan] consume error:', consumeErr)
    }
  }

  // 10. Log activity
  logAgentActivity({
    organizationId: auth.organizationId,
    agentId: auth.agentId,
    postId: null,
    actionType: 'draft_created',
    metadata: {
      entity: 'planning_run',
      briefs_created: createdBriefs.length,
      consumed_research: consumedIds.length,
      gap,
      unscheduled,
    },
    providerMetadata: providerRunId ? { provider_run_id: providerRunId } : undefined,
  })

  return NextResponse.json({
    status: 'planned',
    this_month_posts: thisMonthCount,
    monthly_target: monthlyTarget,
    gap,
    unscheduled,
    distribution,
    wildcard_briefs: effectiveWildcardCount,
    briefs_created: createdBriefs.length,
    briefs: createdBriefs,
    consumed_research_ids: consumedIds,
    performance_data: postsWithMetrics.length > 0
      ? {
          published_posts_with_metrics: postsWithMetrics.length,
          pillar_performance: pillarPerformance,
          whats_working_updated: whatsWorking !== null,
        }
      : null,
  })
}
