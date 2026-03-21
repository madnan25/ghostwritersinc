'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ContentPillar, Post, SeriesStatus } from '@/lib/types'
import type { PostSeriesInfo } from '@/lib/queries/series'
import { getStalenessState, getStalenessTooltip, STALENESS_CONFIG } from '@/lib/staleness'
import { getSeriesColor, SeriesThreadPanel } from './series-thread-panel'
import type { CalendarSeriesEntry } from './series-thread-panel'

type ViewMode = 'month' | 'week'

interface CalendarViewProps {
  posts: Post[]
  unscheduledPosts: Post[]
  pillars: ContentPillar[]
  /** Map of postId → PostSeriesInfo for any post that belongs to a series */
  seriesInfoByPost?: Record<string, PostSeriesInfo>
}

function getStatusColor(status: Post['status']): string {
  switch (status) {
    case 'scheduled': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    case 'approved': return 'bg-green-500/20 text-green-400 border-green-500/30'
    case 'revision': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    case 'publish_failed': return 'bg-destructive/20 text-destructive border-destructive/30'
    default: return 'bg-muted text-muted-foreground border-border'
  }
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatWeekRange(start: Date): string {
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

function seriesOpacityClass(status: SeriesStatus | undefined): string {
  if (status === 'paused') return 'opacity-50'
  if (status === 'cancelled') return 'opacity-40'
  return ''
}

function PostPill({
  post,
  pillarColor,
  seriesInfo,
}: {
  post: Post
  pillarColor?: string
  seriesInfo?: PostSeriesInfo
}) {
  const time = post.scheduled_publish_at
    ? new Date(post.scheduled_publish_at).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : ''
  const isHumanRequested = post.source === 'human_request'
  const staleness = getStalenessState(post)
  const stalenessConfig = staleness ? STALENESS_CONFIG[staleness] : null
  const isArchived = !!post.archived_at
  const stalenessTooltip = getStalenessTooltip(post)

  const seriesLabel = seriesInfo
    ? `[S] ${seriesInfo.series_title} — P${seriesInfo.part_number}/${seriesInfo.series_total_parts}`
    : ''
  const tooltipText = [seriesLabel, stalenessTooltip, post.content.slice(0, 100)]
    .filter(Boolean)
    .join('\n')

  const seriesColor = seriesInfo ? getSeriesColor(seriesInfo.series_id) : undefined
  const isCancelled = seriesInfo?.series_status === 'cancelled'
  const borderStyle = seriesColor
    ? { borderLeftColor: seriesColor, borderLeftWidth: 4 }
    : pillarColor
      ? { borderLeftColor: pillarColor, borderLeftWidth: 3 }
      : undefined

  return (
    <Link href={`/post/${post.id}`}>
      <div
        className={`flex items-center gap-1 truncate rounded border px-1.5 py-0.5 text-xs leading-5 transition-opacity hover:opacity-80 ${getStatusColor(post.status)} ${isArchived ? 'opacity-40' : ''} ${seriesOpacityClass(seriesInfo?.series_status)}`}
        title={tooltipText}
        style={borderStyle}
      >
        {seriesInfo && (
          <span
            className="mr-0.5 inline-flex shrink-0 items-center rounded px-1 text-[0.6rem] font-bold text-white"
            style={{ backgroundColor: seriesColor }}
          >
            P{seriesInfo.part_number}/{seriesInfo.series_total_parts}
          </span>
        )}
        {isHumanRequested && (
          <span className="mr-1 inline-flex items-center rounded bg-violet-500/20 px-1 text-[0.6rem] font-medium text-violet-400">
            HR
          </span>
        )}
        {time && <span className="mr-1 opacity-70">{time}</span>}
        <span className={`flex-1 truncate ${isArchived || isCancelled ? 'line-through' : ''}`}>
          {post.content.slice(0, 60)}{post.content.length > 60 ? '…' : ''}
        </span>
        {seriesInfo?.series_status === 'completed' && (
          <span className="ml-auto shrink-0 text-[0.65rem] text-blue-400">✓</span>
        )}
        {stalenessConfig && (
          <span
            className={`ml-auto shrink-0 inline-block size-1.5 rounded-full ${stalenessConfig.dotClass}`}
          />
        )}
      </div>
    </Link>
  )
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({ posts, anchor, pillarMap, seriesInfoByPost = {} }: { posts: Post[]; anchor: Date; pillarMap: Map<string, ContentPillar>; seriesInfoByPost?: Record<string, PostSeriesInfo> }) {
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Build grid: pad start to Sunday
  const cells: (Date | null)[] = []
  for (let i = 0; i < firstDay.getDay(); i++) cells.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d))

  const today = new Date()

  const postsByDay = new Map<string, Post[]>()
  for (const post of posts) {
    if (!post.scheduled_publish_at) continue
    const d = new Date(post.scheduled_publish_at)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (!postsByDay.has(key)) postsByDay.set(key, [])
    postsByDay.get(key)!.push(post)
  }

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-border">
        {weekdays.map((w) => (
          <div key={w} className="py-2 text-center text-xs font-medium text-muted-foreground">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          if (!date) {
            return <div key={`empty-${i}`} className="min-h-24 border-b border-r border-border/50" />
          }
          const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
          const dayPosts = postsByDay.get(key) ?? []
          const isToday = isSameDay(date, today)

          return (
            <div
              key={key}
              className={`min-h-[44px] border-b border-r border-border/50 p-1.5 sm:min-h-24 ${
                i % 7 === 0 ? 'border-l' : ''
              }`}
            >
              <div
                className={`mb-1 flex size-6 items-center justify-center rounded-full text-xs font-medium ${
                  isToday
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {date.getDate()}
              </div>
              <div className="flex flex-col gap-0.5">
                {dayPosts.slice(0, 3).map((post) => (
                  <PostPill
                    key={post.id}
                    post={post}
                    pillarColor={post.pillar_id ? pillarMap.get(post.pillar_id)?.color : undefined}
                    seriesInfo={seriesInfoByPost[post.id]}
                  />
                ))}
                {dayPosts.length > 3 && (
                  <span className="text-xs text-muted-foreground">+{dayPosts.length - 3} more</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({ posts, anchor, pillarMap, seriesInfoByPost = {} }: { posts: Post[]; anchor: Date; pillarMap: Map<string, ContentPillar>; seriesInfoByPost?: Record<string, PostSeriesInfo> }) {
  const weekStart = startOfWeek(anchor)
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    days.push(d)
  }

  const today = new Date()

  const postsByDay = new Map<string, Post[]>()
  for (const post of posts) {
    if (!post.scheduled_publish_at) continue
    const d = new Date(post.scheduled_publish_at)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (!postsByDay.has(key)) postsByDay.set(key, [])
    postsByDay.get(key)!.push(post)
  }

  return (
    <div className="divide-y divide-border">
      {days.map((date) => {
        const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
        const dayPosts = postsByDay.get(key) ?? []
        const isToday = isSameDay(date, today)

        return (
          <div key={key} className="flex gap-4 px-4 py-3">
            <div className="w-20 shrink-0 pt-0.5 text-right">
              <div
                className={`text-sm font-medium ${isToday ? 'text-primary' : 'text-foreground'}`}
              >
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className="text-xs text-muted-foreground">
                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              {dayPosts.length === 0 ? (
                <span className="text-xs text-muted-foreground/50 pt-1">No posts</span>
              ) : (
                dayPosts.map((post) => (
                  <PostPill
                    key={post.id}
                    post={post}
                    pillarColor={post.pillar_id ? pillarMap.get(post.pillar_id)?.color : undefined}
                    seriesInfo={seriesInfoByPost[post.id]}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Unscheduled Approved Section ────────────────────────────────────────────

function UnscheduledSection({ posts, pillarMap, seriesInfoByPost = {} }: { posts: Post[]; pillarMap: Map<string, ContentPillar>; seriesInfoByPost?: Record<string, PostSeriesInfo> }) {
  if (posts.length === 0) return null

  return (
    <div className="mt-6 rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="inline-flex size-2 rounded-full bg-amber-400" />
        <h3 className="text-sm font-semibold">Unscheduled Approved</h3>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {posts.length}
        </span>
      </div>
      <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => {
          const pillar = post.pillar_id ? pillarMap.get(post.pillar_id) : undefined
          const series = seriesInfoByPost[post.id]
          const seriesColor = series ? getSeriesColor(series.series_id) : undefined
          const borderStyle = seriesColor
            ? { borderLeftColor: seriesColor, borderLeftWidth: 4 }
            : pillar
              ? { borderLeftColor: pillar.color, borderLeftWidth: 3 }
              : undefined
          return (
            <Link key={post.id} href={`/post/${post.id}`}>
              <div
                className="group rounded-lg border border-border p-3 text-xs transition-colors hover:border-border/80 hover:bg-muted/30"
                style={borderStyle}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    {series && (
                      <div className="mb-1 flex items-center gap-1">
                        <span
                          className="inline-flex items-center rounded px-1 py-0.5 text-[0.6rem] font-bold text-white"
                          style={{ backgroundColor: seriesColor }}
                        >
                          P{series.part_number}/{series.series_total_parts}
                        </span>
                        <span className="truncate text-muted-foreground">{series.series_title}</span>
                      </div>
                    )}
                    <p className="line-clamp-2 text-foreground leading-relaxed">
                      {post.content.slice(0, 120)}{post.content.length > 120 ? '…' : ''}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 text-muted-foreground">
                      {pillar && (
                        <span className="flex items-center gap-1">
                          <span className="inline-block size-1.5 rounded-full" style={{ backgroundColor: pillar.color }} />
                          {pillar.name}
                        </span>
                      )}
                      {post.suggested_publish_at && (
                        <span>Suggested: {new Date(post.suggested_publish_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[0.65rem] font-medium text-amber-400">
                    Approved
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── Pillar Distribution Bar ──────────────────────────────────────────────────

function PillarDistributionBar({
  posts,
  pillars,
  anchor,
}: {
  posts: Post[]
  pillars: ContentPillar[]
  anchor: Date
}) {
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59)

  const monthPosts = posts.filter((p) => {
    const dateStr = p.scheduled_publish_at ?? p.suggested_publish_at
    if (!dateStr) return false
    const d = new Date(dateStr)
    return d >= monthStart && d <= monthEnd
  })

  const total = monthPosts.length
  const pillarMap = new Map(pillars.map((p) => [p.id, p]))

  const counts: Record<string, number> = {}
  for (const post of monthPosts) {
    if (post.pillar_id && pillarMap.has(post.pillar_id)) {
      counts[post.pillar_id] = (counts[post.pillar_id] ?? 0) + 1
    }
  }

  const segments = pillars.map((p) => ({
    pillar: p,
    actualPct: total > 0 ? Math.round(((counts[p.id] ?? 0) / total) * 100) : 0,
    targetPct: p.weight_pct,
  }))

  const monthLabel = anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Pillar Distribution — {monthLabel}</h3>
        <span className="text-xs text-muted-foreground">{total} planned post{total !== 1 ? 's' : ''}</span>
      </div>

      {total === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">No posts planned for this month.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Planned</p>
            <div className="flex h-6 overflow-hidden rounded-md">
              {segments
                .filter((s) => s.actualPct > 0)
                .map((s) => (
                  <div
                    key={s.pillar.id}
                    className="flex items-center justify-center transition-all duration-300"
                    style={{
                      width: `${s.actualPct}%`,
                      backgroundColor: s.pillar.color,
                      opacity: 0.85,
                    }}
                    title={`${s.pillar.name}: ${s.actualPct}%`}
                  >
                    {s.actualPct >= 12 && (
                      <span className="text-[10px] font-semibold text-white drop-shadow">
                        {s.actualPct}%
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Target</p>
            <div className="flex h-6 overflow-hidden rounded-md">
              {segments
                .filter((s) => s.targetPct > 0)
                .map((s) => (
                  <div
                    key={s.pillar.id}
                    className="flex items-center justify-center"
                    style={{
                      width: `${s.targetPct}%`,
                      backgroundColor: s.pillar.color,
                      opacity: 0.35,
                    }}
                    title={`${s.pillar.name}: ${s.targetPct}%`}
                  >
                    {s.targetPct >= 12 && (
                      <span className="text-[10px] font-semibold text-white drop-shadow">
                        {s.targetPct}%
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
            {segments.filter((s) => s.actualPct > 0 || s.targetPct > 0).map((s) => (
              <div key={s.pillar.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: s.pillar.color }} />
                <span>{s.pillar.name}</span>
                <span className="font-medium text-foreground">{s.actualPct}%</span>
                {s.actualPct !== s.targetPct && (
                  <span className={`text-[10px] ${s.actualPct > s.targetPct ? 'text-orange-400' : 'text-blue-400'}`}>
                    ({s.actualPct > s.targetPct ? '+' : ''}{s.actualPct - s.targetPct}% vs target)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CalendarView({ posts, unscheduledPosts, pillars, seriesInfoByPost = {} }: CalendarViewProps) {
  const [view, setView] = useState<ViewMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'week' : 'month',
  )
  const [anchor, setAnchor] = useState(() => new Date())
  const [showArchived, setShowArchived] = useState(false)

  const pillarMap = new Map(pillars.map((p) => [p.id, p]))

  const visiblePosts = showArchived ? posts : posts.filter((p) => !p.archived_at)
  const visibleUnscheduled = showArchived ? unscheduledPosts : unscheduledPosts.filter((p) => !p.archived_at)
  const archivedCount = posts.filter((p) => !!p.archived_at).length + unscheduledPosts.filter((p) => !!p.archived_at).length

  // Build series thread panel entries from all posts (scheduled + unscheduled)
  const allPosts = [...posts, ...unscheduledPosts]
  const seriesEntriesMap = new Map<string, CalendarSeriesEntry>()
  for (const post of allPosts) {
    const info = seriesInfoByPost[post.id]
    if (!info) continue
    if (!seriesEntriesMap.has(info.series_id)) {
      seriesEntriesMap.set(info.series_id, {
        series_id: info.series_id,
        series_title: info.series_title,
        series_total_parts: info.series_total_parts,
        series_status: info.series_status,
        parts: [],
      })
    }
    seriesEntriesMap.get(info.series_id)!.parts.push({
      part_number: info.part_number,
      post_id: post.id,
      post_status: post.status,
      scheduled_at: post.scheduled_publish_at,
    })
  }
  const seriesEntries = Array.from(seriesEntriesMap.values()).sort((a, b) =>
    a.series_title.localeCompare(b.series_title),
  )

  function navigate(dir: -1 | 1) {
    setAnchor((prev) => {
      const next = new Date(prev)
      if (view === 'month') {
        next.setMonth(next.getMonth() + dir)
      } else {
        next.setDate(next.getDate() + dir * 7)
      }
      return next
    })
  }

  const title = view === 'month' ? formatMonthYear(anchor) : formatWeekRange(startOfWeek(anchor))

  return (
    <div>
      {pillars.length > 0 && (
        <PillarDistributionBar posts={visiblePosts} pillars={pillars} anchor={anchor} />
      )}
      <div className="rounded-xl border border-border bg-card">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(-1)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-lg text-muted-foreground transition-colors active:scale-95 hover:bg-muted hover:text-foreground"
              aria-label="Previous"
            >
              ‹
            </button>
            <h2 className="min-w-[100px] text-center text-sm font-semibold sm:min-w-48">{title}</h2>
            <button
              onClick={() => navigate(1)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-lg text-muted-foreground transition-colors active:scale-95 hover:bg-muted hover:text-foreground"
              aria-label="Next"
            >
              ›
            </button>
            <button
              onClick={() => setAnchor(new Date())}
              className="ml-1 inline-flex min-h-[44px] items-center rounded-xl border border-border px-3 text-xs text-muted-foreground transition-colors active:scale-95 hover:bg-muted hover:text-foreground"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Archived toggle */}
            {archivedCount > 0 && (
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground select-none">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="size-3.5 accent-primary"
                />
                Show archived ({archivedCount})
              </label>
            )}

            {/* View toggle */}
            <div className="flex rounded-xl border border-border p-0.5">
              {(['month', 'week'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`inline-flex min-h-[44px] items-center justify-center rounded-lg px-3 text-xs font-medium capitalize transition-colors active:scale-95 ${
                    view === v
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Calendar body */}
        {view === 'month' ? (
          <MonthView posts={visiblePosts} anchor={anchor} pillarMap={pillarMap} seriesInfoByPost={seriesInfoByPost} />
        ) : (
          <WeekView posts={visiblePosts} anchor={anchor} pillarMap={pillarMap} seriesInfoByPost={seriesInfoByPost} />
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 border-t border-border px-4 py-2">
          <span className="text-xs text-muted-foreground">Status:</span>
          <span className="flex items-center gap-1.5 text-xs">
            <span className="inline-block size-2 rounded-full bg-blue-400" />
            <span className="text-muted-foreground">Scheduled</span>
          </span>
          <span className="flex items-center gap-1.5 text-xs">
            <span className="inline-block size-2 rounded-full bg-green-400" />
            <span className="text-muted-foreground">Approved</span>
          </span>
          <span className="flex items-center gap-1.5 text-xs">
            <span className="inline-flex items-center rounded bg-violet-500/20 px-1 text-[0.6rem] font-medium text-violet-400">
              HR
            </span>
            <span className="text-muted-foreground">Human Requested</span>
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">Freshness:</span>
          <span className="flex items-center gap-1.5 text-xs">
            <span className="inline-block size-1.5 rounded-full bg-emerald-400" />
            <span className="text-muted-foreground">Fresh</span>
          </span>
          <span className="flex items-center gap-1.5 text-xs">
            <span className="inline-block size-1.5 rounded-full bg-yellow-400" />
            <span className="text-muted-foreground">Aging</span>
          </span>
          <span className="flex items-center gap-1.5 text-xs">
            <span className="inline-block size-1.5 rounded-full bg-red-400" />
            <span className="text-muted-foreground">Stale</span>
          </span>
          <span className="flex items-center gap-1.5 text-xs">
            <span className="inline-block size-1.5 rounded-full bg-muted-foreground" />
            <span className="text-muted-foreground">Archived</span>
          </span>
          {pillars.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">Pillars:</span>
              {pillars.map((p) => (
                <span key={p.id} className="flex items-center gap-1.5 text-xs">
                  <span className="inline-block size-2 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="text-muted-foreground">{p.name}</span>
                </span>
              ))}
            </>
          )}
          {seriesEntries.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">Series:</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center rounded bg-muted px-1 text-[0.6rem] font-bold">P2/5</span>
                part badge
              </span>
            </>
          )}
        </div>
      </div>

      <UnscheduledSection posts={visibleUnscheduled} pillarMap={pillarMap} seriesInfoByPost={seriesInfoByPost} />
      <SeriesThreadPanel entries={seriesEntries} />
    </div>
  )
}
