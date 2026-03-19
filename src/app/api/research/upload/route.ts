import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authenticateAgent, getAgentRateLimitKey, hasAgentPermission, isAgentContext } from '@/lib/agent-auth'
import { rateLimit } from '@/lib/rate-limit'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = ['text/plain', 'application/zip']
const ALLOWED_EXTENSIONS = ['.txt', '.zip']

export async function POST(request: NextRequest) {
  let organizationId: string | null = null
  let uploadedBy: string | null = null
  let agentId: string | null = null

  if (request.headers.get('authorization')?.startsWith('Bearer ')) {
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

    organizationId = auth.organizationId
    uploadedBy = auth.userId
    agentId = auth.agentId
  } else {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const admin = createAdminClient()
    const { data: dbUser } = await admin
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    organizationId = dbUser.organization_id
    uploadedBy = user.id
  }
  const admin = createAdminClient()

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Invalid MIME type. Allowed: ${ALLOWED_TYPES.join(', ')}` },
      { status: 400 }
    )
  }

  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` },
      { status: 400 }
    )
  }

  // Upload to Supabase Storage
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${organizationId}/${timestamp}-${safeName}`

  const { error: uploadError } = await admin.storage
    .from('research')
    .upload(storagePath, file, {
      contentType: file.type || 'text/plain',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Record in database
  const { data: record, error: dbError } = await admin
    .from('research_uploads')
    .insert({
      organization_id: organizationId,
      uploaded_by: uploadedBy,
      agent_id: agentId,
      filename: file.name,
      title: file.name,
      source_kind: 'upload',
      storage_path: storagePath,
      upload_type: 'whatsapp_chat',
      file_size_bytes: file.size,
      metadata: {},
    })
    .select()
    .single()

  if (dbError) {
    await admin.storage.from('research').remove([storagePath])
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json(record, { status: 201 })
}
