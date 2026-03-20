import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createAdminClient } from './supabase/admin'
import { rateLimit } from './rate-limit'
import { resolveAgentScopeMode } from './agent-context-sharing'
import { DEFAULT_AGENT_PERMISSIONS } from './agent-permissions'
export { DEFAULT_AGENT_PERMISSIONS } from './agent-permissions'

const { compare } = bcrypt
const AGENT_KEY_PREFIX = 'gw_agent_'
const LEGACY_KEY_PREFIX_LENGTH = 8
const KEY_LOOKUP_HEX_LENGTH = 16
const BCRYPT_ROUNDS = 12

const CAPABILITY_TO_PERMISSIONS: Record<string, string[]> = {
  read: [
    'posts:read',
    'drafts:read',
    'comments:read',
    'reviews:read',
    'pillars:read',
    'research:read',
    'strategy:read',
    'briefs:read',
    'series:read',
  ],
  write: [
    'posts:write',
    'drafts:write',
    'comments:write',
    'pillars:write',
    'research:write',
    'strategy:write',
    'briefs:write',
    'series:write',
  ],
  review: ['reviews:write'],
}

function getKeyLookupPrefix(apiKey: string): string {
  const randomHexStart = AGENT_KEY_PREFIX.length
  const randomHexEnd = randomHexStart + KEY_LOOKUP_HEX_LENGTH
  return `${AGENT_KEY_PREFIX}${apiKey.slice(randomHexStart, randomHexEnd)}`
}

function getLegacyKeyPrefix(apiKey: string): string {
  return apiKey.slice(0, LEGACY_KEY_PREFIX_LENGTH)
}

/** Generate a random agent API key. Format: gw_agent_<32 random hex chars> */
export function generateAgentKey(): string {
  return `${AGENT_KEY_PREFIX}${randomBytes(32).toString('hex')}`
}

export function getAgentKeyPrefix(plainKey: string): string {
  return getKeyLookupPrefix(plainKey)
}

/** Hash an agent API key for storage. */
export async function hashAgentKey(plainKey: string): Promise<string> {
  return bcrypt.hash(plainKey, BCRYPT_ROUNDS)
}

