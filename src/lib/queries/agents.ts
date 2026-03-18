import { createClient } from '@/lib/supabase/server'
import { logQueryError } from '@/lib/queries/errors'
import type { AgentKey, ReviewEvent } from '@/lib/types'

export async function getAgentKeys(): Promise<AgentKey[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agent_keys')
    .select('id, organization_id, agent_name, key_prefix, permissions, created_at')
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
