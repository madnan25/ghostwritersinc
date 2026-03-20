import { getAllPosts, getPillars } from '@/lib/queries/posts'
import { computeRotationWarnings } from '@/lib/post-display'
import { getDashboardMetrics, getDashboardNarrative } from '@/lib/dashboard-ui'
import { processDuePosts } from '@/lib/publish-scheduled'
import { ScheduleHealthPanels } from '@/components/schedule-health-panels'
import { DashboardHero } from './_components/dashboard-hero'
import { DashboardViewContainer } from './_components/dashboard-view-container'
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
    <div className="premium-page space-y-8 sm:space-y-10">
      <DashboardHero metrics={metrics} narrative={narrative} />

      <ScheduleHealthPanels warnings={rotationWarnings} />

      <DashboardViewContainer posts={posts} pillars={pillars} />

      <AgentActivityFeed />
    </div>
  )
}
