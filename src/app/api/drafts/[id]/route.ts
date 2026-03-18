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

const UpdateDraftSchema = z.object({
  content: z.string().min(1).optional(),
  content_type: z.enum(['text', 'image', 'document']).optional(),
  pillar: z.string().nullable().optional(),
  pillar_id: z.string().uuid().nullable().optional(),
  brief_ref: z.string().max(512).nullable().optional(),
  suggested_publish_at: z.string().datetime({ offset: true }).nullable().optional(),
  media_urls: z.array(z.string().url()).nullable().optional(),
})

/** PATCH /api/drafts/:id — update draft content/metadata */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = UpdateDraftSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Verify the post belongs to the agent's organization
  const { data: existing } = await supabase
    .from('posts')
    .select('organization_id, status')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (existing.organization_id !== auth.organizationId) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (!['draft', 'agent_review', 'rejected'].includes(existing.status)) {
    return NextResponse.json(
      { error: `Cannot update post in "${existing.status}" status` },
      { status: 409 }
    )
  }

  const updateFields = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  }

  if ('media_urls' in parsed.data) {
    updateFields.media_urls = parsed.data.media_urls ?? []
  }

  const { data: post, error } = await supabase
    .from('posts')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[drafts] DB error updating draft:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(post)
}
