import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createAdminClient } from './supabase/admin'

const { compare } = bcrypt
const AGENT_KEY_PREFIX = 'gw_agent_'
const LEGACY_KEY_PREFIX_LENGTH = 8
const KEY_LOOKUP_HEX_LENGTH = 16
const BCRYPT_ROUNDS = 12

const CAPABILITY_TO_PERMISSIONS: Record<string, string[]> = {
  read: ['posts:read', 'pillars:read', 'comments:read', 'reviews:read'],
  write: ['posts:write', 'pillars:write', 'comments:write'],
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

/** Default permissions per agent type */
export const DEFAULT_AGENT_PERMISSIONS: Record<string, string[]> = {
  scribe: ['posts:read', 'posts:write', 'comments:read', 'comments:write'],
  strategist: ['posts:read', 'pillars:read', 'pillars:write', 'comments:read'],
  inspector: ['posts:read', 'reviews:read', 'reviews:write', 'comments:read'],
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
    .select('id, agent_name, organization_id, permissions, api_key_hash, key_prefix')
    .in('key_prefix', prefixes)

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
        keyId: candidate.id,
        keyPrefix: candidate.key_prefix,
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

  return Object.entries(CAPABILITY_TO_PERMISSIONS).some(
    ([capability, granularPermissions]) =>
      permissions.includes(capability) &&
      granularPermissions.includes(requiredPermission)
  )
}

export function getAgentRateLimitKey(
  auth: AgentContext,
  capability: 'read' | 'write' | 'review'
): string {
  const identity = auth.keyId ?? auth.keyPrefix ?? auth.agentName
  return `${capability}:${auth.organizationId}:${identity}`
}
