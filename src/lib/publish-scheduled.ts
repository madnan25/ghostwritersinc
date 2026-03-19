import { createAdminClient } from '@/lib/supabase/admin'
import { getValidAccessToken } from '@/lib/linkedin-tokens'
import type { Post } from '@/lib/types'

const LINKEDIN_DAILY_LIMIT = 100
const MAX_POSTS_PER_RUN = 10

/**
 * Process any scheduled posts that are due for publishing.
 * Safe to call from anywhere server-side (cron, dashboard load, etc.).
 * Returns summary of what was processed.
 */
export async function processDuePosts(): Promise<{
  processed: number
  published: number
  failed: number
}> {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // Check daily publish count for rate limiting
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const { count: dailyCount } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published')
    .gte('published_at', todayStart.toISOString())

  if ((dailyCount ?? 0) >= LINKEDIN_DAILY_LIMIT) {
    return { processed: 0, published: 0, failed: 0 }
  }

  const remainingQuota = LINKEDIN_DAILY_LIMIT - (dailyCount ?? 0)
  const batchSize = Math.min(MAX_POSTS_PER_RUN, remainingQuota)

  // Fetch due posts
  const { data: duePosts, error: queryError } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_publish_at', now)
    .order('scheduled_publish_at', { ascending: true })
    .limit(batchSize)

  if (queryError || !duePosts?.length) {
    return { processed: 0, published: 0, failed: 0 }
  }

  const posts = duePosts as Post[]
  let published = 0
  let failed = 0

  for (const post of posts) {
    try {
      const accessToken = await getValidAccessToken(post.user_id, post.organization_id)

      if (!accessToken) {
        await markPublishFailed(supabase, post, 'No valid LinkedIn access token. Please reconnect LinkedIn in settings.')
        failed++
        continue
      }

      const { data: tokenRow } = await supabase
        .from('linkedin_tokens')
        .select('linkedin_member_id')
        .eq('user_id', post.user_id)
        .eq('organization_id', post.organization_id)
        .is('disconnected_at', null)
        .maybeSingle()

      if (!tokenRow?.linkedin_member_id) {
        await markPublishFailed(supabase, post, 'LinkedIn member ID not found. Please reconnect LinkedIn.')
        failed++
        continue
      }

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
        await markPublishFailed(supabase, post, `LinkedIn API error: ${linkedinResponse.status} ${errorBody}`)
        failed++
        continue
      }

      const linkedinData = await linkedinResponse.json()
      const postUrn = linkedinData.id ?? null

      await supabase
        .from('posts')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          linkedin_post_urn: postUrn,
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id)

      published++
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      await markPublishFailed(supabase, post, `Unexpected error: ${errorMsg}`)
      failed++
    }
  }

  console.log(`[publish] Processed ${posts.length} posts: ${published} published, ${failed} failed`)

  return { processed: posts.length, published, failed }
}

async function markPublishFailed(
  supabase: ReturnType<typeof createAdminClient>,
  post: Post,
  errorMessage: string
): Promise<void> {
  await supabase
    .from('posts')
    .update({
      status: 'publish_failed',
      rejection_reason: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', post.id)

  await supabase.from('notifications').insert({
    organization_id: post.organization_id,
    user_id: post.user_id,
    type: 'publish_failed',
    title: 'Post publishing failed',
    body: errorMessage,
    post_id: post.id,
  })
}
