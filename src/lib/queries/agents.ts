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

/** Review events for the given commissioned agents (by agent_id or agent_name/slug/id). Merges two queries so we are not limited to the N most recent rows globally. */
export async function getReviewEventsForCommissionedAgents(
  agents: Array<Pick<Agent, 'id' | 'name' | 'slug'>>,
  perQueryLimit = 300,
): Promise<ReviewEvent[]> {
  if (agents.length === 0) return []
  const supabase = await createClient()
  const agentIds = agents.map((a) => a.id)
  const nameKeys = [...new Set(agents.flatMap((a) => [a.name, a.slug, a.id]))]

  const [{ data: byAgentId, error: errId }, { data: byName, error: errName }] = await Promise.all([
    supabase
      .from('review_events')
      .select('*')
      .in('agent_id', agentIds)
      .order('created_at', { ascending: false })
      .limit(perQueryLimit),
    supabase
      .from('review_events')
      .select('*')
      .in('agent_name', nameKeys)
      .order('created_at', { ascending: false })
      .limit(perQueryLimit),
  ])

  if (errId) logQueryError('review_events by agent_id', errId)
  if (errName) logQueryError('review_events by agent_name', errName)

  const seen = new Set<string>()
  const merged: ReviewEvent[] = []
  for (const row of [...(byAgentId ?? []), ...(byName ?? [])]) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    merged.push(row)
  }
  return merged
}

export function groupReviewEventsByCommissionedAgents(
  agents: Array<Pick<Agent, 'id' | 'name' | 'slug'>>,
  events: ReviewEvent[],
  perAgentLimit = 5,
): Record<string, ReviewEvent[]> {
  const byAgentId: Record<string, ReviewEvent[]> = Object.fromEntries(
    agents.map((a) => [a.id, [] as ReviewEvent[]]),
  )

  const byLowerName = new Map<string, (typeof agents)[number]>()
  for (const a of agents) {
    byLowerName.set(a.name.toLowerCase(), a)
    if (a.slug.toLowerCase() !== a.name.toLowerCase()) {
      byLowerName.set(a.slug.toLowerCase(), a)
    }
  }

  for (const e of events) {
    let agent: (typeof agents)[number] | undefined
    if (e.agent_id) {
      agent = agents.find((a) => a.id === e.agent_id)
    }
    if (!agent) {
      agent = byLowerName.get(e.agent_name.toLowerCase()) ?? agents.find((a) => a.id === e.agent_name)
    }
    if (agent) {
      byAgentId[agent.id].push(e)
    }
  }

  for (const a of agents) {
    byAgentId[a.id].sort(
      (x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime(),
    )
    byAgentId[a.id] = byAgentId[a.id].slice(0, perAgentLimit)
  }

  return byAgentId
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
