'use client'

import { useState } from 'react'
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
          No pillar is over its monthly weight target in the scheduled calendar.
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
          key={`scheduled-${warning.pillar_id}-${warning.period_label}`}
          className={`flex items-center gap-3 py-2.5 ${index < visible.length - 1 ? 'border-b border-white/6' : ''}`}
        >
          <Target className="size-4 shrink-0 text-sky-300" />
          <span className="flex-1 truncate text-sm font-medium text-foreground">
            {warning.pillar_name}
          </span>
          <span className="shrink-0 text-sm text-foreground/50">
            {warning.actual_pct}% vs {warning.target_pct}% target
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

export function ScheduleHealthPanels({ warnings }: ScheduleHealthPanelsProps) {
  const months = [...new Set(warnings.map(getWarningMonth).filter(Boolean))]
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

  const filtered = selectedMonth
    ? warnings.filter((w) => getWarningMonth(w) === selectedMonth)
    : warnings

  const suggestedWarnings = filtered.filter((warning) => warning.source === 'suggested')
  const scheduledWarnings = filtered.filter((warning) => warning.source === 'scheduled')

  return (
    <section className="space-y-3">
      {months.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setSelectedMonth(null)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedMonth === null
                ? 'bg-white/10 text-foreground'
                : 'text-foreground/45 hover:text-foreground/70'
            }`}
          >
            All
          </button>
          {months.map((month) => (
            <button
              key={month}
              onClick={() => setSelectedMonth(month)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedMonth === month
                  ? 'bg-white/10 text-foreground'
                  : 'text-foreground/45 hover:text-foreground/70'
              }`}
            >
              {month}
            </button>
          ))}
        </div>
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
              Monthly pillar weight drift in the actual scheduled calendar. Wildcards are excluded.
            </p>
          </div>
        </div>
        <ScheduledMixList warnings={scheduledWarnings} />
      </div>
      </div>
    </section>
  )
}
