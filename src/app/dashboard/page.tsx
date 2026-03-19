import { getAllPosts, getPillars } from '@/lib/queries/posts'
import { computeRotationWarnings } from '@/lib/post-display'
import { getDashboardMetrics, getDashboardNarrative } from '@/lib/dashboard-ui'
import { processDuePosts } from '@/lib/publish-scheduled'
import { DashboardHero } from './_components/dashboard-hero'
import { PostGrid } from './_components/post-grid'
import { AgentActivityFeed } from './_components/agent-activity-feed'

export default async function DashboardPage() {
  // Auth + onboarding handled by middleware
  // Fire-and-forget: publish any scheduled posts that are due
  processDuePosts().catch(() => {})

  const [posts, pillars] = await Promise.all([getAllPosts(), getPillars()])
  const metrics = getDashboardMetrics(posts)
  const narrative = getDashboardNarrative(metrics)
  const rotationWarnings = computeRotationWarnings(posts, pillars)

  return (
    <div className="premium-page">
      <DashboardHero metrics={metrics} narrative={narrative} />

      <PostGrid posts={posts} pillars={pillars} rotationWarnings={rotationWarnings} />

      <AgentActivityFeed />
    </div>
  )
}
