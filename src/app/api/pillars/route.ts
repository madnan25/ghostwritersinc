import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateAgent, isAgentContext } from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

const CreatePillarSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
  description: z.string().nullable().optional(),
  color: z.string().min(1, 'Color is required'),
  weight_pct: z.number().int().min(0).max(100).default(0),
  audience_summary: z.string().nullable().optional(),
  example_hooks: z.array(z.string()).default([]),
  sort_order: z.number().int().default(0),
  brief_ref: z.string().nullable().optional(),
})

/** GET /api/pillars — list pillars for current org with post counts */
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = rateLimit(`read:${auth.agentName}`, { maxRequests: 60 })
  if (limited) return limited

  if (!auth.permissions.includes('read')) {
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
    return NextResponse.json({ error: error.message }, { status: 500 })
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

  const limited = rateLimit(`write:${auth.agentName}`, { maxRequests: 10 })
  if (limited) return limited

  if (!auth.permissions.includes('write')) {
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
      { error: `Slug "${parsed.data.slug}" already exists in this organization` },
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    { ...pillar, ...(weightWarning ? { _warning: weightWarning } : {}) },
    { status: 201 }
  )
}
