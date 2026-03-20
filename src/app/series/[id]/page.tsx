import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, ExternalLink } from 'lucide-react'
import { getSeriesById } from '@/lib/queries/series'
import { SeriesLifecycleActions } from '../_components/series-lifecycle-actions'

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  planning: { label: 'Planning', className: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25' },
  active: { label: 'Active', className: 'text-green-400 bg-green-500/10 border-green-500/25' },
  paused: { label: 'Paused', className: 'text-orange-400 bg-orange-500/10 border-orange-500/25' },
  cancelled: { label: 'Cancelled', className: 'text-muted-foreground bg-muted/60 border-border' },
  completed: { label: 'Completed', className: 'text-blue-400 bg-blue-500/10 border-blue-500/25' },
}

const BRIEF_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending_strategist: { label: 'Queued', className: 'text-muted-foreground' },
  pending: { label: 'Pending', className: 'text-yellow-400' },
  in_review: { label: 'In Review', className: 'text-blue-400' },
  revision_requested: { label: 'Revision', className: 'text-orange-400' },
  done: { label: 'Done', className: 'text-green-400' },
}

const CADENCE_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
}

interface SeriesDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function SeriesDetailPage({ params }: SeriesDetailPageProps) {
  const { id } = await params
  const series = await getSeriesById(id)

  if (!series) notFound()

  const briefs = series.briefs ?? []
  const completedParts = briefs.filter(
    (b) => b.status === 'done' || b.post_status === 'published',
  ).length
  const progressPct = Math.round((completedParts / series.total_parts) * 100)
  const statusStyle = STATUS_STYLES[series.status] ?? STATUS_STYLES.planning

  return (
    <div className="container px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/series" className="hover:text-foreground transition-colors">
          Series
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground">{series.title}</span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{series.title}</h1>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyle.className}`}
            >
              {statusStyle.label}
            </span>
          </div>
          {series.description && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{series.description}</p>
          )}
        </div>
      </div>

      {/* Meta + Progress */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xl font-bold">{series.total_parts}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Total parts</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xl font-bold">{completedParts}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Completed</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xl font-bold capitalize">{CADENCE_LABELS[series.cadence] ?? series.cadence}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Cadence</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xl font-bold">{progressPct}%</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Progress</p>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="mb-8 rounded-xl border border-border bg-card p-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Series Progress</p>
          <p className="text-sm text-muted-foreground">
            {completedParts} / {series.total_parts} parts
          </p>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Lifecycle actions */}
        {series.status !== 'cancelled' && series.status !== 'completed' && (
          <div className="mt-4 border-t border-border pt-4">
            <SeriesLifecycleActions
              seriesId={series.id}
              status={series.status}
              totalParts={series.total_parts}
              currentParts={briefs.length}
            />
          </div>
        )}
      </div>

      {/* Parts list */}
      <section>
        <h2 className="mb-4 text-base font-semibold">Parts</h2>

        {briefs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">
              Brief stubs will appear here once the series is processed.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {briefs.map((brief) => {
              const briefStatus = BRIEF_STATUS_LABELS[brief.status] ?? {
                label: brief.status,
                className: 'text-muted-foreground',
              }
              const isPublished = brief.post_status === 'published'

              return (
                <div
                  key={brief.id}
                  className="flex items-start gap-4 rounded-xl border border-border bg-card px-4 py-4"
                >
                  {/* Part number */}
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-bold text-foreground">
                    {brief.series_part_number}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {brief.angle || `Part ${brief.series_part_number}`}
                    </p>
                    <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                      <span className={`text-xs font-medium ${briefStatus.className}`}>
                        {briefStatus.label}
                      </span>
                      {isPublished && (
                        <span className="text-xs text-green-400">Published</span>
                      )}
                    </div>
                  </div>

                  {/* Links */}
                  <div className="flex shrink-0 items-center gap-2">
                    {brief.post_id && (
                      <Link
                        href={`/post/${brief.post_id}`}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="size-3" />
                        Post
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
