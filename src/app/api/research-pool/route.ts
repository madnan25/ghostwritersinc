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

const CreateResearchPoolSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  source_url: z.string().url().nullable().optional(),
  source_type: z.string().default('article'),
  pillar_id: z.string().uuid().nullable().optional(),
  relevance_score: z.number().min(0).max(1).nullable().optional(),
  raw_content: z.string().nullable().optional(),
})

/** POST /api/research-pool — create a new research pool item */
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'write'), { maxRequests: 10 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'research:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: research:write access required' },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateResearchPoolSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('research_pool')
    .insert({
      organization_id: auth.organizationId,
      title: parsed.data.title,
      source_url: parsed.data.source_url ?? null,
      source_type: parsed.data.source_type,
      pillar_id: parsed.data.pillar_id ?? null,
      relevance_score: parsed.data.relevance_score ?? null,
      raw_content: parsed.data.raw_content ?? null,
      created_by_agent_id: auth.agentId,
    })
    .select()
    .single()

  if (error) {
    console.error('[research-pool] DB error creating item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const providerRunId = request.headers.get('x-paperclip-run-id')
  logAgentActivity({
    organizationId: auth.organizationId,
    agentId: auth.agentId,
    postId: null,
    actionType: 'draft_created',
    metadata: { entity: 'research_pool', item_id: data.id },
    providerMetadata: providerRunId ? { provider_run_id: providerRunId } : undefined,
  })

  return NextResponse.json(data, { status: 201 })
}

/** GET /api/research-pool — list research pool items for the org */
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'read'), { maxRequests: 60 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'research:read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: research:read access required' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const pillarId = searchParams.get('pillar_id')

  const supabase = createAdminClient()
  let query = supabase
    .from('research_pool')
    .select('*')
    .eq('organization_id', auth.organizationId)
    .order('created_at', { ascending: false })

  if (status) {
    const validStatuses = ['new', 'consumed']
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
    console.error('[research-pool] DB error listing items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
