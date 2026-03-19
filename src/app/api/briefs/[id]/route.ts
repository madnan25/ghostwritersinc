import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  authenticateAgent,
  canAccessAgentOrgRecord,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

const UpdateBriefSchema = z.object({
  pillar_id: z.string().uuid().nullable().optional(),
  angle: z.string().min(1).optional(),
  research_refs: z.array(z.string().uuid()).optional(),
  voice_notes: z.string().nullable().optional(),
  publish_at: z.string().datetime({ offset: true }).nullable().optional(),
  status: z.enum(['pending', 'in_review', 'revision_requested', 'done']).optional(),
  revision_notes: z.string().nullable().optional(),
  assigned_agent_id: z.string().uuid().nullable().optional(),
})

/** GET /api/briefs/:id — get a single brief */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'read'), { maxRequests: 60 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'briefs:read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: briefs:read access required' },
      { status: 403 }
    )
  }

  const { id } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('briefs')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[briefs] DB error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (!data || !canAccessAgentOrgRecord(auth, data)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

/** PATCH /api/briefs/:id — update a brief */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'write'), { maxRequests: 10 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'briefs:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: briefs:write access required' },
      { status: 403 }
    )
  }

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = UpdateBriefSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('briefs')
    .select('organization_id, revision_count')
    .eq('id', id)
    .maybeSingle()

  if (!existing || !canAccessAgentOrgRecord(auth, existing)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Increment revision_count when status moves to revision_requested
  const updateData: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.status === 'revision_requested') {
    updateData.revision_count = existing.revision_count + 1
  }

  const { data, error } = await supabase
    .from('briefs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[briefs] DB error updating:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data)
}

/** DELETE /api/briefs/:id — delete a brief */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'write'), { maxRequests: 10 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'briefs:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: briefs:write access required' },
      { status: 403 }
    )
  }

  const { id } = await params
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('briefs')
    .select('organization_id')
    .eq('id', id)
    .maybeSingle()

  if (!existing || !canAccessAgentOrgRecord(auth, existing)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('briefs')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[briefs] DB error deleting:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
