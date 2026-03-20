'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ContentPillar, Post } from '@/lib/types'

type ViewMode = 'month' | 'week'

interface CalendarViewProps {
  posts: Post[]
  unscheduledPosts: Post[]
  pillars: ContentPillar[]
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

function PostPill({ post, pillarColor }: { post: Post; pillarColor?: string }) {
  const time = post.scheduled_publish_at
    ? new Date(post.scheduled_publish_at).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : ''

  return (
    <Link href={`/post/${post.id}`}>
      <div
        className={`truncate rounded border px-1.5 py-0.5 text-xs leading-5 transition-opacity hover:opacity-80 ${getStatusColor(post.status)}`}
        title={post.content}
        style={pillarColor ? { borderLeftColor: pillarColor, borderLeftWidth: 3 } : undefined}
      >
        {time && <span className="mr-1 opacity-70">{time}</span>}
        <span>{post.content.slice(0, 60)}{post.content.length > 60 ? '…' : ''}</span>
      </div>
    </Link>
  )
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({ posts, anchor, pillarMap }: { posts: Post[]; anchor: Date; pillarMap: Map<string, ContentPillar> }) {
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
                  <PostPill key={post.id} post={post} pillarColor={post.pillar_id ? pillarMap.get(post.pillar_id)?.color : undefined} />
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

function WeekView({ posts, anchor, pillarMap }: { posts: Post[]; anchor: Date; pillarMap: Map<string, ContentPillar> }) {
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
                  <PostPill key={post.id} post={post} pillarColor={post.pillar_id ? pillarMap.get(post.pillar_id)?.color : undefined} />
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

function UnscheduledSection({ posts, pillarMap }: { posts: Post[]; pillarMap: Map<string, ContentPillar> }) {
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
          return (
            <Link key={post.id} href={`/post/${post.id}`}>
              <div
                className="group rounded-lg border border-border p-3 text-xs transition-colors hover:border-border/80 hover:bg-muted/30"
                style={pillar ? { borderLeftColor: pillar.color, borderLeftWidth: 3 } : undefined}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function CalendarView({ posts, unscheduledPosts, pillars }: CalendarViewProps) {
  const [view, setView] = useState<ViewMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'week' : 'month',
  )
  const [anchor, setAnchor] = useState(() => new Date())

  const pillarMap = new Map(pillars.map((p) => [p.id, p]))

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

        {/* Calendar body */}
        {view === 'month' ? (
          <MonthView posts={posts} anchor={anchor} pillarMap={pillarMap} />
        ) : (
          <WeekView posts={posts} anchor={anchor} pillarMap={pillarMap} />
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
        </div>
      </div>

      <UnscheduledSection posts={unscheduledPosts} pillarMap={pillarMap} />
    </div>
  )
}
