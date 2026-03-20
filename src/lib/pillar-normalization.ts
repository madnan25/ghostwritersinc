/**
 * Pillar normalization system (LIN-462)
 *
 * Resolves a dirty pillar string (slug, name, alias, prefixed label) to a
 * canonical content_pillars.id for a given organization.
 *
 * Resolution order:
 *   1. Exact slug match
 *   2. Exact name match (case-insensitive)
 *   3. Alias table lookup (pillar_aliases.alias → target_slug → pillar_id)
 *   4. Strip "P\d+ — " prefix and re-run steps 1-3
 *   5. Partial slug containment
 *   6. No match → return null (caller should set pillar_mapping_status = 'needs_review')
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type NormalizationResult = {
  pillarId: string
  confidence: 'high' | 'medium' | 'low'
  mappingStatus: 'auto' | 'needs_review'
}

/**
 * Normalize a free-form pillar string to a pillar_id for the given user.
 *
 * @param input    Raw pillar value (slug, name, alias, etc.)
 * @param userId   User scope — pillars are user-specific (since LIN-181)
 * @param supabase Admin Supabase client
 * @returns NormalizationResult or null if no match found
 */
export async function normalizePillarInput(
  input: string | null | undefined,
  userId: string,
  supabase: SupabaseClient,
): Promise<NormalizationResult | null> {
  if (!input || !input.trim()) return null

  const clean = input.trim()

  // Fetch all pillars for this user (pillars are user-scoped since LIN-181)
  const { data: pillars, error } = await supabase
    .from('content_pillars')
    .select('id, name, slug')
    .eq('user_id', userId)

  if (error || !pillars || pillars.length === 0) return null

  const result = await resolveAgainstPillars(clean, pillars, supabase)
  if (result) return result

  // Step 4: strip "P\d+ — " prefix (e.g. "P1 — AI Agents") and retry
  const stripped = clean.replace(/^P\d+\s*[—–-]\s*/i, '')
  if (stripped !== clean) {
    const retryResult = await resolveAgainstPillars(stripped, pillars, supabase)
    if (retryResult) return retryResult
  }

  // Step 6: no match
  return null
}

type PillarRow = { id: string; name: string; slug: string }

async function resolveAgainstPillars(
  input: string,
  pillars: PillarRow[],
  supabase: SupabaseClient,
): Promise<NormalizationResult | null> {
  const lower = input.toLowerCase()

  // Step 1: exact slug match
  const slugMatch = pillars.find((p) => p.slug === lower)
  if (slugMatch) {
    return { pillarId: slugMatch.id, confidence: 'high', mappingStatus: 'auto' }
  }

  // Step 2: exact name match (case-insensitive)
  const nameMatch = pillars.find((p) => p.name.toLowerCase() === lower)
  if (nameMatch) {
    return { pillarId: nameMatch.id, confidence: 'high', mappingStatus: 'auto' }
  }

  // Step 3: alias table lookup
  const { data: aliasRow } = await supabase
    .from('pillar_aliases')
    .select('target_slug, confidence')
    .eq('alias', lower)
    .maybeSingle()

  if (aliasRow?.target_slug) {
    const aliasTarget = pillars.find((p) => p.slug === aliasRow.target_slug)
    if (aliasTarget) {
      const confidence = (aliasRow.confidence ?? 'high') as 'high' | 'medium' | 'low'
      return { pillarId: aliasTarget.id, confidence, mappingStatus: 'auto' }
    }
  }

  // Step 5: partial slug containment (lower confidence)
  const partialMatch = pillars.find(
    (p) => p.slug.includes(lower) || lower.includes(p.slug),
  )
  if (partialMatch) {
    return { pillarId: partialMatch.id, confidence: 'low', mappingStatus: 'auto' }
  }

  return null
}
