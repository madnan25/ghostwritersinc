import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import {
  authenticateAgent,
  getAgentFkId,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
  isSharedOrgAgentContext,
} from '@/lib/agent-auth'
import { rateLimit } from '@/lib/rate-limit'

const CreateUploadSchema = z.object({
  title: z.string().min(1, 'title is required').max(500),
  filename: z.string().max(500).optional(),
  summary: z.string().max(5000).nullable().optional(),
  source_kind: z.enum(['upload', 'note', 'url', 'api']).default('note'),
  storage_path: z.string().max(1000).default(''),
  upload_type: z.enum(['whatsapp_chat', 'agent_note', 'document', 'transcript']).default('agent_note'),
  file_size_bytes: z.number().int().nonnegative().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
})

export async function GET(request: NextRequest) {
  const admin = createAdminClient()

  if (request.headers.get('authorization')?.startsWith('Bearer ')) {
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

    let query = admin
      .from('research_uploads')
      .select('*')
      .eq('organization_id', auth.organizationId)
      .order('created_at', { ascending: false })

    if (!isSharedOrgAgentContext(auth)) {
      query = query.or(`uploaded_by.eq.${auth.userId},agent_id.eq.${auth.agentId}`)
    }

    const { data: uploads, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(uploads ?? [])
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: dbUser } = await admin
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { data: uploads, error } = await admin
    .from('research_uploads')
    .select('*')
    .eq('organization_id', dbUser.organization_id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(uploads)
}

export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'write'), { maxRequests: 20 })
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

  const parsed = CreateUploadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('research_uploads')
    .insert({
      organization_id: auth.organizationId,
      uploaded_by: auth.userId,
      agent_id: getAgentFkId(auth),
      filename: parsed.data.filename ?? `${parsed.data.title}.txt`,
      title: parsed.data.title.trim(),
      summary: parsed.data.summary ?? null,
      source_kind: parsed.data.source_kind,
      storage_path: parsed.data.storage_path,
      upload_type: parsed.data.upload_type,
      file_size_bytes: parsed.data.file_size_bytes ?? null,
      metadata: parsed.data.metadata,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
