import { NextRequest, NextResponse } from 'next/server'
import {
  authenticateAgent,
  getAgentRateLimitKey,
  hasAgentPermission,
  isAgentContext,
} from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import {
  MIN_DIFFS_FOR_ANALYSIS,
  getAllDiffs,
  analyzeEditPatterns,
  createObservations,
  getLearnedPreferences,
  getDiffCount,
} from '@/lib/voice-analysis'

/**
 * POST /api/voice-analysis — run voice analysis for the agent's user.
 * Called by the Strategist agent weekly or when 5+ new diffs exist.
 * Analyzes post diffs, detects editing patterns, creates voice observations.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'voice-analysis'), { maxRequests: 5 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'strategy:write')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: strategy:write access required' },
      { status: 403 },
    )
  }

  const supabase = createAdminClient()

  // Fetch all diffs for this user
  const diffs = await getAllDiffs(supabase, auth.organizationId, auth.userId)

  if (diffs.length < MIN_DIFFS_FOR_ANALYSIS) {
    return NextResponse.json({
      message: `Need at least ${MIN_DIFFS_FOR_ANALYSIS} post diffs before analysis can run.`,
      current_diffs: diffs.length,
      required: MIN_DIFFS_FOR_ANALYSIS,
      observations_created: 0,
    })
  }

  // Run pattern analysis
  const result = analyzeEditPatterns(diffs)

  // Persist observations
  const created = await createObservations(
    supabase,
    auth.organizationId,
    auth.userId,
    auth.agentId,
    result.patterns,
  )

  return NextResponse.json({
    message: `Analysis complete. ${created} new observations created.`,
    total_diffs: result.total_diffs,
    no_edit_count: result.no_edit_count,
    minor_edit_count: result.minor_edit_count,
    major_edit_count: result.major_edit_count,
    patterns_detected: result.patterns.length,
    observations_created: created,
  })
}

/**
 * GET /api/voice-analysis — get learned preferences summary for Scribe.
 * Returns the confirmed voice observations as structured preferences text.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = await rateLimit(getAgentRateLimitKey(auth, 'voice-analysis-read'), { maxRequests: 60 })
  if (limited) return limited

  if (!hasAgentPermission(auth.permissions, 'strategy:read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: strategy:read access required' },
      { status: 403 },
    )
  }

  const supabase = createAdminClient()
  const preferences = await getLearnedPreferences(supabase, auth.organizationId, auth.userId)

  // Get diff count without loading full content
  const totalDiffs = await getDiffCount(supabase, auth.organizationId, auth.userId)

  return NextResponse.json({
    learned_preferences: preferences,
    total_diffs: totalDiffs,
    analysis_ready: totalDiffs >= MIN_DIFFS_FOR_ANALYSIS,
  })
}
