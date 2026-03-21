import Link from 'next/link'
import type { ContentSeries } from '@/lib/types'

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  planning: {
    label: 'Planning',
    className: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25',
  },
  active: {
    label: 'Active',
    className: 'text-green-400 bg-green-500/10 border-green-500/25',
  },
  paused: {
    label: 'Paused',
    className: 'text-orange-400 bg-orange-500/10 border-orange-500/25',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'text-muted-foreground bg-muted/60 border-border',
  },
  completed: {
    label: 'Completed',
    className: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
  },
}

const CADENCE_LABELS: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
}

interface SeriesCardProps {
  series: ContentSeries
  completedParts?: number
}

export function SeriesCard({ series, completedParts = 0 }: SeriesCardProps) {
  const statusStyle = STATUS_STYLES[series.status] ?? STATUS_STYLES.planning
  const progressPct = Math.round((completedParts / series.total_parts) * 100)

  return (
    <Link
      href={`/series/${series.id}`}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-4 transition-colors hover:border-border/80 hover:bg-card/80"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            {series.title}
          </h3>
          {series.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {series.description}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyle.className}`}
        >
          {statusStyle.label}
        </span>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{series.total_parts} parts</span>
        <span>{CADENCE_LABELS[series.cadence] ?? series.cadence}</span>
        {completedParts > 0 && (
          <span className="text-green-400">
            {completedParts}/{series.total_parts} published
          </span>
        )}
      </div>

      {/* Progress bar */}
      {series.status !== 'planning' && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
    </Link>
  )
}
