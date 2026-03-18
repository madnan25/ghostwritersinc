import { createAdminClient } from '@/lib/supabase/admin'
import type { AgentActionType } from '@/lib/types'

interface ProviderMetadata {
  provider_run_id?: string
  provider_session_key?: string
  duration_ms?: number
}

interface LogActivityParams {
  organizationId: string
  agentId: string
  postId?: string | null
  actionType: AgentActionType
  metadata?: Record<string, unknown>
  providerMetadata?: ProviderMetadata
}

/**
 * Fire-and-forget insert into agent_activity_log.
 * Never throws — failures are logged to stderr only.
 */
const adminClient = createAdminClient()

export function logAgentActivity(params: LogActivityParams): void {
  void adminClient
    .from('agent_activity_log')
    .insert({
      organization_id: params.organizationId,
      agent_id: params.agentId,
      post_id: params.postId ?? null,
      action_type: params.actionType,
      metadata: { ...(params.metadata ?? {}), ...(params.providerMetadata ?? {}) },
    })
    .then(({ error }) => {
      if (error) {
        console.error('[agent-activity] Failed to log activity:', error)
      }
    })
}
