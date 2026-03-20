import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  authenticateAgent,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
  isSharedOrgAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

const CreatePillarSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required').max(128).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().nullable().optional(),
  color: z.string().min(1, 'Color is required').regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex color (e.g. #ff5733)'),
  weight_pct: z.number().int().min(0).max(100).default(0),
  audience_summary: z.string().nullable().optional(),
  example_hooks: z.array(z.string()).default([]),
  sort_order: z.number().int().default(0),
  brief_ref: z.string().max(512).nullable().optional(),
})

/** GET /api/pillars — list pillars for current org with post counts */
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'pillars-read'), { maxRequests: 60 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'pillars:read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: pillars:read access required' },
      { status: 403 }
    )
  }

  const supabase = createAdminClient()

  // Get scoped post counts per pillar.
  let countsQuery = supabase
    .from('posts')
    .select('pillar_id')
    .eq('organization_id', auth.organizationId)
    .not('pillar_id', 'is', null)

  if (!isSharedOrgAgentContext(auth)) {
    countsQuery = countsQuery.eq('user_id', auth.userId)
  }

  const { data: counts, error: countsError } = await countsQuery

  if (countsError) {
    console.error('[pillars] DB error listing pillar counts:', countsError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const countMap: Record<string, number> = {}
  const referencedPillarIds = new Set<string>()
  for (const row of counts ?? []) {
    if (row.pillar_id) {
      countMap[row.pillar_id] = (countMap[row.pillar_id] ?? 0) + 1
      referencedPillarIds.add(row.pillar_id)
    }
  }

  let pillarsQuery = supabase
    .from('content_pillars')
    .select('*')
    .order('sort_order', { ascending: true })

  // Shared-org agents (e.g. Strategist) need read access to all users' pillars
  // for content coordination. Write operations remain user-scoped. (LIN-190)
  if (isSharedOrgAgentContext(auth)) {
    pillarsQuery = pillarsQuery.eq('organization_id', auth.organizationId)
  } else {
    pillarsQuery = pillarsQuery.eq('user_id', auth.userId)
  }

  const { data: pillars, error } = await pillarsQuery

  if (error) {
    console.error('[pillars] DB error listing pillars:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const result = (pillars ?? []).map((p) => ({
    ...p,
    post_count: countMap[p.id] ?? 0,
  }))

  return NextResponse.json(result)
}

/** POST /api/pillars — create a new pillar */
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'pillars-write'), { maxRequests: 10 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'pillars:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: pillars:write access required' },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreatePillarSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Check slug uniqueness within user's pillars
  const { data: existing } = await supabase
    .from('content_pillars')
    .select('id')
    .eq('user_id', auth.userId)
    .eq('slug', parsed.data.slug)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'A pillar with this slug already exists for this user' },
      { status: 409 }
    )
  }

  // Check weight_pct sum (warn, don't block)
  const { data: allPillars } = await supabase
    .from('content_pillars')
    .select('weight_pct')
    .eq('user_id', auth.userId)

  const currentTotal = (allPillars ?? []).reduce((sum, p) => sum + p.weight_pct, 0)
  const newTotal = currentTotal + parsed.data.weight_pct
  const weightWarning = newTotal !== 100
    ? `Weight total will be ${newTotal}% (expected 100%)`
    : undefined

  const { data: pillar, error } = await supabase
    .from('content_pillars')
    .insert({
      organization_id: auth.organizationId,
      user_id: auth.userId,
      ...parsed.data,
    })
    .select()
    .single()

  if (error) {
    console.error('[pillars] DB error creating pillar:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(
    { ...pillar, ...(weightWarning ? { _warning: weightWarning } : {}) },
    { status: 201 }
  )
}
