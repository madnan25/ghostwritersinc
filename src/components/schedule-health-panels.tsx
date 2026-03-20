'use client'

import { AlertTriangle, CalendarClock, CheckCircle2, Target } from 'lucide-react'
import type { RotationWarning } from '@/lib/post-display'

interface ScheduleHealthPanelsProps {
  warnings: RotationWarning[]
}

function SuggestedQueueList({ warnings }: { warnings: RotationWarning[] }) {
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

  return (
    <div className="space-y-2.5">
      {warnings.map((warning) => (
        <div
          key={`suggested-${warning.pillar_id}-${warning.period_label}`}
          className="rounded-[18px] border border-amber-400/16 bg-amber-500/[0.07] px-4 py-3.5"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {warning.pillar_name}
              </p>
              <p className="mt-1 text-sm text-foreground/70">
                {warning.period_label}: {warning.run_length} suggested posts in the same week.
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ScheduledMixList({ warnings }: { warnings: RotationWarning[] }) {
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

  return (
    <div className="space-y-2.5">
      {warnings.map((warning) => (
        <div
          key={`scheduled-${warning.pillar_id}-${warning.period_label}`}
          className="rounded-[18px] border border-sky-400/16 bg-sky-500/[0.07] px-4 py-3.5"
        >
          <div className="flex items-start gap-3">
            <Target className="mt-0.5 size-4 shrink-0 text-sky-300" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {warning.pillar_name}
              </p>
              <p className="mt-1 text-sm text-foreground/70">
                {warning.period_label}: {warning.actual_pct}% scheduled vs {warning.target_pct}% target.
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ScheduleHealthPanels({ warnings }: ScheduleHealthPanelsProps) {
  const suggestedWarnings = warnings.filter((warning) => warning.source === 'suggested')
  const scheduledWarnings = warnings.filter((warning) => warning.source === 'scheduled')

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="dashboard-frame rounded-[24px] p-5 sm:p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-amber-400/18 bg-amber-500/[0.08] text-amber-300">
            <CalendarClock className="size-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight">Suggested Queue Watchouts</h2>
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
          <div>
            <h2 className="text-base font-semibold tracking-tight">Scheduled Mix Alerts</h2>
            <p className="mt-1 text-sm leading-6 text-foreground/62">
              Monthly pillar weight drift in the actual scheduled calendar. Wildcards are excluded.
            </p>
          </div>
        </div>
        <ScheduledMixList warnings={scheduledWarnings} />
      </div>
    </section>
  )
}
