import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPillars, getAllPosts } from '@/lib/queries/posts'
import { PillarCard } from './_components/pillar-card'
import { ContentMixChart } from './_components/content-mix-chart'
import { RotationTimeline } from './_components/rotation-timeline'
import type { Post } from '@/lib/types'

function computeActualPct(posts: Post[], pillarId: string): number {
  const pillarPosts = posts.filter((p) => p.pillar_id === pillarId)
  const assigned = posts.filter((p) => p.pillar_id)
  if (assigned.length === 0) return 0
  return Math.round((pillarPosts.length / assigned.length) * 100)
}

function getPillarBalance(
  posts: Post[],
  pillars: { id: string; weight_pct: number }[],
): { label: string; variant: 'good' | 'ok' | 'off' } {
  const assigned = posts.filter((p) => p.pillar_id)
  if (assigned.length === 0) return { label: 'No data yet', variant: 'ok' }

  const maxDeviation = Math.max(
    ...pillars.map((p) => {
      const actual = Math.round((assigned.filter((post) => post.pillar_id === p.id).length / assigned.length) * 100)
      return Math.abs(actual - p.weight_pct)
    }),
  )

  if (maxDeviation <= 5) return { label: 'Well balanced', variant: 'good' }
  if (maxDeviation <= 15) return { label: 'Slightly off-target', variant: 'ok' }
  return { label: 'Needs rebalancing', variant: 'off' }
}

function getPostsThisMonth(posts: Post[]): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return posts.filter((p) => {
    const date = p.suggested_publish_at ?? p.created_at
    return new Date(date) >= start
  }).length
}

export default async function StrategyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get org name
  const { data: orgMember } = await supabase
    .from('organization_members')
    .select('organizations(name)')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  const orgData = orgMember?.organizations
  const orgName =
    orgData && !Array.isArray(orgData)
      ? (orgData as { name: string }).name
      : 'Your Organization'

  const [pillars, posts] = await Promise.all([getPillars(), getAllPosts()])

  const postsThisMonth = getPostsThisMonth(posts)
  const balance = getPillarBalance(posts, pillars)

  const balanceColors = {
    good: 'text-green-400 bg-green-500/10 border-green-500/25',
    ok: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25',
    off: 'text-orange-400 bg-orange-500/10 border-orange-500/25',
  }

  // Last 10 posts with scheduled date for rotation timeline
  const recentPosts = [...posts]
    .filter((p) => p.suggested_publish_at)
    .sort((a, b) => new Date(b.suggested_publish_at!).getTime() - new Date(a.suggested_publish_at!).getTime())
    .slice(0, 10)

  return (
    <div className="container px-4 py-8">
      {/* Section A: Strategy Overview Header */}
      <div className="mb-10">
        <p className="text-sm font-medium text-muted-foreground">{orgName}</p>
        <h1 className="mt-1 text-2xl font-bold">Content Strategy</h1>

        <div className="mt-4 flex flex-wrap gap-3">
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-2xl font-bold">{pillars.length}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Content pillars</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-2xl font-bold">{postsThisMonth}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Posts this month</p>
          </div>
          <div className={`rounded-lg border px-4 py-3 ${balanceColors[balance.variant]}`}>
            <p className="text-base font-semibold">{balance.label}</p>
            <p className="mt-0.5 text-xs opacity-70">Pillar balance</p>
          </div>
        </div>
      </div>

      {pillars.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-2xl">
            🏛
          </div>
          <h3 className="mt-4 text-base font-semibold">No content pillars yet</h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            Content pillars define the themes and topics your LinkedIn presence is built around.
            They&apos;ll appear here once created.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {/* Section B: Pillar Cards */}
          <section>
            <h2 className="mb-4 text-lg font-semibold">Your Pillars</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {pillars.map((pillar) => (
                <PillarCard
                  key={pillar.id}
                  pillar={pillar}
                  actualPct={computeActualPct(posts, pillar.id)}
                />
              ))}
            </div>
          </section>

          {/* Section C: Content Mix Summary */}
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Content Mix</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Actual vs target distribution across your pillars
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <ContentMixChart pillars={pillars} posts={posts} />
            </div>
          </section>

          {/* Section D: Rotation Health */}
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Rotation Health</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Last 10 scheduled posts — variety check
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <RotationTimeline recentPosts={recentPosts} pillars={pillars} />
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
