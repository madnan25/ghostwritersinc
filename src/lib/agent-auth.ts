import { NextRequest, NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import { createAdminClient } from './supabase/admin'

const KEY_PREFIX_LENGTH = 8

export interface AgentContext {
  agentName: string
  organizationId: string
  permissions: string[]
}

/**
 * Validates the agent API key from the Authorization header.
 * Uses key_prefix for lookup and bcrypt for comparison.
 */
export async function authenticateAgent(
  request: NextRequest
): Promise<AgentContext | NextResponse> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing or invalid Authorization header' },
      { status: 401 }
    )
  }

  const apiKey = authHeader.slice(7)
  const prefix = apiKey.slice(0, KEY_PREFIX_LENGTH)
  const supabase = createAdminClient()

  const { data: candidates, error } = await supabase
    .from('agent_keys')
    .select('agent_name, organization_id, permissions, api_key_hash')
    .eq('key_prefix', prefix)

  if (error || !candidates || candidates.length === 0) {
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 401 }
    )
  }

  for (const candidate of candidates) {
    const match = await compare(apiKey, candidate.api_key_hash)
    if (match) {
      return {
        agentName: candidate.agent_name,
        organizationId: candidate.organization_id,
        permissions: candidate.permissions,
      }
    }
  }

  return NextResponse.json(
    { error: 'Invalid API key' },
    { status: 401 }
  )
}

export function isAgentContext(result: AgentContext | NextResponse): result is AgentContext {
  return !(result instanceof NextResponse)
}
