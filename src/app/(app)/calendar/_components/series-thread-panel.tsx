'use client'

import Link from 'next/link'
import type { SeriesStatus } from '@/lib/types'

export interface CalendarSeriesEntry {
  series_id: string
  series_title: string
  series_total_parts: number
  series_status: SeriesStatus
  /** Parts that appear in the current calendar month, keyed by part_number → postId */
  parts: Array<{
    part_number: number
    post_id: string
    post_status: string
    scheduled_at: string | null
  }>
}

const SERIES_PALETTE = [
  '#a855f7', // violet
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#10b981', // emerald
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
]

export function getSeriesColor(seriesId: string): string {
  let hash = 0
  for (const char of seriesId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return SERIES_PALETTE[hash % SERIES_PALETTE.length]
}

function SeriesStatusBadge({ status }: { status: SeriesStatus }) {
  const cfg: Record<SeriesStatus, { label: string; cls: string }> = {
    planning:  { label: 'Planning',  cls: 'bg-muted text-muted-foreground' },
    active:    { label: 'Active',    cls: 'bg-green-500/20 text-green-400' },
    paused:    { label: 'Paused',    cls: 'bg-yellow-500/20 text-yellow-400' },
    cancelled: { label: 'Cancelled', cls: 'bg-destructive/20 text-destructive' },
    completed: { label: 'Complete',  cls: 'bg-blue-500/20 text-blue-400' },
  }
  const { label, cls } = cfg[status] ?? cfg.planning
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium ${cls}`}>
      {label}
    </span>
  )
}

function PartDot({
  part,
  color,
  partNumber,
  seriesStatus,
}: {
  part: CalendarSeriesEntry['parts'][number] | null
  color: string
  partNumber: number
  seriesStatus: SeriesStatus
}) {
  const isFuture = !part
  const isPaused = seriesStatus === 'paused' && isFuture
  const isCancelled = seriesStatus === 'cancelled' && isFuture

  const baseStyle = {
    backgroundColor: isFuture ? 'transparent' : color,
    borderColor: color,
    opacity: isPaused || isCancelled ? 0.4 : 1,
  }

  if (!part) {
    return (
      <span
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.55rem] font-bold"
        style={baseStyle}
        title={`Part ${partNumber} — not yet published`}
      >
        {isCancelled ? '✕' : ''}
      </span>
    )
  }

  const isPublished = part.post_status === 'published'
  const label = part.scheduled_at
    ? new Date(part.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'Unscheduled'

  return (
    <Link href={`/post/${part.post_id}`} title={`Part ${part.part_number} — ${label}`}>
      <span
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[0.55rem] font-bold text-white transition-opacity hover:opacity-80"
        style={{ backgroundColor: color }}
      >
        {isPublished ? '✓' : part.part_number}
      </span>
    </Link>
  )
}

export function SeriesThreadPanel({ entries }: { entries: CalendarSeriesEntry[] }) {
  if (entries.length === 0) return null

  return (
    <div className="mt-6 rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="text-sm">🧵</span>
        <h3 className="text-sm font-semibold">Content Series</h3>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {entries.length} series
        </span>
      </div>

      <div className="divide-y divide-border">
        {entries.map((entry) => {
          const color = getSeriesColor(entry.series_id)
          const partMap = new Map(entry.parts.map((p) => [p.part_number, p]))
          const publishedCount = entry.parts.filter((p) => p.post_status === 'published').length

          return (
            <div key={entry.series_id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
              {/* Series color swatch + title */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span
                  className={`truncate text-sm font-medium ${
                    entry.series_status === 'cancelled' ? 'text-muted-foreground line-through' : ''
                  }`}
                >
                  {entry.series_title}
                </span>
                <SeriesStatusBadge status={entry.series_status} />
              </div>

              {/* Parts progress dots */}
              <div className="flex items-center gap-1">
                {Array.from({ length: entry.series_total_parts }, (_, i) => {
                  const partNumber = i + 1
                  const part = partMap.get(partNumber) ?? null
                  return (
                    <PartDot
                      key={partNumber}
                      part={part}
                      color={color}
                      partNumber={partNumber}
                      seriesStatus={entry.series_status}
                    />
                  )
                })}
                <span className="ml-2 text-xs text-muted-foreground">
                  {publishedCount}/{entry.series_total_parts}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
