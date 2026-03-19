import { CheckCircle, XCircle, ArrowUpCircle, RefreshCw } from 'lucide-react'
import type { ReviewEvent } from '@/lib/types'

interface ReviewChainProps {
  events: ReviewEvent[]
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
  revised: {
    icon: RefreshCw,
    label: 'Revised',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
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

export function ReviewChain({ events }: ReviewChainProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        No review activity yet.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {events.map((event, i) => {
        const config = ACTION_CONFIG[event.action]
        const Icon = config.icon
        return (
          <div key={event.id} className="flex gap-3">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className={`flex size-7 items-center justify-center rounded-full border ${config.bg}`}>
                <Icon className={`size-4 ${config.color}`} />
              </div>
              {i < events.length - 1 && (
                <div className="mt-1 w-px flex-1 bg-border" />
              )}
            </div>
            {/* Content */}
            <div className="flex-1 pb-3">
              <div className="flex items-center gap-2">
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
  )
}
