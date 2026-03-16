import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from './supabase/admin'

export interface AgentContext {
  agentName: string
  organizationId: string
  permissions: string[]
}

/**
 * Validates the agent API key from the Authorization header.
 * Returns the agent context or a 401 response.
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
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('agent_keys')
    .select('agent_name, organization_id, permissions')
    .eq('api_key_hash', apiKey)
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 401 }
    )
  }

  return {
    agentName: data.agent_name,
    organizationId: data.organization_id,
    permissions: data.permissions,
  }
}

export function isAgentContext(result: AgentContext | NextResponse): result is AgentContext {
  return !(result instanceof NextResponse)
}
