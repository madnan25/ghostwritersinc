'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, Target } from 'lucide-react'
import type { RotationWarning } from '@/lib/post-display'

const MAX_VISIBLE = 3

interface ScheduleHealthPanelsProps {
  warnings: RotationWarning[]
}

const SHORT_TO_FULL_MONTH: Record<string, string> = {
  Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April',
  May: 'May', Jun: 'June', Jul: 'July', Aug: 'August',
  Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December',
}

function getWarningMonth(warning: RotationWarning): string {
  if (!warning.period_label) return ''
  if (warning.scope === 'month') return warning.period_label
  // Weekly scope: "Mar 15 - Mar 21, 2026" → "March 2026"
  const abbrev = warning.period_label.match(/^(\w+)\s+\d+/)
  const year = warning.period_label.match(/(\d{4})/)
  if (abbrev && year) {
    return `${SHORT_TO_FULL_MONTH[abbrev[1]] ?? abbrev[1]} ${year[1]}`
  }
  return warning.period_label
}

function SuggestedQueueList({ warnings }: { warnings: RotationWarning[] }) {
  const [expanded, setExpanded] = useState(false)

  if (warnings.length === 0) {
    return (
      <div className="rounded-[18px] border border-emerald-400/18 bg-emerald-500/8 px-4 py-4 text-sm text-foreground/78">
        <div className="flex items-center gap-2 text-emerald-300">
          <CheckCircle2 className="size-4 shrink-0" />
          <span className="font-medium">Suggested dates look balanced.</span>
        </div>
        <p className="mt-1.5 text-foreground/60">
          No pillar has three or more suggested posts crowded into the same calendar week.
        </p>
      </div>
    )
  }

  const visible = expanded ? warnings : warnings.slice(0, MAX_VISIBLE)
  const hiddenCount = warnings.length - MAX_VISIBLE

  return (
    <div>
      {visible.map((warning, index) => (
        <div
          key={`suggested-${warning.pillar_id}-${warning.period_label}`}
          className={`flex items-center gap-3 py-2.5 ${index < visible.length - 1 ? 'border-b border-white/6' : ''}`}
        >
          <AlertTriangle className="size-4 shrink-0 text-amber-300" />
          <span className="flex-1 truncate text-sm font-medium text-foreground">
            {warning.pillar_name}
          </span>
          <span className="shrink-0 text-sm text-foreground/50">
            {warning.run_length} posts in same week
          </span>
        </div>
      ))}
      {warnings.length > MAX_VISIBLE && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 text-xs text-foreground/45 transition-colors hover:text-foreground/70"
        >
          <ChevronDown
            className={`size-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
          {expanded ? 'Show less' : `Show ${hiddenCount} more`}
        </button>
      )}
    </div>
  )
}

function ScheduledMixList({ warnings }: { warnings: RotationWarning[] }) {
  const [expanded, setExpanded] = useState(false)

  if (warnings.length === 0) {
    return (
      <div className="rounded-[18px] border border-emerald-400/18 bg-emerald-500/8 px-4 py-4 text-sm text-foreground/78">
        <div className="flex items-center gap-2 text-emerald-300">
          <CheckCircle2 className="size-4 shrink-0" />
          <span className="font-medium">Scheduled mix is on target.</span>
        </div>
        <p className="mt-1.5 text-foreground/60">
          Every pillar is at or within its monthly weight target.
        </p>
      </div>
    )
  }

  // Sort: over-target first, then under-target
  const sorted = [...warnings].sort((a, b) => {
    if (a.direction === 'over' && b.direction !== 'over') return -1
    if (a.direction !== 'over' && b.direction === 'over') return 1
    return 0
  })

  const visible = expanded ? sorted : sorted.slice(0, MAX_VISIBLE)
  const hiddenCount = sorted.length - MAX_VISIBLE

  return (
    <div>
      {visible.map((warning, index) => {
        const isOver = warning.direction === 'over'
        return (
          <div
            key={`scheduled-${warning.pillar_id}-${warning.period_label}`}
            className={`py-3 ${index < visible.length - 1 ? 'border-b border-white/6' : ''}`}
          >
            <div className="flex items-center gap-3">
              {isOver ? (
                <AlertTriangle className="size-4 shrink-0 text-amber-300" />
              ) : (
                <Target className="size-4 shrink-0 text-sky-300" />
              )}
              <span className="flex-1 truncate text-sm font-medium text-foreground">
                {warning.pillar_name}
              </span>
              <span className="shrink-0 text-sm tabular-nums text-foreground/50">
                {warning.actual_count ?? warning.run_length} post{(warning.actual_count ?? warning.run_length) !== 1 ? 's' : ''}
                {' → '}
                target {warning.target_count ?? '?'}
              </span>
            </div>
            <p className={`mt-1 pl-7 text-xs ${isOver ? 'text-amber-300/70' : 'text-sky-300/70'}`}>
              {warning.suggestion}
            </p>
          </div>
        )
      })}
      {sorted.length > MAX_VISIBLE && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 text-xs text-foreground/45 transition-colors hover:text-foreground/70"
        >
          <ChevronDown
            className={`size-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
          {expanded ? 'Show less' : `Show ${hiddenCount} more`}
        </button>
      )}
    </div>
  )
}

