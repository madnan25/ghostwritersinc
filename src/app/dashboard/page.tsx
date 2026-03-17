import { getAllPosts, getPillars } from '@/lib/queries/posts'
import { PostGrid } from './_components/post-grid'
import type { ContentPillar, Post } from '@/lib/types'

export type RotationWarning = {
  pillar_id: string
  pillar_name: string
  run_length: number
  suggestion: string
}

function computeRotationWarnings(posts: Post[], pillars: ContentPillar[]): RotationWarning[] {
  const ordered = posts
    .filter((p) => p.pillar_id && p.suggested_publish_at)
    .sort((a, b) => new Date(a.suggested_publish_at!).getTime() - new Date(b.suggested_publish_at!).getTime())

  const warnings: RotationWarning[] = []
  let currentPillar: string | null = null
  let runPosts: string[] = []

  for (const post of ordered) {
    if (post.pillar_id === currentPillar && currentPillar !== null) {
      runPosts.push(post.id)
    } else {
      if (runPosts.length > 2 && currentPillar) {
        const pillar = pillars.find((p) => p.id === currentPillar)
        warnings.push({
          pillar_id: currentPillar,
          pillar_name: pillar?.name ?? 'Unknown',
          run_length: runPosts.length,
          suggestion: `${runPosts.length} consecutive "${pillar?.name ?? 'Unknown'}" posts queued. Mix in other pillars for better variety.`,
        })
      }
      currentPillar = post.pillar_id
      runPosts = [post.id]
    }
  }

  if (runPosts.length > 2 && currentPillar) {
    const pillar = pillars.find((p) => p.id === currentPillar)
    warnings.push({
      pillar_id: currentPillar,
      pillar_name: pillar?.name ?? 'Unknown',
      run_length: runPosts.length,
      suggestion: `${runPosts.length} consecutive "${pillar?.name ?? 'Unknown'}" posts queued. Mix in other pillars for better variety.`,
    })
  }

  return warnings
}

export default async function DashboardPage() {
  // Auth + onboarding handled by middleware
  const [posts, pillars] = await Promise.all([getAllPosts(), getPillars()])
  const needsReview = posts.filter((p) => p.status === 'pending_review' || p.status === 'agent_review').length
  const rotationWarnings = computeRotationWarnings(posts, pillars)

  return (
    <div className="container px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Content Queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {posts.length === 0
            ? 'No posts yet — your agents are working on the next batch'
            : needsReview > 0
              ? `${needsReview} post${needsReview !== 1 ? 's' : ''} need${needsReview === 1 ? 's' : ''} your review`
              : `${posts.length} post${posts.length !== 1 ? 's' : ''} total — all caught up`}
        </p>
      </div>

      <PostGrid posts={posts} pillars={pillars} rotationWarnings={rotationWarnings} />
    </div>
  )
}
