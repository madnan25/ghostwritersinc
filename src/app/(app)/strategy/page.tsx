import { createClient } from '@/lib/supabase/server'
import { getPillars, getAllPosts, getPillarWeightsConfig } from '@/lib/queries/posts'
import { getSeries } from '@/lib/queries/series'
import { PillarCard } from './_components/pillar-card'
import { ContentMixChart } from './_components/content-mix-chart'
import { RotationTimeline } from './_components/rotation-timeline'
import { ScoutInstructionsCard } from './_components/scout-instructions-card'
import { PillarWeightSliders } from './_components/pillar-weight-sliders'
import { PostingDaysToggle } from './_components/posting-days-toggle'
import { WhatsWorkingCard } from './_components/whats-working-card'
import { VoiceLearningCard } from './_components/voice-learning-card'
import { RequestPostButton } from '../dashboard/_components/request-post-dialog'
import { CreateSeriesButton } from '../series/_components/create-series-wizard'
import { SeriesCard } from '../series/_components/series-card'
import { getScoutContext, getStrategyConfig, getVoiceObservationsData } from '@/app/actions/strategy'
import type { Post } from '@/lib/types'
import type { WhatsWorkingSummary } from '@/lib/performance-analysis'
import { getCalendarDate } from '@/lib/post-display'
import Link from 'next/link'

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
  // Auth handled by middleware; fetch user + data in parallel
  const supabase = await createClient()
  const [{ data: { user } }, pillars, posts, scoutData, pillarWeightsConfig, strategyConfig, voiceData, allSeries] = await Promise.all([
    supabase.auth.getUser(),
    getPillars(),
    getAllPosts(),
    getScoutContext(),
    getPillarWeightsConfig(),
    getStrategyConfig(),
    getVoiceObservationsData(),
    getSeries(),
  ])

  // Get org membership (needed for org name + scoping queries)
  let orgName = 'Your Organization'
  let organizationId: string | null = null
  if (user) {
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id, organizations(name)')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (orgMember) {
      organizationId = orgMember.organization_id
      const orgData = orgMember.organizations
      if (orgData && !Array.isArray(orgData)) {
        orgName = (orgData as { name: string }).name
      }
    }
  }

  // Fetch "What's Working" summary (non-blocking — returns null if no data)
  let whatsWorking: WhatsWorkingSummary | null = null
  let whatsWorkingUpdatedAt: string | null = null
  if (user && organizationId) {
    const { data: strategyRow } = await supabase
      .from('strategy_config')
      .select('whats_working, whats_working_updated_at')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .maybeSingle()
    whatsWorking = (strategyRow?.whats_working as WhatsWorkingSummary | null) ?? null
    whatsWorkingUpdatedAt = strategyRow?.whats_working_updated_at ?? null
  }

  const postsThisMonth = getPostsThisMonth(posts)
  const balance = getPillarBalance(posts, pillars)

  const balanceColors = {
    good: 'text-green-400 bg-green-500/10 border-green-500/25',
    ok: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25',
    off: 'text-orange-400 bg-orange-500/10 border-orange-500/25',
  }

  // Last 10 posts with scheduled date for rotation timeline
  const recentPosts = [...posts]
    .filter((p) => getCalendarDate(p))
    .sort((a, b) => new Date(getCalendarDate(b)!).getTime() - new Date(getCalendarDate(a)!).getTime())
    .slice(0, 10)

  return (
    <div className="container px-4 py-8">
      {/* Section A: Strategy Overview Header */}
      <div className="mb-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{orgName}</p>
            <h1 className="mt-1 text-2xl font-bold">Content Strategy</h1>
          </div>
          <RequestPostButton />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
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

      {/* Scout Instructions */}
      <div className="mb-10">
        <ScoutInstructionsCard
          initialContext={scoutData.context}
          initialUpdatedAt={scoutData.updatedAt}
        />
      </div>

      {/* What's Working Summary */}
      <div className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">Performance Insights</h2>
        <WhatsWorkingCard summary={whatsWorking} updatedAt={whatsWorkingUpdatedAt} />
      </div>

      {/* Voice Learning */}
      <div className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">Voice Learning</h2>
        <VoiceLearningCard
          observations={voiceData.observations}
          diffCount={voiceData.diffCount}
        />
      </div>

      {/* Content Series */}
      <div className="mb-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Content Series</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Multi-part narrative arcs for sequenced publishing
            </p>
          </div>
          <div className="flex items-center gap-2">
            {allSeries.length > 0 && (
              <Link
                href="/series"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all
              </Link>
            )}
            <CreateSeriesButton />
          </div>
        </div>

        {allSeries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No series yet. Create one to plan a multi-post narrative arc.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {allSeries.slice(0, 6).map((s) => (
              <SeriesCard key={s.id} series={s} />
            ))}
          </div>
        )}
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

          {/* Section C: Content Mix Summary + Weight Sliders */}
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Content Mix</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Actual vs target distribution across your pillars
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
              <div className="rounded-xl border border-border bg-card p-5">
                <ContentMixChart pillars={pillars} posts={posts} />
              </div>
              <div className="flex flex-col gap-4">
                <PillarWeightSliders pillars={pillars} savedConfig={pillarWeightsConfig} />
                <PostingDaysToggle initialDays={strategyConfig?.posting_days ?? [1, 2, 3, 4, 5]} />
              </div>
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
