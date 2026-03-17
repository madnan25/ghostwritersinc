import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateAgent, isAgentContext } from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

const CreateDraftSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  content_type: z.enum(['text', 'image', 'document']).default('text'),
  pillar: z.string().nullable().optional(),
  pillar_id: z.string().uuid().nullable().optional(),
  brief_ref: z.string().nullable().optional(),
  suggested_publish_at: z.string().nullable().optional(),
  media_urls: z.array(z.string()).nullable().optional(),
})

/** POST /api/drafts — create a new draft */
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

  const parsed = CreateDraftSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Get a user for the organization to assign the post to
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('organization_id', auth.organizationId)
    .limit(1)
    .single()

  if (!user) {
    return NextResponse.json(
      { error: 'No user found for this organization' },
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
      created_by_agent: auth.agentName,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(post, { status: 201 })
}

/** GET /api/drafts — list drafts (filterable by status) */
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

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const supabase = createAdminClient()
  let query = supabase
    .from('posts')
    .select('*')
    .eq('organization_id', auth.organizationId)
    .order('suggested_publish_at', { ascending: true })

  if (status) {
    const statuses = status.split(',')
    query = query.in('status', statuses)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
