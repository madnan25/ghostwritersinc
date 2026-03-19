import { CheckCircle, XCircle, ArrowUpCircle, ArrowRight } from 'lucide-react'
import type { ReviewEvent } from '@/lib/types'

interface ReviewChainProps {
  events: ReviewEvent[]
}

interface VersionGroup {
  version: number
  events: ReviewEvent[]
  outcome: 'approved' | 'rejected' | 'escalated' | 'pending'
}

const ACTION_CONFIG = {
  approved: {
    icon: CheckCircle,
    label: 'Approved',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  rejected: {
    icon: XCircle,
    label: 'Rejected',
    color: 'text-destructive',
    bg: 'bg-destructive/10 border-destructive/20',
  },
  escalated: {
    icon: ArrowUpCircle,
    label: 'Escalated',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
}

function formatTime(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

/** Group events into draft versions. A new version starts after each rejection. */
function groupIntoVersions(events: ReviewEvent[]): VersionGroup[] {
  if (events.length === 0) return []

  const versions: VersionGroup[] = []
  let current: ReviewEvent[] = []
  let versionNum = 1

  for (const event of events) {
    current.push(event)
    if (event.action === 'rejected') {
      versions.push({ version: versionNum, events: current, outcome: 'rejected' })
      current = []
      versionNum++
    }
  }

  // Remaining events (last group — may be approved, escalated, or still pending)
  if (current.length > 0) {
    const lastAction = current[current.length - 1].action
    const outcome = lastAction === 'approved' ? 'approved' : lastAction === 'escalated' ? 'escalated' : 'pending'
    versions.push({ version: versionNum, events: current, outcome })
  }

  return versions
}

function VersionBadge({ version, outcome }: { version: number; outcome: VersionGroup['outcome'] }) {
  const isApproved = outcome === 'approved'
  const isRejected = outcome === 'rejected'

  return (
    <div className="flex items-center gap-2 mb-2">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] border ${
          isApproved
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
            : isRejected
              ? 'bg-destructive/10 border-destructive/25 text-destructive'
              : 'bg-muted border-border text-muted-foreground'
        }`}
      >
        Draft v{version}
      </span>
      {isApproved && (
        <span className="text-[0.7rem] text-emerald-400 font-medium">— approved for publishing</span>
      )}
    </div>
  )
}

function ProgressionSummary({ versions }: { versions: VersionGroup[] }) {
  if (versions.length <= 1) return null

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
      {versions.map((v, i) => (
        <span key={v.version} className="flex items-center gap-1.5">
          <span
            className={`text-xs font-medium ${
              v.outcome === 'approved'
                ? 'text-emerald-400'
                : v.outcome === 'rejected'
                  ? 'text-destructive'
                  : 'text-muted-foreground'
            }`}
          >
            v{v.version}{' '}
            {v.outcome === 'approved' ? '✓' : v.outcome === 'rejected' ? '✗' : '…'}
          </span>
          {i < versions.length - 1 && <ArrowRight className="size-3 text-muted-foreground/50" />}
        </span>
      ))}
    </div>
  )
}

export function ReviewChain({ events }: ReviewChainProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        No review activity yet.
      </div>
    )
  }

  const versions = groupIntoVersions(events)

  return (
    <div className="flex flex-col gap-4">
      <ProgressionSummary versions={versions} />

      {versions.map((versionGroup, vIdx) => {
        const isApprovedVersion = versionGroup.outcome === 'approved'

        return (
          <div
            key={versionGroup.version}
            className={`rounded-lg border p-3 ${
              isApprovedVersion
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : 'border-border/50 bg-muted/10'
            }`}
          >
            <VersionBadge version={versionGroup.version} outcome={versionGroup.outcome} />

            <div className="flex flex-col gap-0">
              {versionGroup.events.map((event, i) => {
                const config = ACTION_CONFIG[event.action]
                const Icon = config.icon
                const isLastInGroup = i === versionGroup.events.length - 1
                const hasMoreVersions = vIdx < versions.length - 1

                return (
                  <div key={event.id} className="flex gap-3">
                    {/* Timeline connector */}
                    <div className="flex flex-col items-center">
                      <div className={`flex size-7 shrink-0 items-center justify-center rounded-full border ${config.bg}`}>
                        <Icon className={`size-4 ${config.color}`} />
                      </div>
                      {(!isLastInGroup || hasMoreVersions) && (
                        <div className="mt-1 w-px flex-1 min-h-[12px] bg-border" />
                      )}
                    </div>

                    {/* Event content */}
                    <div className="flex-1 pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                        <span className="text-xs text-muted-foreground">by {event.agent_name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {formatTime(event.created_at)}
                        </span>
                      </div>
                      {event.notes && (
                        <p className="mt-1 text-sm text-muted-foreground italic">
                          &ldquo;{event.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
