import { NextRequest, NextResponse } from 'next/server'
import {
  authenticateAgent,
  canAccessAgentUserRecord,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { isValidUuid } from '@/lib/validation'

/** Sanitize a filename for safe use in Content-Disposition headers */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[\r\n"\\]/g, '_').replace(/[^\x20-\x7E]/g, '_')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid upload ID format' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('research_uploads')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[research/download] DB error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (!data || !canAccessAgentUserRecord(auth, { organization_id: data.organization_id, user_id: data.uploaded_by })) {
    return NextResponse.json({ error: 'Research document not found' }, { status: 404 })
  }

  if (!data.storage_path) {
    return NextResponse.json({ error: 'No file associated with this record' }, { status: 404 })
  }

  const { data: fileData, error: downloadError } = await admin.storage
    .from('research')
    .download(data.storage_path)

  if (downloadError || !fileData) {
    console.error('[research/download] Storage error:', downloadError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  // Update last_accessed_at
  await admin
    .from('research_uploads')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', id)

  const content = await fileData.text()

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `inline; filename="${sanitizeFilename(data.filename)}"`,
    },
  })
}
