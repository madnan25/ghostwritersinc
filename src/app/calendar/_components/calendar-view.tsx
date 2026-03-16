'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Post } from '@/lib/types'

interface Props {
  posts: Post[]
}

type ViewMode = 'month' | 'week'

const PILLAR_COLORS: Record<string, string> = {
  'Thought Leadership': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Industry Insights': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Personal Story': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Product Update': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Engagement: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
}

const STATUS_DOT: Record<string, string> = {
  draft: 'bg-muted-foreground/50',
  agent_review: 'bg-blue-400',
  pending_review: 'bg-amber-400',
  approved: 'bg-emerald-400',
  scheduled: 'bg-purple-400',
  published: 'bg-emerald-600',
  rejected: 'bg-destructive',
}

function pillarColor(pillar: string | null): string {
  if (!pillar) return 'bg-muted text-muted-foreground border-border'
  return PILLAR_COLORS[pillar] ?? 'bg-muted text-muted-foreground border-border'
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function postDateKey(post: Post): string | null {
  const raw = post.suggested_publish_at ?? post.scheduled_publish_at
  if (!raw) return null
  return toDateKey(new Date(raw))
}

function buildPostMap(posts: Post[]): Map<string, Post[]> {
  const map = new Map<string, Post[]>()
  for (const post of posts) {
    const key = postDateKey(post)
    if (!key) continue
    const existing = map.get(key) ?? []
    existing.push(post)
    map.set(key, existing)
  }
  return map
}

function PostChip({ post }: { post: Post }) {
  const color = pillarColor(post.pillar)
  const dot = STATUS_DOT[post.status] ?? 'bg-muted-foreground/50'
  return (
    <Link
      href={`/post/${post.id}`}
      className={`flex min-w-0 items-center gap-1 rounded border px-1.5 py-0.5 text-xs transition-opacity hover:opacity-80 ${color}`}
      title={`${post.status.replace('_', ' ')} — ${post.pillar ?? 'No pillar'}`}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="truncate">{post.content.slice(0, 40)}</span>
    </Link>
  )
}

// ── Month view ──────────────────────────────────────────────────────────────

function MonthView({ year, month, postMap }: { year: number; month: number; postMap: Map<string, Post[]> }) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay() // 0=Sun
  const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7

  const today = toDateKey(new Date())

  const days: Array<{ key: string | null; date: number | null; isCurrentMonth: boolean }> = []

  // Leading empty cells from previous month
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i
    const key = toDateKey(new Date(year, month - 1, d))
    days.push({ key, date: d, isCurrentMonth: false })
  }

  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const key = toDateKey(new Date(year, month, d))
    days.push({ key, date: d, isCurrentMonth: true })
  }

  // Trailing cells
  let trailing = 1
  while (days.length < totalCells) {
    const key = toDateKey(new Date(year, month + 1, trailing))
    days.push({ key, date: trailing, isCurrentMonth: false })
    trailing++
  }

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      {/* Day grid */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const posts = day.key ? (postMap.get(day.key) ?? []) : []
          const isToday = day.key === today
          return (
            <div
              key={i}
              className={`min-h-[100px] border-b border-r border-border p-1.5 ${
                !day.isCurrentMonth ? 'bg-muted/20' : ''
              } ${i % 7 === 0 ? 'border-l' : ''}`}
            >
              <div
                className={`mb-1 flex size-6 items-center justify-center rounded-full text-xs font-medium ${
                  isToday
                    ? 'bg-primary text-primary-foreground'
                    : day.isCurrentMonth
                      ? 'text-foreground'
                      : 'text-muted-foreground/40'
                }`}
              >
                {day.date}
              </div>
              <div className="flex flex-col gap-0.5">
                {posts.map((p) => (
                  <PostChip key={p.id} post={p} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Week view ───────────────────────────────────────────────────────────────

function WeekView({ weekStart, postMap }: { weekStart: Date; postMap: Map<string, Post[]> }) {
  const today = toDateKey(new Date())
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  return (
    <div className="grid grid-cols-7 gap-px bg-border">
      {days.map((day) => {
        const key = toDateKey(day)
        const posts = postMap.get(key) ?? []
        const isToday = key === today
        return (
          <div key={key} className="min-h-[200px] bg-card p-2">
            {/* Day header */}
            <div className="mb-2 text-center">
              <div className="text-xs text-muted-foreground">
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div
                className={`mx-auto flex size-7 items-center justify-center rounded-full text-sm font-medium ${
                  isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
                }`}
              >
                {day.getDate()}
              </div>
            </div>
            {/* Posts */}
            <div className="flex flex-col gap-1">
              {posts.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground/40">—</p>
              ) : (
                posts.map((p) => <PostChip key={p.id} post={p} />)
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main CalendarView ────────────────────────────────────────────────────────

export function CalendarView({ posts }: Props) {
  const today = new Date()
  const [view, setView] = useState<ViewMode>('month')
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(today)
    d.setDate(today.getDate() - today.getDay())
    return d
  })

  const postMap = buildPostMap(posts)

  function prevMonth() {
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else {
      setMonth((m) => m + 1)
    }
  }

  function prevWeek() {
    setWeekStart((ws) => {
      const d = new Date(ws)
      d.setDate(ws.getDate() - 7)
      return d
    })
  }

  function nextWeek() {
    setWeekStart((ws) => {
      const d = new Date(ws)
      d.setDate(ws.getDate() + 7)
      return d
    })
  }

  const monthLabel = new Date(year, month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const weekEndDate = new Date(weekStart)
  weekEndDate.setDate(weekStart.getDate() + 6)
  const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  // Legend
  const pillars = Object.keys(PILLAR_COLORS)

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Nav */}
        <div className="flex items-center gap-2">
          <button
            onClick={view === 'month' ? prevMonth : prevWeek}
            className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-[200px] text-center text-sm font-medium">
            {view === 'month' ? monthLabel : weekLabel}
          </span>
          <button
            onClick={view === 'month' ? nextMonth : nextWeek}
            className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* View toggle */}
        <div className="flex rounded-lg border border-border p-0.5">
          {(['month', 'week'] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 text-sm capitalize transition-colors ${
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

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3">
        {pillars.map((p) => (
          <span key={p} className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${PILLAR_COLORS[p]}`}>
            {p}
          </span>
        ))}
      </div>

      {/* Calendar */}
      <div className="overflow-hidden rounded-xl border border-border">
        {view === 'month' ? (
          <MonthView year={year} month={month} postMap={postMap} />
        ) : (
          <WeekView weekStart={weekStart} postMap={postMap} />
        )}
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {Object.entries(STATUS_DOT).map(([status, dot]) => (
          <span key={status} className="flex items-center gap-1.5 capitalize">
            <span className={`size-2 rounded-full ${dot}`} />
            {status.replace('_', ' ')}
          </span>
        ))}
      </div>
    </div>
  )
}
