import { getInsightsData, getPillars } from '@/lib/queries/posts'
import { InsightsCharts } from './_components/insights-charts'

export default async function InsightsPage() {
  // Auth handled by middleware
  const [posts, pillars] = await Promise.all([getInsightsData(), getPillars()])

  return (
    <div className="container px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Post performance metrics and engagement trends
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-2xl">
            📊
          </div>
          <h3 className="mt-4 text-base font-semibold">No performance data yet</h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            Performance metrics will appear here once published posts have data logged.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-2xl font-bold">{posts.length}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Posts with data</p>
            </div>
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-2xl font-bold">{pillars.length}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Content pillars</p>
            </div>
          </div>

          <InsightsCharts posts={posts} />
        </div>
      )}
    </div>
  )
}
