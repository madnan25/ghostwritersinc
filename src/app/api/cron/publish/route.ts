import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidAccessToken } from '@/lib/linkedin-tokens'
import type { Post } from '@/lib/types'

/** LinkedIn API daily limit */
const LINKEDIN_DAILY_LIMIT = 100
/** Maximum posts to process per cron run */
const MAX_POSTS_PER_RUN = 10

/**
 * POST /api/cron/publish — process scheduled posts due for publishing.
 *
 * Triggered by external cron (Vercel Cron, pg_cron, or manual).
 * Protected by CRON_SECRET header.
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // 1. Check daily publish count for rate limiting
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const { count: dailyCount } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published')
    .gte('published_at', todayStart.toISOString())

  if ((dailyCount ?? 0) >= LINKEDIN_DAILY_LIMIT) {
    return NextResponse.json({
      message: 'Daily LinkedIn publish limit reached',
      daily_count: dailyCount,
      limit: LINKEDIN_DAILY_LIMIT,
    })
  }

  const remainingQuota = LINKEDIN_DAILY_LIMIT - (dailyCount ?? 0)
  const batchSize = Math.min(MAX_POSTS_PER_RUN, remainingQuota)

  // 2. Fetch due posts
  const { data: duePosts, error: queryError } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_publish_at', now)
    .order('scheduled_publish_at', { ascending: true })
    .limit(batchSize)

  if (queryError) {
    console.error('[cron/publish] Error querying due posts:', queryError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const posts = (duePosts ?? []) as Post[]
  if (posts.length === 0) {
    return NextResponse.json({ message: 'No posts due for publishing', processed: 0 })
  }

  // 3. Process each post
  const results: Array<{ post_id: string; status: 'published' | 'publish_failed'; error?: string }> = []

  for (const post of posts) {
    try {
      // Get a valid LinkedIn access token for the post owner
      const accessToken = await getValidAccessToken(post.user_id, post.organization_id)

      if (!accessToken) {
        // No valid token — mark as failed
        await markPublishFailed(supabase, post.id, post.organization_id, post.user_id,
          'No valid LinkedIn access token. Please reconnect LinkedIn in settings.')
        results.push({ post_id: post.id, status: 'publish_failed', error: 'No valid token' })
        continue
      }

      // Get the user's LinkedIn member URN
      const { data: tokenRow } = await supabase
        .from('linkedin_tokens')
        .select('linkedin_member_id')
        .eq('user_id', post.user_id)
        .eq('organization_id', post.organization_id)
        .is('disconnected_at', null)
        .maybeSingle()

      if (!tokenRow?.linkedin_member_id) {
        await markPublishFailed(supabase, post.id, post.organization_id, post.user_id,
          'LinkedIn member ID not found. Please reconnect LinkedIn.')
        results.push({ post_id: post.id, status: 'publish_failed', error: 'No member ID' })
        continue
      }

      // Post to LinkedIn UGC API
      const linkedinResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          author: `urn:li:person:${tokenRow.linkedin_member_id}`,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: { text: post.content },
              shareMediaCategory: 'NONE',
            },
          },
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
          },
        }),
      })

      if (!linkedinResponse.ok) {
        const errorBody = await linkedinResponse.text()
        await markPublishFailed(supabase, post.id, post.organization_id, post.user_id,
          `LinkedIn API error: ${linkedinResponse.status} ${errorBody}`)
        results.push({ post_id: post.id, status: 'publish_failed', error: errorBody })
        continue
      }

      // Extract post URN from response
      const linkedinData = await linkedinResponse.json()
      const postUrn = linkedinData.id ?? null

      // Mark as published
      await supabase
        .from('posts')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          linkedin_post_urn: postUrn,
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id)

      results.push({ post_id: post.id, status: 'published' })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      await markPublishFailed(supabase, post.id, post.organization_id, post.user_id,
        `Unexpected error: ${errorMsg}`)
      results.push({ post_id: post.id, status: 'publish_failed', error: errorMsg })
    }
  }

  // 4. Log cron run
  const published = results.filter((r) => r.status === 'published').length
  const failed = results.filter((r) => r.status === 'publish_failed').length

  console.log(`[cron/publish] Processed ${results.length} posts: ${published} published, ${failed} failed`)

  return NextResponse.json({
    processed: results.length,
    published,
    failed,
    daily_count: (dailyCount ?? 0) + published,
    results,
  })
}

async function markPublishFailed(
  supabase: ReturnType<typeof createAdminClient>,
  postId: string,
  organizationId: string,
  userId: string,
  errorMessage: string
): Promise<void> {
  // Update post status
  await supabase
    .from('posts')
    .update({
      status: 'publish_failed',
      rejection_reason: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)

  // Send notification
  await supabase.from('notifications').insert({
    organization_id: organizationId,
    user_id: userId,
    type: 'publish_failed',
    title: 'Post publishing failed',
    body: errorMessage,
    post_id: postId,
  })
}
