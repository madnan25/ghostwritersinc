import { getAllPostsWithRevisions, getPillars } from '@/lib/queries/posts'
import { computeRotationWarnings } from '@/lib/post-display'
import { getDashboardMetrics, getDashboardNarrative } from '@/lib/dashboard-ui'
import { getCurrentOrgUser } from '@/lib/server-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { DashboardHero } from './_components/dashboard-hero'
import { PostGrid } from './_components/post-grid'
import { AgentActivityFeed } from './_components/agent-activity-feed'

type AgentDirectory = Record<string, { name: string; job_title: string | null }>

async function getDashboardAgentDirectory(): Promise<AgentDirectory> {
  const authResult = await getCurrentOrgUser('organization_id')
  if (authResult.status !== 'authenticated') {
    return {}
  }

  const admin = createAdminClient()
  const { data: agents } = await admin
    .from('agents')
    .select('id, name, job_title')
    .eq('organization_id', authResult.context.profile.organization_id)
    .order('created_at', { ascending: true })

  return Object.fromEntries(
    (agents ?? []).map((agent) => [
      agent.id,
      { name: agent.name, job_title: agent.job_title ?? null },
    ]),
  )
}

export default async function DashboardPage() {
  // Auth + onboarding handled by middleware
  const [posts, pillars, agentDirectory] = await Promise.all([
    getAllPostsWithRevisions(),
    getPillars(),
    getDashboardAgentDirectory(),
  ])
  const metrics = getDashboardMetrics(posts)
  const narrative = getDashboardNarrative(metrics)
  const rotationWarnings = computeRotationWarnings(posts, pillars)

  return (
    <div className="premium-page">
      <DashboardHero metrics={metrics} narrative={narrative} />

      <PostGrid posts={posts} pillars={pillars} rotationWarnings={rotationWarnings} />

      <AgentActivityFeed agentDirectory={agentDirectory} />
    </div>
  )
}