export function ScheduleHealthPanels({ warnings }: ScheduleHealthPanelsProps) {
  const months = useMemo(
    () => [...new Set(warnings.map(getWarningMonth).filter(Boolean))],
    [warnings],
  )
  const currentMonthLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    [],
  )
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (months.includes(currentMonthLabel)) return currentMonthLabel
    return months[0] ?? currentMonthLabel
  })

  useEffect(() => {
    if (months.length === 0) return
    if (months.includes(selectedMonth)) return
    setSelectedMonth(months.includes(currentMonthLabel) ? currentMonthLabel : months[0])
  }, [currentMonthLabel, months, selectedMonth])

  const filtered = warnings.filter((w) => getWarningMonth(w) === selectedMonth)

  const suggestedWarnings = filtered.filter((warning) => warning.source === 'suggested')
  const scheduledWarnings = filtered.filter((warning) => warning.source === 'scheduled')

  return (
    <section className="space-y-3">
      {months.length > 1 && (
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="appearance-none rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 pr-7 text-xs font-medium text-foreground/70 outline-none transition-colors hover:border-white/20 hover:text-foreground focus:border-white/25"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'rgba(255,255,255,0.4)\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
        >
          {months.map((month) => (
            <option key={month} value={month}>{month}</option>
          ))}
        </select>
      )}
      {months.length === 1 && (
        <p className="text-xs font-medium text-foreground/45">{months[0]}</p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
      <div className="dashboard-frame rounded-[24px] p-5 sm:p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-amber-400/18 bg-amber-500/[0.08] text-amber-300">
            <CalendarClock className="size-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">Suggested Queue Watchouts</h2>
              {suggestedWarnings.length > 0 && (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300">
                  {suggestedWarnings.length}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm leading-6 text-foreground/62">
              Weekly crowding in suggested publish dates before posts are locked into the calendar.
            </p>
          </div>
        </div>
        <SuggestedQueueList warnings={suggestedWarnings} />
      </div>

      <div className="dashboard-frame rounded-[24px] p-5 sm:p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-sky-400/18 bg-sky-500/[0.08] text-sky-300">
            <Target className="size-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">Scheduled Mix Alerts</h2>
              {scheduledWarnings.length > 0 && (
                <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-xs font-medium text-sky-300">
                  {scheduledWarnings.length}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm leading-6 text-foreground/62">
              Post counts vs targets for each pillar. Shows what to add, remove, or reassign.
            </p>
          </div>
        </div>
        <ScheduledMixList warnings={scheduledWarnings} />
      </div>
      </div>
    </section>
  )
}
