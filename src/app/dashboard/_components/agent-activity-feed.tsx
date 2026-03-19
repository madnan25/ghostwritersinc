'use client'

import { useMemo, useState } from 'react'
import { Activity, FileEdit, MessageSquare, RefreshCw, FilePlus } from 'lucide-react'
import { m, type Variants } from 'framer-motion'
import { useAgentActivityFeed } from '@/hooks/use-agent-activity-feed'
import type { AgentActionType } from '@/lib/types'

type AgentDirectory = Record<string, { name: string; job_title: string | null }>
const DEFAULT_VISIBLE_COUNT = 3

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

function getAgentDisplay(agentId: string, agentDirectory: AgentDirectory) {
  const agent = agentDirectory[agentId]
  if (!agent) {
    return {
      name: 'Commissioned agent',
      detail: 'Name unavailable',
    }
  }

  return {
    name: agent.name,
    detail: agent.job_title ?? 'Commissioned agent',
  }
}

function getActionDetail(actionType: AgentActionType): string {
  switch (actionType) {
    case 'draft_created':
      return 'Started a new draft in the editorial queue.'
    case 'draft_updated':
      return 'Updated an existing draft.'
    case 'review_submitted':
      return 'Sent a review decision into the workflow.'
    case 'status_changed':
      return 'Changed the state of a queued post.'
    case 'comment_added':
      return 'Left feedback on a draft.'
  }
}

function getPostTitle(metadata: Record<string, unknown>): string | null {
  const title = metadata.title
  if (typeof title === 'string' && title.trim().length > 0) return title.trim()
  return null
}

export function AgentActivityFeed({ agentDirectory }: { agentDirectory: AgentDirectory }) {
  const entries = useAgentActivityFeed(24, 48)
  const [expanded, setExpanded] = useState(false)
  const visibleEntries = useMemo(
    () => (expanded ? entries : entries.slice(0, DEFAULT_VISIBLE_COUNT)),
    [entries, expanded],
  )
  const hiddenCount = Math.max(entries.length - DEFAULT_VISIBLE_COUNT, 0)

  return (
    <section className="mt-10 sm:mt-12">
      <div className="dashboard-frame overflow-hidden p-5 sm:p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
          <p className="premium-kicker text-[0.64rem]">Live Feed</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-foreground sm:text-3xl">
            Agent Activity
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-foreground/66">
            Recent actions from your commissioned agents across the last 48 hours.
          </p>
          </div>
          <div className="dashboard-rail flex items-center gap-3 self-start rounded-full px-4 py-2 text-sm text-foreground/70 sm:self-auto">
            <span className="inline-flex size-2 rounded-full bg-primary/80" />
            <span>{entries.length} recent</span>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="dashboard-rail flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-background/65">
              <Activity className="size-5 text-foreground/40" />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground/60">No agent activity yet</p>
            <p className="mt-1 text-xs text-foreground/40">Actions will appear here in real time.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className={expanded ? 'max-h-[30rem] overflow-y-auto pr-1' : ''}>
              <m.ul
                variants={listVariants}
                initial="hidden"
                animate="visible"
                className="grid gap-3"
              >
                {visibleEntries.map((entry) => {
                  const agent = getAgentDisplay(entry.agent_id, agentDirectory)
                  const postTitle = getPostTitle(entry.metadata)

                  return (
                    <m.li
                      key={entry.id}
                      variants={itemVariants}
                      className="dashboard-rail flex items-start gap-4 rounded-[20px] px-4 py-4 sm:px-5"
                    >
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {ACTION_ICONS[entry.action_type]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {ACTION_LABELS[entry.action_type]}
                            </p>
                            <p className="mt-1 truncate text-sm text-foreground/74">
                              Agent: {agent.name}
                              <span className="text-foreground/46"> · {agent.detail}</span>
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-foreground/40">
                            {relativeTime(entry.created_at)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs leading-6 text-foreground/56">
                          {postTitle ? (
                            <em className="not-italic text-foreground/70">&ldquo;{postTitle}&rdquo;</em>
                          ) : (
                            getActionDetail(entry.action_type)
                          )}
                        </p>
                      </div>
                    </m.li>
                  )
                })}
              </m.ul>
            </div>

            {hiddenCount > 0 ? (
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  className="dashboard-rail inline-flex items-center rounded-full px-4 py-2 text-sm font-medium text-foreground/72 transition-colors hover:text-foreground"
                >
                  {expanded ? 'Show fewer' : `Unlock ${hiddenCount} more`}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  )
}
