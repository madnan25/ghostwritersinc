import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { authenticateAgent, getAgentRateLimitKey, hasAgentPermission, isAgentContext } from '@/lib/agent-auth'
import { rateLimit } from '@/lib/rate-limit'

/**
 * Detect MIME type from file magic bytes.
 * Returns detected type or null if inconclusive.
 */
function detectMimeFromBytes(buffer: Buffer, ext: string): string | null {
  if (buffer.length < 4) return null

  // ZIP magic bytes: PK\x03\x04
  if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return 'application/zip'
  }

  // .txt files: verify content is valid UTF-8 text (no binary control chars except whitespace)
  if (ext === '.txt') {
    // Check first 1KB for non-text bytes
    const sample = buffer.subarray(0, Math.min(1024, buffer.length))
    for (const byte of sample) {
      if (byte < 0x09 || (byte > 0x0D && byte < 0x20 && byte !== 0x1B)) {
        return 'application/octet-stream' // binary content in a .txt file
      }
    }
    return 'text/plain'
  }

  return null // inconclusive
}

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

  // Server-side MIME verification via magic bytes (defense-in-depth)
  const buffer = Buffer.from(await file.arrayBuffer())
  const detectedType = detectMimeFromBytes(buffer, ext)
  if (detectedType && !ALLOWED_TYPES.includes(detectedType)) {
    return NextResponse.json(
      { error: `File content does not match declared MIME type (detected: ${detectedType})` },
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
