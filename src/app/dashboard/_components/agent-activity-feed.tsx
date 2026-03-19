'use client'

import { useMemo, useState } from 'react'
import { Activity, ChevronDown, ChevronUp, FileEdit, FilePlus, MessageSquare, RefreshCw } from 'lucide-react'
import { m, type Variants } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useAgentActivityFeed } from '@/hooks/use-agent-activity-feed'
import type { AgentActionType } from '@/lib/types'

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const ACTION_LABELS: Record<AgentActionType, string> = {
  draft_created: 'Draft created',
  draft_updated: 'Draft updated',
  review_submitted: 'Review submitted',
  status_changed: 'Status changed',
  comment_added: 'Comment added',
}

const ACTION_ICONS: Record<AgentActionType, React.ReactNode> = {
  draft_created: <FilePlus className="size-3.5" />,
  draft_updated: <FileEdit className="size-3.5" />,
  review_submitted: <Activity className="size-3.5" />,
  status_changed: <RefreshCw className="size-3.5" />,
  comment_added: <MessageSquare className="size-3.5" />,
}

const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } },
}

const COLLAPSED_VISIBLE_COUNT = 5

function getStartOfWeek(date = new Date()): Date {
  const start = new Date(date)
  const day = start.getDay()
  const daysSinceMonday = (day + 6) % 7
  start.setDate(start.getDate() - daysSinceMonday)
  start.setHours(0, 0, 0, 0)
  return start
}

export function AgentActivityFeed() {
  const entries = useAgentActivityFeed()
  const [showAll, setShowAll] = useState(false)
  const weeklyEntries = useMemo(() => {
    const startOfWeek = getStartOfWeek()
    return entries.filter((entry) => new Date(entry.created_at).getTime() >= startOfWeek.getTime())
  }, [entries])
  const hasMoreThisWeek = weeklyEntries.length > COLLAPSED_VISIBLE_COUNT
  const visibleEntries = showAll ? weeklyEntries : weeklyEntries.slice(0, COLLAPSED_VISIBLE_COUNT)

  return (
    <section className="dashboard-frame mt-8 p-5 sm:mt-10 sm:p-6">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="premium-kicker text-[0.64rem]">Live Feed</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-foreground sm:text-3xl">
            Agent Activity
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-foreground/66">
            Recent actions taken by your AI agents across the editorial pipeline.
          </p>
        </div>
        <div className="dashboard-rail flex items-center gap-3 rounded-full px-4 py-2 text-sm text-foreground/70">
          <span className="inline-flex size-2 rounded-full bg-primary/80" />
          <span>{weeklyEntries.length} this week</span>
        </div>
      </div>

      {weeklyEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-background/65">
            <Activity className="size-5 text-foreground/40" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground/60">No agent activity this week</p>
          <p className="mt-1 text-xs text-foreground/40">New actions will appear here in real time.</p>
        </div>
      ) : (
        <div className={cn('dashboard-rail overflow-hidden', hasMoreThisWeek && 'flex h-[360px] flex-col')}>
          <div className={cn(hasMoreThisWeek && 'min-h-0 flex-1', showAll && 'overflow-y-auto')}>
            <m.ul
              variants={listVariants}
              initial="hidden"
              animate="visible"
              className="divide-y divide-border/30"
            >
              {visibleEntries.map((entry) => (
                <m.li key={entry.id} variants={itemVariants} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {ACTION_ICONS[entry.action_type]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {ACTION_LABELS[entry.action_type]}
                      </span>
                      <span className="shrink-0 text-xs text-foreground/40">
                        {relativeTime(entry.created_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-foreground/60">
                      Agent:{' '}
                      <span className="font-mono text-foreground/80">
                        {entry.agent_id.slice(0, 8)}…
                      </span>
                      {entry.post_id && (
                        <>
                          {' · Post: '}
                          <span className="font-mono text-foreground/80">
                            {entry.post_id.slice(0, 8)}…
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </m.li>
              ))}
            </m.ul>
          </div>

          {hasMoreThisWeek && (
            <div className="border-t border-border/30 px-4 py-3">
              <button
                type="button"
                onClick={() => setShowAll((current) => !current)}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
              >
                {showAll ? (
                  <>
                    <ChevronUp className="size-4" />
                    Show fewer
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-4" />
                    See {weeklyEntries.length - COLLAPSED_VISIBLE_COUNT} more this week
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
