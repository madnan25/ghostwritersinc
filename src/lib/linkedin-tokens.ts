import crypto from 'crypto'

// LinkedIn OAuth 2.0 token endpoints
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'

// ---------------------------------------------------------------------------
// Token encryption (AES-256-GCM)
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY
  if (!key) {
    throw new Error('Missing LINKEDIN_TOKEN_ENCRYPTION_KEY env var')
  }
  return Buffer.from(key, 'hex')
}

/**
 * Encrypt a plaintext token. Returns base64-encoded ciphertext (iv + tag + encrypted).
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

/**
 * Decrypt a base64-encoded ciphertext back to plaintext.
 */
export function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey()
  const data = Buffer.from(ciphertext, 'base64')

  const iv = data.subarray(0, IV_LENGTH)
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8')
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

export interface LinkedInTokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  refresh_token_expires_in?: number
  scope: string
  token_type: string
}

/**
 * Refresh an expired LinkedIn access token.
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<LinkedInTokenResponse> {
  const clientId = process.env.LINKEDIN_CLIENT_ID
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET')
  }

  const response = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`LinkedIn token refresh failed: ${response.status} ${error}`)
  }

  return response.json()
}

// ---------------------------------------------------------------------------
// Token storage helpers
// ---------------------------------------------------------------------------

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Store encrypted OAuth tokens for a user after successful LinkedIn login.
 */
export async function storeTokens(
  userId: string,
  organizationId: string,
  tokens: LinkedInTokenResponse,
  linkedinMemberId?: string | null
): Promise<void> {
  const supabase = createAdminClient()

  const now = new Date()
  const expiresAt = new Date(now.getTime() + tokens.expires_in * 1000)
  const refreshExpiresAt = tokens.refresh_token_expires_in
    ? new Date(now.getTime() + tokens.refresh_token_expires_in * 1000)
    : null

  await supabase.from('linkedin_tokens').upsert(
    {
      user_id: userId,
      organization_id: organizationId,
      encrypted_access_token: encryptToken(tokens.access_token),
      encrypted_refresh_token: tokens.refresh_token
        ? encryptToken(tokens.refresh_token)
        : null,
      token_type: tokens.token_type || 'Bearer',
      expires_at: expiresAt.toISOString(),
      refresh_expires_at: refreshExpiresAt?.toISOString() ?? null,
      scopes: tokens.scope.split(' '),
      linkedin_member_id: linkedinMemberId ?? null,
      connected_at: now.toISOString(),
      disconnected_at: null,
      last_refreshed_at: null,
      updated_at: now.toISOString(),
    },
    { onConflict: 'user_id,organization_id' }
  )
}

/**
 * Get a valid access token for a user, auto-refreshing if needed.
 * Returns null if user is not connected or refresh fails.
 */
export async function getValidAccessToken(
  userId: string,
  organizationId: string
): Promise<string | null> {
  const supabase = createAdminClient()

  const { data: tokenRow } = await supabase
    .from('linkedin_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .is('disconnected_at', null)
    .maybeSingle()

  if (!tokenRow) return null

  const now = new Date()
  const expiresAt = new Date(tokenRow.expires_at)

  // Token still valid (with 5-minute buffer)
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    // Update last_used_at
    await supabase
      .from('linkedin_tokens')
      .update({ last_used_at: now.toISOString() })
      .eq('id', tokenRow.id)

    return decryptToken(tokenRow.encrypted_access_token)
  }

  // Token expired — try to refresh
  if (!tokenRow.encrypted_refresh_token) return null

  try {
    const refreshToken = decryptToken(tokenRow.encrypted_refresh_token)
    const newTokens = await refreshAccessToken(refreshToken)

    const newExpiresAt = new Date(now.getTime() + newTokens.expires_in * 1000)

    await supabase
      .from('linkedin_tokens')
      .update({
        encrypted_access_token: encryptToken(newTokens.access_token),
        encrypted_refresh_token: newTokens.refresh_token
          ? encryptToken(newTokens.refresh_token)
          : tokenRow.encrypted_refresh_token,
        expires_at: newExpiresAt.toISOString(),
        last_refreshed_at: now.toISOString(),
        last_used_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', tokenRow.id)

    return newTokens.access_token
  } catch (err) {
    console.error('[linkedin-tokens] Refresh failed:', err)
    return null
  }
}

/**
 * Disconnect a user's LinkedIn connection.
 */
export async function disconnectLinkedIn(
  userId: string,
  organizationId: string
): Promise<void> {
  const supabase = createAdminClient()

  await supabase
    .from('linkedin_tokens')
    .update({
      disconnected_at: new Date().toISOString(),
      encrypted_access_token: '',
      encrypted_refresh_token: null,
    })
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
}

/**
 * Get connection status for a user (without exposing tokens).
 */
export async function getConnectionStatus(
  userId: string,
  organizationId: string
): Promise<{
  connected: boolean
  linkedinMemberId: string | null
  connectedAt: string | null
  expiresAt: string | null
} | null> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('linkedin_tokens')
    .select('linkedin_member_id, connected_at, expires_at, disconnected_at')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!data) return null

  return {
    connected: !data.disconnected_at,
    linkedinMemberId: data.linkedin_member_id,
    connectedAt: data.connected_at,
    expiresAt: data.expires_at,
  }
}
