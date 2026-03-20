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

// Strict schema for preference_json — prevents stored XSS via arbitrary JSONB
// (Sentinel MEDIUM finding: .strict() with string .max() on all values)
const PreferenceJsonSchema = z
  .record(
    z.string().max(200),
    z.union([z.string().max(5000), z.number(), z.boolean(), z.null()])
  )
  .optional()
  .default({})

const UpsertContextualPrefsSchema = z.object({
  preference_json: PreferenceJsonSchema,
})

/** GET /api/strategist/contextual-prefs/[contextKey] — get prefs for a context */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contextKey: string }> }
) {
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

  const { contextKey } = await params

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('strategist_contextual_prefs')
    .select('*')
    .eq('user_id', auth.userId)
    .eq('organization_id', auth.organizationId)
    .eq('context_key', contextKey)
    .maybeSingle()

  if (error) {
    console.error('[strategist/contextual-prefs] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json(null, { status: 200 })
  }

  return NextResponse.json(data)
}

/** PUT /api/strategist/contextual-prefs/[contextKey] — upsert prefs for a context */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ contextKey: string }> }
) {
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

  const { contextKey } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = UpsertContextualPrefsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('strategist_contextual_prefs')
    .upsert(
      {
        user_id: auth.userId,
        organization_id: auth.organizationId,
        context_key: contextKey,
        preference_json: parsed.data.preference_json,
      },
      { onConflict: 'user_id,organization_id,context_key' }
    )
    .select()
    .single()

  if (error) {
    console.error('[strategist/contextual-prefs] PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
