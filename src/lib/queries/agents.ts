import { createClient } from '@/lib/supabase/server'
import { logQueryError } from '@/lib/queries/errors'
import type { Agent, AgentKey, ReviewEvent } from '@/lib/types'

export async function getAgentKeys(): Promise<AgentKey[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agent_keys')
    .select(
      'id, agent_id, organization_id, user_id, agent_name, key_prefix, permissions, allow_shared_context, commissioned_by, created_at'
    )
    .order('created_at', { ascending: true })

  if (error) {
    logQueryError('agent keys', error)
    return []
  }
  return data ?? []
}

export async function getRecentReviewEventsByAgent(
  agentName: string,
  limit = 5,
): Promise<ReviewEvent[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('review_events')
    .select('*')
    .eq('agent_name', agentName)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    logQueryError(`review events for agent ${agentName}`, error)
    return []
  }
  return data ?? []
}

export async function getAllRecentReviewEvents(limit = 20): Promise<ReviewEvent[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('review_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    logQueryError('recent review events', error)
    return []
  }
  return data ?? []
}

export interface CommissionedAgentSummary extends Agent {
  assigned_user_name: string | null
  assigned_user_email: string | null
  organization_name: string | null
  keys: Array<Pick<AgentKey, 'id' | 'key_prefix' | 'created_at'>>
}

export async function getCommissionedAgents(): Promise<CommissionedAgentSummary[]> {
  const supabase = await createClient()
  const [{ data: agents, error: agentsError }, { data: permissions }, { data: keys }, { data: users }, { data: organizations }] =
    await Promise.all([
      supabase
        .from('agents')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('agent_permissions').select('agent_id, permission'),
      supabase
        .from('agent_keys')
        .select('id, agent_id, key_prefix, created_at')
        .not('agent_id', 'is', null)
        .order('created_at', { ascending: false }),
      supabase.from('users').select('id, name, email'),
      supabase.from('organizations').select('id, name'),
    ])

  if (agentsError) {
    logQueryError('commissioned agents', agentsError)
    return []
  }

  const permissionsByAgent = new Map<string, string[]>()
  for (const permission of permissions ?? []) {
    const existing = permissionsByAgent.get(permission.agent_id) ?? []
    existing.push(permission.permission)
    permissionsByAgent.set(permission.agent_id, existing)
  }

  const keysByAgent = new Map<string, Array<Pick<AgentKey, 'id' | 'key_prefix' | 'created_at'>>>()
  for (const key of keys ?? []) {
    if (!key.agent_id) continue
    const existing = keysByAgent.get(key.agent_id) ?? []
    existing.push({
      id: key.id,
      key_prefix: key.key_prefix,
      created_at: key.created_at,
    })
    keysByAgent.set(key.agent_id, existing)
  }

  const userById = new Map(users?.map((user) => [user.id, user]) ?? [])
  const orgById = new Map(organizations?.map((organization) => [organization.id, organization]) ?? [])

  return (agents ?? []).map((agent) => ({
    ...agent,
    permissions: permissionsByAgent.get(agent.id) ?? [],
    keys: keysByAgent.get(agent.id) ?? [],
    assigned_user_name: userById.get(agent.user_id)?.name ?? null,
    assigned_user_email: userById.get(agent.user_id)?.email ?? null,
    organization_name: orgById.get(agent.organization_id)?.name ?? null,
  }))
}