export interface AgentContext {
  keyId?: string
  keyPrefix?: string
  agentId: string
  agentName: string
  agentSlug: string
  agentType: string
  provider: string
  status: string
  organizationId: string
  userId: string
  permissions: string[]
  allowSharedContext: boolean
  scopeMode: 'user' | 'shared_org'
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
  if (!apiKey.startsWith(AGENT_KEY_PREFIX)) {
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 401 }
    )
  }

  const prefixes = Array.from(
    new Set([getKeyLookupPrefix(apiKey), getLegacyKeyPrefix(apiKey)])
  )
  const supabase = createAdminClient()

  const { data: candidates, error } = await supabase
    .from('agent_keys')
    .select(
      'id, agent_id, agent_name, organization_id, user_id, permissions, api_key_hash, key_prefix, allow_shared_context'
    )
    .in('key_prefix', prefixes)

  if (error || !candidates || candidates.length === 0) {
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 401 }
    )
  }

  // Rate-limit agent auth attempts before expensive bcrypt comparisons
  const authRateLimitKey = `agent-auth:${prefixes[0]}`
  const rateLimited = await rateLimit(authRateLimitKey, {
    maxRequests: 20,
    windowMs: 60_000,
  })
  if (rateLimited) return rateLimited

  for (const candidate of candidates) {
    const match = await compare(apiKey, candidate.api_key_hash)
    if (match) {
      const fallbackAgentType =
        typeof candidate.agent_name === 'string' && candidate.agent_name in DEFAULT_AGENT_PERMISSIONS
          ? candidate.agent_name
          : 'custom'

      const { data: agent, error: agentError } = candidate.agent_id
        ? await supabase
            .from('agents')
            .select(
              'id, name, slug, provider, agent_type, status, organization_id, user_id, allow_shared_context, last_used_at'
            )
            .eq('id', candidate.agent_id)
            .maybeSingle()
        : {
            data: {
              id: `legacy-${candidate.id}`,
              name: candidate.agent_name,
              slug: candidate.agent_name,
              provider: 'ghostwriters',
              agent_type: fallbackAgentType,
              status: 'active',
              organization_id: candidate.organization_id,
              user_id: candidate.user_id,
              allow_shared_context: candidate.allow_shared_context === true,
            },
            error: null,
          }

      if (agentError || !agent) {
        return NextResponse.json(
          { error: 'Agent identity could not be resolved for this key' },
          { status: 403 }
        )
      }

      if (!agent.user_id) {
        return NextResponse.json(
          { error: 'Agent key must be reassigned by a platform admin' },
          { status: 403 }
        )
      }

      if (agent.status !== 'active') {
        return NextResponse.json(
          { error: 'This commissioned agent is not active' },
          { status: 403 }
        )
      }

      const { data: permissionRows, error: permissionError } =
        candidate.agent_id
          ? await supabase
              .from('agent_permissions')
              .select('permission')
              .eq('agent_id', candidate.agent_id)
          : {
              data: (candidate.permissions ?? []).map((permission: string) => ({ permission })),
              error: null,
            }

      if (permissionError) {
        return NextResponse.json(
          { error: 'Failed to resolve agent permissions' },
          { status: 500 }
        )
      }

      const { data: organization, error: orgError } = await supabase
        .from('organizations')
        .select('context_sharing_enabled')
        .eq('id', agent.organization_id)
        .maybeSingle()

      if (orgError) {
        return NextResponse.json(
          { error: 'Failed to resolve agent scope' },
          { status: 500 }
        )
      }

      const permissions =
        permissionRows?.map((row: { permission: string }) => row.permission).filter(Boolean) ??
        candidate.permissions ??
        []
      const allowSharedContext = agent.allow_shared_context === true
      const scopeMode = resolveAgentScopeMode({
        allowSharedContext,
        organizationContextSharingEnabled: organization?.context_sharing_enabled === true,
      })

      if (candidate.agent_id) {
        void supabase
          .from('agents')
          .update({
            last_used_at: new Date().toISOString(),
            last_used_by_route: request.nextUrl.pathname,
          })
          .eq('id', candidate.agent_id)
      }

      return {
        keyId: candidate.id,
        keyPrefix: candidate.key_prefix,
        agentId: agent.id,
        agentName: agent.name,
        agentSlug: agent.slug,
        agentType: agent.agent_type,
        provider: agent.provider,
        status: agent.status,
        organizationId: agent.organization_id,
        userId: agent.user_id,
        permissions,
        allowSharedContext,
        scopeMode,
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

export function hasAgentPermission(
  permissions: string[],
  requiredPermission: string
): boolean {
  if (permissions.includes(requiredPermission)) {
    return true
  }

  const mappedPermissions = CAPABILITY_TO_PERMISSIONS[requiredPermission]
  if (mappedPermissions) {
    return mappedPermissions.some((permission) => permissions.includes(permission))
  }

  const broadCapability = Object.entries(CAPABILITY_TO_PERMISSIONS).find(([, granularPermissions]) =>
    granularPermissions.includes(requiredPermission)
  )?.[0]

  if (broadCapability && permissions.includes(broadCapability)) {
    return true
  }

  return Object.entries(CAPABILITY_TO_PERMISSIONS).some(
    ([capability, granularPermissions]) =>
      permissions.includes(capability) &&
      granularPermissions.includes(requiredPermission)
  )
}

export function getAgentRateLimitKey(
  auth: AgentContext,
  capability: string
): string {
  const identity = auth.keyId ?? auth.keyPrefix ?? `${auth.agentName}:${auth.userId}`
  return `${capability}:${auth.organizationId}:${auth.userId}:${identity}`
}

export function isSharedOrgAgentContext(auth: AgentContext): boolean {
  return auth.scopeMode === 'shared_org'
}

export function canAccessAgentUserRecord(
  auth: AgentContext,
  record: { organization_id: string; user_id: string | null }
): boolean {
  return (
    record.organization_id === auth.organizationId &&
    (auth.scopeMode === 'shared_org' || record.user_id === auth.userId)
  )
}

export function canAccessAgentOrgRecord(
  auth: AgentContext,
  record: { organization_id: string }
): boolean {
  return record.organization_id === auth.organizationId
}

export function requireSharedOrgAgentContext(
  auth: AgentContext
): NextResponse | null {
  if (isSharedOrgAgentContext(auth)) {
    return null
  }

  return NextResponse.json(
    { error: 'Shared org context requires both agent sharing and the organization Agent context sharing toggle.' },
    { status: 403 }
  )
}
