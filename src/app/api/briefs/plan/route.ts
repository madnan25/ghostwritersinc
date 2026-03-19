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
import { planContent } from '@/lib/content-planning'
import type { ContentPillar, Post, ResearchPoolItem, StrategyConfig } from '@/lib/types'

/**
 * POST /api/briefs/plan — Strategist Monday planning endpoint.
 *
 * 1. Fetch strategy config, posts, research pool, pillars
 * 2. Run planning logic (calendar gap analysis + brief creation)
 * 3. Insert briefs into DB
 * 4. Mark consumed research items
 * 5. Return created briefs
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'write'), { maxRequests: 5 })
  if (limited) return limited

  // Requires both briefs:write and research:write (to consume items)
  if (!hasAgentPermission(auth.permissions, 'briefs:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: briefs:write access required' },
      { status: 403 }
    )
  }
  if (!hasAgentPermission(auth.permissions, 'research:read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: research:read access required' },
      { status: 403 }
    )
  }

  const supabase = createAdminClient()

  // 1. Fetch strategy config
  const { data: configData, error: configError } = await supabase
    .from('strategy_config')
    .select('*')
    .eq('user_id', auth.userId)
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (configError) {
    console.error('[briefs/plan] Error fetching strategy config:', configError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (!configData) {
    return NextResponse.json(
      { error: 'Strategy config not found. Configure it first via PUT /api/strategy-config.' },
      { status: 404 }
    )
  }

  const config = configData as StrategyConfig

  // 2. Fetch posts, research pool, and pillars in parallel
  const [postsResult, researchResult, pillarsResult] = await Promise.all([
    supabase
      .from('posts')
      .select('*')
      .eq('organization_id', auth.organizationId)
      .in('status', ['draft', 'pending_review', 'approved', 'scheduled', 'published'])
      .order('suggested_publish_at', { ascending: true }),
    supabase
      .from('research_pool')
      .select('*')
      .eq('organization_id', auth.organizationId)
      .eq('status', 'new')
      .order('relevance_score', { ascending: false, nullsFirst: false }),
    supabase
      .from('content_pillars')
      .select('*')
      .eq('organization_id', auth.organizationId)
      .order('sort_order', { ascending: true }),
  ])

  if (postsResult.error || researchResult.error || pillarsResult.error) {
    console.error('[briefs/plan] DB error fetching data:', {
      posts: postsResult.error,
      research: researchResult.error,
      pillars: pillarsResult.error,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const posts = (postsResult.data ?? []) as Post[]
  const researchItems = (researchResult.data ?? []) as ResearchPoolItem[]
  const pillars = (pillarsResult.data ?? []) as ContentPillar[]

  // 3. Run planning logic
  const result = planContent(config, posts, researchItems, pillars)
  const allBriefs = [...result.briefs, ...result.unscheduledBriefs]

  if (allBriefs.length === 0) {
    return NextResponse.json({
      message: 'No briefs to create. Calendar is full with no strong intel above threshold.',
      gap: result.gap,
      created: 0,
    })
  }

  // 4. Insert briefs into DB
  const briefInserts = allBriefs.map((b) => ({
    organization_id: auth.organizationId,
    pillar_id: b.pillar_id,
    angle: b.angle,
    research_refs: b.research_refs,
    voice_notes: b.voice_notes,
    publish_at: b.publish_at,
    assigned_agent_id: null,
    status: 'pending' as const,
  }))

  const { data: createdBriefs, error: insertError } = await supabase
    .from('briefs')
    .insert(briefInserts)
    .select()

  if (insertError) {
    console.error('[briefs/plan] Error inserting briefs:', insertError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // 5. Mark consumed research items
  if (result.consumedIds.length > 0) {
    const { error: consumeError } = await supabase
      .from('research_pool')
      .update({ status: 'consumed', consumed_at: new Date().toISOString() })
      .in('id', result.consumedIds)

    if (consumeError) {
      console.error('[briefs/plan] Error consuming research items:', consumeError)
      // Non-fatal: briefs were already created
    }
  }

  // 6. Log activity
  const providerRunId = request.headers.get('x-paperclip-run-id')
  logAgentActivity({
    organizationId: auth.organizationId,
    agentId: auth.agentId,
    postId: null,
    actionType: 'draft_created',
    metadata: {
      entity: 'briefs_plan',
      gap: result.gap,
      scheduled_briefs: result.briefs.length,
      unscheduled_briefs: result.unscheduledBriefs.length,
      consumed_research: result.consumedIds.length,
    },
    providerMetadata: providerRunId ? { provider_run_id: providerRunId } : undefined,
  })

  return NextResponse.json({
    message: `Created ${createdBriefs?.length ?? 0} briefs`,
    gap: result.gap,
    created: createdBriefs?.length ?? 0,
    scheduled: result.briefs.length,
    unscheduled: result.unscheduledBriefs.length,
    consumed_research_items: result.consumedIds.length,
    briefs: createdBriefs,
  }, { status: 201 })
}
