import { getAllPosts, getPillars } from '@/lib/queries/posts'
import { computeRotationWarnings } from '@/lib/post-display'
import { getDashboardMetrics, getDashboardNarrative } from '@/lib/dashboard-ui'
import { DashboardHero } from './_components/dashboard-hero'
import { PostGrid } from './_components/post-grid'

export default async function DashboardPage() {
  // Auth + onboarding handled by middleware
  const [posts, pillars] = await Promise.all([getAllPosts(), getPillars()])
  const metrics = getDashboardMetrics(posts)
  const narrative = getDashboardNarrative(metrics)
  const rotationWarnings = computeRotationWarnings(posts, pillars)

  return (
    <div className="premium-page">
      <DashboardHero metrics={metrics} narrative={narrative} />

      <PostGrid posts={posts} pillars={pillars} rotationWarnings={rotationWarnings} />
    </div>
  )
}
