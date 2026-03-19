import { createAdminClient } from '@/lib/supabase/admin'
import type { AgentActionType } from '@/lib/types'

const MAX_PROVIDER_STRING_LENGTH = 128

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

function derivePostTitle(content: string | null | undefined): string | null {
  if (!content) return null

  const firstLine = content
    .split('\n')
    .map((line) => line.trim().replace(/^[-*#>\s]+/, ''))
    .find(Boolean)

  return firstLine ? firstLine.slice(0, 120) : null
}

function sanitizeProviderMetadata(meta?: ProviderMetadata): Record<string, unknown> {
  if (!meta) return {}
  const sanitized: Record<string, unknown> = {}
  if (meta.provider_run_id) {
    sanitized.provider_run_id = meta.provider_run_id.slice(0, MAX_PROVIDER_STRING_LENGTH)
  }
  if (meta.provider_session_key) {
    sanitized.provider_session_key = meta.provider_session_key.slice(0, MAX_PROVIDER_STRING_LENGTH)
  }
  if (meta.duration_ms != null) {
    sanitized.duration_ms = meta.duration_ms
  }
  return sanitized
}

/**
 * Fire-and-forget insert into agent_activity_log.
 * Never throws — failures are logged to stderr only.
 */
export function logAgentActivity(params: LogActivityParams): void {
  const adminClient = createAdminClient()
  void Promise.all([
    adminClient
      .from('agents')
      .select('name')
      .eq('id', params.agentId)
      .eq('organization_id', params.organizationId)
      .maybeSingle(),
    params.postId
      ? adminClient
          .from('posts')
          .select('content')
          .eq('id', params.postId)
          .eq('organization_id', params.organizationId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
    .then(([agentResult, postResult]) =>
      adminClient
        .from('agent_activity_log')
        .insert({
          organization_id: params.organizationId,
          agent_id: params.agentId,
          post_id: params.postId ?? null,
          action_type: params.actionType,
          metadata: {
            ...(params.metadata ?? {}),
            ...sanitizeProviderMetadata(params.providerMetadata),
            ...(agentResult.data?.name ? { agent_name: agentResult.data.name } : {}),
            ...(derivePostTitle(postResult.data?.content) ? { post_title: derivePostTitle(postResult.data?.content) } : {}),
          },
        })
    )
    .then(({ error }) => {
      if (error) {
        console.error('[agent-activity] Failed to log activity:', error)
      }
    })
}
