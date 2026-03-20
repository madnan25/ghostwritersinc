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

const CreateSessionNoteSchema = z.object({
  notes: z.string().min(1).max(10000),
  session_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .optional(),
})

/** GET /api/strategist/session-notes — list session notes with optional date range */
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'read'), { maxRequests: 60 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'strategy:read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: strategy:read required' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const supabase = createAdminClient()
  let query = supabase
    .from('strategist_session_notes')
    .select('*')
    .eq('user_id', auth.userId)
    .eq('organization_id', auth.organizationId)
    .order('session_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)

  if (from) query = query.gte('session_date', from)
  if (to) query = query.lte('session_date', to)

  const { data, error } = await query

  if (error) {
    console.error('[strategist/session-notes] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

/** POST /api/strategist/session-notes — log a session note */
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'write'), { maxRequests: 20 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'strategy:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: strategy:write required' },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateSessionNoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('strategist_session_notes')
    .insert({
      user_id: auth.userId,
      organization_id: auth.organizationId,
      notes: parsed.data.notes,
      ...(parsed.data.session_date ? { session_date: parsed.data.session_date } : {}),
    })
    .select()
    .single()

  if (error) {
    console.error('[strategist/session-notes] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
