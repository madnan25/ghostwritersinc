import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  authenticateAgent,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
  isSharedOrgAgentContext,
} from '@/lib/agent-auth'
import { rateLimit } from '@/lib/rate-limit'

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

  const payload = body as Record<string, unknown>
  if (typeof payload.title !== 'string' || payload.title.trim().length === 0) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('research_uploads')
    .insert({
      organization_id: auth.organizationId,
      uploaded_by: auth.userId,
      agent_id: auth.agentId,
      filename: typeof payload.filename === 'string' ? payload.filename : `${payload.title}.txt`,
      title: payload.title.trim(),
      summary: typeof payload.summary === 'string' ? payload.summary : null,
      source_kind: typeof payload.source_kind === 'string' ? payload.source_kind : 'note',
      storage_path: typeof payload.storage_path === 'string' ? payload.storage_path : '',
      upload_type: typeof payload.upload_type === 'string' ? payload.upload_type : 'agent_note',
      file_size_bytes: typeof payload.file_size_bytes === 'number' ? payload.file_size_bytes : null,
      metadata:
        payload.metadata && typeof payload.metadata === 'object'
          ? payload.metadata
          : {},
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
