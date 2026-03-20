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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'research-uploads-read'), { maxRequests: 60 })
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
    console.error('[research/uploads] DB error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (!data || !canAccessAgentUserRecord(auth, { organization_id: data.organization_id, user_id: data.uploaded_by })) {
    return NextResponse.json({ error: 'Research document not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
