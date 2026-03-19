import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  authenticateAgent,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAgentActivity } from '@/lib/agent-activity'
import { rateLimit } from '@/lib/rate-limit'

const CreateBriefSchema = z.object({
  pillar_id: z.string().uuid().nullable().optional(),
  angle: z.string().min(1, 'Angle is required'),
  research_refs: z.array(z.string().uuid()).default([]),
  voice_notes: z.string().nullable().optional(),
  publish_at: z.string().datetime({ offset: true }).nullable().optional(),
  assigned_agent_id: z.string().uuid().nullable().optional(),
})

/** POST /api/briefs — create a new brief */
export async function POST(request: NextRequest) {
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateBriefSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('briefs')
    .insert({
      organization_id: auth.organizationId,
      pillar_id: parsed.data.pillar_id ?? null,
      angle: parsed.data.angle,
      research_refs: parsed.data.research_refs,
      voice_notes: parsed.data.voice_notes ?? null,
      publish_at: parsed.data.publish_at ?? null,
      assigned_agent_id: parsed.data.assigned_agent_id ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[briefs] DB error creating brief:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const providerRunId = request.headers.get('x-paperclip-run-id')
  logAgentActivity({
    organizationId: auth.organizationId,
    agentId: auth.agentId,
    postId: null,
    actionType: 'draft_created',
    metadata: { entity: 'brief', brief_id: data.id, pillar_id: parsed.data.pillar_id },
    providerMetadata: providerRunId ? { provider_run_id: providerRunId } : undefined,
  })

  return NextResponse.json(data, { status: 201 })
}

/** GET /api/briefs — list briefs for the org */
export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const pillarId = searchParams.get('pillar_id')

  const supabase = createAdminClient()
  let query = supabase
    .from('briefs')
    .select('*')
    .eq('organization_id', auth.organizationId)
    .order('created_at', { ascending: false })

  if (status) {
    const validStatuses = ['pending', 'in_review', 'revision_requested', 'done']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }
    query = query.eq('status', status)
  }

  if (pillarId) {
    query = query.eq('pillar_id', pillarId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[briefs] DB error listing briefs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
