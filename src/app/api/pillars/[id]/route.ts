import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  authenticateAgent,
  canAccessAgentOrgRecord,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
  requireSharedOrgAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

const UpdatePillarSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).max(128).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
  description: z.string().nullable().optional(),
  color: z.string().min(1).regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex color (e.g. #ff5733)').optional(),
  weight_pct: z.number().int().min(0).max(100).optional(),
  audience_summary: z.string().nullable().optional(),
  example_hooks: z.array(z.string()).optional(),
  sort_order: z.number().int().optional(),
  brief_ref: z.string().max(512).nullable().optional(),
})

/** PATCH /api/pillars/:id — update pillar fields */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'write'), { maxRequests: 10 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'pillars:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: pillars:write access required' },
      { status: 403 }
    )
  }

  const sharedContextError = requireSharedOrgAgentContext(auth)
  if (sharedContextError) {
    return sharedContextError
  }

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = UpdatePillarSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Verify pillar belongs to agent's org
  const { data: existing } = await supabase
    .from('content_pillars')
    .select('organization_id')
    .eq('id', id)
    .single()

  if (!existing || !canAccessAgentOrgRecord(auth, existing)) {
    return NextResponse.json({ error: 'Pillar not found' }, { status: 404 })
  }

  // If slug is changing, check uniqueness
  if (parsed.data.slug) {
    const { data: slugConflict } = await supabase
      .from('content_pillars')
      .select('id')
      .eq('organization_id', auth.organizationId)
      .eq('slug', parsed.data.slug)
      .neq('id', id)
      .maybeSingle()

    if (slugConflict) {
      return NextResponse.json(
        { error: 'A pillar with this slug already exists in this organization' },
        { status: 409 }
      )
    }
  }

  // Check weight_pct sum (warn, don't block)
  let weightWarning: string | undefined
  if (parsed.data.weight_pct !== undefined) {
    const { data: allPillars } = await supabase
      .from('content_pillars')
      .select('id, weight_pct')
      .eq('organization_id', auth.organizationId)

    const otherTotal = (allPillars ?? [])
      .filter((p) => p.id !== id)
      .reduce((sum, p) => sum + p.weight_pct, 0)
    const newTotal = otherTotal + parsed.data.weight_pct
    if (newTotal !== 100) {
      weightWarning = `Weight total will be ${newTotal}% (expected 100%)`
    }
  }

  const { data: pillar, error } = await supabase
    .from('content_pillars')
    .update(parsed.data)
    .eq('id', id)
    .eq('organization_id', auth.organizationId)
    .select()
    .single()

  if (error) {
    console.error('[pillars] DB error updating pillar:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({
    ...pillar,
    ...(weightWarning ? { _warning: weightWarning } : {}),
  })
}

/** DELETE /api/pillars/:id — delete pillar, nullify referencing posts */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'write'), { maxRequests: 10 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'pillars:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: pillars:write access required' },
      { status: 403 }
    )
  }

  const sharedContextError = requireSharedOrgAgentContext(auth)
  if (sharedContextError) {
    return sharedContextError
  }

  const { id } = await params
  const supabase = createAdminClient()

  // Verify pillar belongs to agent's org
  const { data: existing } = await supabase
    .from('content_pillars')
    .select('organization_id')
    .eq('id', id)
    .single()

  if (!existing || !canAccessAgentOrgRecord(auth, existing)) {
    return NextResponse.json({ error: 'Pillar not found' }, { status: 404 })
  }

  // Count affected posts before delete (FK ON DELETE SET NULL handles the nullification)
  const { count } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('pillar_id', id)

  const { error } = await supabase
    .from('content_pillars')
    .delete()
    .eq('id', id)
    .eq('organization_id', auth.organizationId)

  if (error) {
    console.error('[pillars] DB error deleting pillar:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({
    deleted: true,
    affected_posts: count ?? 0,
  })
}
