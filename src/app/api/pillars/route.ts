import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  authenticateAgent,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
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

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'read'), { maxRequests: 60 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: read access required' },
      { status: 403 }
    )
  }

  const supabase = createAdminClient()

  const { data: pillars, error } = await supabase
    .from('content_pillars')
    .select('*')
    .eq('organization_id', auth.organizationId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[pillars] DB error listing pillars:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Get post counts per pillar
  const { data: counts } = await supabase
    .from('posts')
    .select('pillar_id')
    .eq('organization_id', auth.organizationId)
    .not('pillar_id', 'is', null)

  const countMap: Record<string, number> = {}
  for (const row of counts ?? []) {
    if (row.pillar_id) {
      countMap[row.pillar_id] = (countMap[row.pillar_id] ?? 0) + 1
    }
  }

  const result = pillars.map((p) => ({
    ...p,
    post_count: countMap[p.id] ?? 0,
  }))

  return NextResponse.json(result)
}

/** POST /api/pillars — create a new pillar */
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'write'), { maxRequests: 10 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: write access required' },
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

  // Check slug uniqueness within org
  const { data: existing } = await supabase
    .from('content_pillars')
    .select('id')
    .eq('organization_id', auth.organizationId)
    .eq('slug', parsed.data.slug)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'A pillar with this slug already exists in this organization' },
      { status: 409 }
    )
  }

  // Check weight_pct sum (warn, don't block)
  const { data: allPillars } = await supabase
    .from('content_pillars')
    .select('weight_pct')
    .eq('organization_id', auth.organizationId)

  const currentTotal = (allPillars ?? []).reduce((sum, p) => sum + p.weight_pct, 0)
  const newTotal = currentTotal + parsed.data.weight_pct
  const weightWarning = newTotal !== 100
    ? `Weight total will be ${newTotal}% (expected 100%)`
    : undefined

  const { data: pillar, error } = await supabase
    .from('content_pillars')
    .insert({
      organization_id: auth.organizationId,
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
