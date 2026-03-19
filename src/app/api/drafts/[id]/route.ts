import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateAgent, isAgentContext } from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

const UpdateDraftSchema = z.object({
  content: z.string().min(1).optional(),
  content_type: z.enum(['text', 'image', 'document']).optional(),
  pillar: z.string().nullable().optional(),
  pillar_id: z.string().uuid().nullable().optional(),
  brief_ref: z.string().nullable().optional(),
  suggested_publish_at: z.string().nullable().optional(),
  media_urls: z.array(z.string()).nullable().optional(),
  revision_reason: z.string().nullable().optional(),
})

/** PATCH /api/drafts/:id — update draft content/metadata */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    .select('organization_id, status, content')
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

  // Snapshot previous content into post_revisions before overwriting
  if (parsed.data.content && existing.content && parsed.data.content !== existing.content) {
    // Get the next version number
    const { data: lastRevision } = await supabase
      .from('post_revisions')
      .select('version_number')
      .eq('post_id', id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single()

    const nextVersion = (lastRevision?.version_number ?? 0) + 1

    await supabase.from('post_revisions').insert({
      post_id: id,
      version_number: nextVersion,
      content: existing.content,
      revised_by_agent: auth.agentName,
      revision_reason: parsed.data.revision_reason ?? null,
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { revision_reason, ...updateData } = parsed.data
  const updateFields = {
    ...updateData,
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(post)
}
