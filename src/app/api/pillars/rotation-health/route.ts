import { NextRequest, NextResponse } from 'next/server'
import { authenticateAgent, isAgentContext } from '@/lib/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

/** GET /api/pillars/rotation-health — check for consecutive same-pillar runs */
export async function GET(request: NextRequest) {
  const auth = await authenticateAgent(request)
  if (!isAgentContext(auth)) return auth

  const limited = rateLimit(`read:${auth.agentName}`, { maxRequests: 60 })
  if (limited) return limited

  if (!auth.permissions.includes('read')) {
    return NextResponse.json(
      { error: 'Insufficient permissions: read access required' },
      { status: 403 }
    )
  }

  const supabase = createAdminClient()

  // Get last 10 posts ordered by suggested publish date
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, pillar_id, pillar, suggested_publish_at, content_pillars(name, slug, color)')
    .eq('organization_id', auth.organizationId)
    .not('suggested_publish_at', 'is', null)
    .order('suggested_publish_at', { ascending: false })
    .limit(10)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Detect runs of >2 consecutive same-pillar posts
  const warnings: Array<{
    pillar_id: string
    pillar_name: string
    run_length: number
    post_ids: string[]
    suggestion: string
  }> = []

  if (posts.length >= 3) {
    // Reverse to chronological order for run detection
    const ordered = [...posts].reverse()
    let currentPillar: string | null = null
    let runPosts: string[] = []

    for (const post of ordered) {
      if (post.pillar_id === currentPillar && currentPillar !== null) {
        runPosts.push(post.id)
      } else {
        // Check if previous run was too long
        if (runPosts.length > 2 && currentPillar) {
          const pillarData = ordered.find((p) => p.pillar_id === currentPillar)
          const pillarInfo = pillarData?.content_pillars as unknown as { name: string; slug: string; color: string } | null
          warnings.push({
            pillar_id: currentPillar,
            pillar_name: pillarInfo?.name ?? 'Unknown',
            run_length: runPosts.length,
            post_ids: [...runPosts],
            suggestion: `${runPosts.length} consecutive "${pillarInfo?.name ?? 'Unknown'}" posts detected. Mix in content from other pillars to maintain variety.`,
          })
        }
        currentPillar = post.pillar_id
        runPosts = [post.id]
      }
    }

    // Check final run
    if (runPosts.length > 2 && currentPillar) {
      const pillarData = ordered.find((p) => p.pillar_id === currentPillar)
      const pillarInfo = pillarData?.content_pillars as unknown as { name: string; slug: string; color: string } | null
      warnings.push({
        pillar_id: currentPillar,
        pillar_name: pillarInfo?.name ?? 'Unknown',
        run_length: runPosts.length,
        post_ids: [...runPosts],
        suggestion: `${runPosts.length} consecutive "${pillarInfo?.name ?? 'Unknown'}" posts detected. Mix in content from other pillars to maintain variety.`,
      })
    }
  }

  return NextResponse.json({
    recent_posts: posts,
    warnings,
    healthy: warnings.length === 0,
  })
}
