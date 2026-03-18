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

const VALID_POST_STATUSES = [
  'draft', 'agent_review', 'pending_review', 'approved', 'rejected', 'scheduled', 'posted',
] as const

const CreateDraftSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  content_type: z.enum(['text', 'image', 'document']).default('text'),
  pillar: z.string().nullable().optional(),
  pillar_id: z.string().uuid().nullable().optional(),
  brief_ref: z.string().max(512).nullable().optional(),
  suggested_publish_at: z.string().datetime({ offset: true }).nullable().optional(),
  media_urls: z.array(z.string().url()).nullable().optional(),
})

/** POST /api/drafts — create a new draft */
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'write'), { maxRequests: 10 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'drafts:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: drafts:write access required' },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateDraftSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Require the commissioned user to exist in the target org.
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('id', auth.userId)
    .eq('organization_id', auth.organizationId)
    .single()

  if (!user) {
    return NextResponse.json(
      { error: 'Assigned user not found for this organization' },
      { status: 400 }
    )
  }

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      organization_id: auth.organizationId,
      user_id: user.id,
      content: parsed.data.content,
      content_type: parsed.data.content_type,
      pillar: parsed.data.pillar ?? null,
      pillar_id: parsed.data.pillar_id ?? null,
      brief_ref: parsed.data.brief_ref ?? null,
      suggested_publish_at: parsed.data.suggested_publish_at ?? null,
      media_urls: parsed.data.media_urls ?? [],
      status: 'draft',
      agent_id: auth.agentId,
      created_by_agent: auth.agentName,
    })
    .select()
    .single()

  if (error) {
    console.error('[drafts] DB error creating draft:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(post, { status: 201 })
}

/** GET /api/drafts — list drafts (filterable by status) */
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'read'), { maxRequests: 60 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'drafts:read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: drafts:read access required' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const supabase = createAdminClient()
  let query = supabase
    .from('posts')
    .select('*')
    .eq('organization_id', auth.organizationId)
    .order('suggested_publish_at', { ascending: true })

  if (!isSharedOrgAgentContext(auth)) {
    query = query.eq('user_id', auth.userId)
  }

  if (status) {
    const statuses = status.split(',')
    const invalid = statuses.filter((s) => !(VALID_POST_STATUSES as readonly string[]).includes(s))
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid status values: ${invalid.join(', ')}` },
        { status: 400 }
      )
    }
    query = query.in('status', statuses)
  }

  const { data, error } = await query

  if (error) {
    console.error('[drafts] DB error listing drafts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
