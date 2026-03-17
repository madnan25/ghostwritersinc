import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAgentKeys, getAllRecentReviewEvents } from '@/lib/queries/agents'
import type { ReviewEvent } from '@/lib/types'

// Hardcoded metadata for known agents
const AGENT_META: Record<
  string,
  { icon: string; role: string; description: string; capabilities: string[] }
> = {
  Strategist: {
    icon: '🧠',
    role: 'Content Strategist',
    description: 'Plans content pillars, researches topics, and briefs the writing team.',
    capabilities: ['Topic research', 'Content briefs', 'Pillar planning', 'Audience targeting'],
  },
  Scribe: {
    icon: '✍️',
    role: 'Content Writer',
    description: 'Drafts LinkedIn posts from briefs, optimised for engagement and voice.',
    capabilities: ['Post drafting', 'Voice matching', 'Hook writing', 'CTA optimisation'],
  },
}

const DEFAULT_META = {
  icon: '🤖',
  role: 'Content Agent',
  description: 'AI-powered content assistant for the Ghostwriters Inc. platform.',
  capabilities: ['Content creation', 'Post review', 'Workflow automation'],
}

function formatRelativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  approved: { label: 'Approved', color: 'text-green-500 bg-green-500/10' },
  rejected: { label: 'Rejected', color: 'text-red-500 bg-red-500/10' },
  escalated: { label: 'Escalated', color: 'text-yellow-500 bg-yellow-500/10' },
}

interface AgentCardProps {
  name: string
  recentEvents: ReviewEvent[]
  isActive: boolean
}

function AgentCard({ name, recentEvents, isActive }: AgentCardProps) {
  const meta = AGENT_META[name] ?? DEFAULT_META

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-6 gap-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-2xl">
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{name}</h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                isActive
                  ? 'bg-green-500/10 text-green-500'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-muted-foreground'}`}
              />
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{meta.role}</p>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground">{meta.description}</p>

      {/* Capabilities */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Capabilities
        </p>
        <div className="flex flex-wrap gap-1.5">
          {meta.capabilities.map((cap) => (
            <span
              key={cap}
              className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
            >
              {cap}
            </span>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Recent Activity
        </p>
        {recentEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground">No recent activity</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recentEvents.map((event) => {
              const badge = ACTION_LABELS[event.action] ?? {
                label: event.action,
                color: 'text-muted-foreground bg-muted',
              }
              return (
                <li key={event.id} className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${badge.color}`}
                  >
                    {badge.label}
                  </span>
                  <span className="text-xs text-muted-foreground truncate flex-1">
                    {event.notes ? event.notes.slice(0, 40) + (event.notes.length > 40 ? '…' : '') : 'Post review'}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatRelativeTime(event.created_at)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export default async function TeamPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [agentKeys, recentEvents] = await Promise.all([
    getAgentKeys(),
    getAllRecentReviewEvents(50),
  ])

  // Merge DB agents with hardcoded known agents (Strategist, Scribe always show)
  const knownAgents = ['Strategist', 'Scribe']
  const dbAgentNames = agentKeys.map((k) => k.agent_name)
  const allAgentNames = Array.from(new Set([...knownAgents, ...dbAgentNames]))

  // Group recent events by agent
  const eventsByAgent: Record<string, ReviewEvent[]> = {}
  for (const event of recentEvents) {
    if (!eventsByAgent[event.agent_name]) eventsByAgent[event.agent_name] = []
    eventsByAgent[event.agent_name].push(event)
  }

  // An agent is "active" if it has a key in the DB or has recent events
  const activeAgentNames = new Set([
    ...dbAgentNames,
    ...recentEvents.map((e) => e.agent_name),
  ])

  return (
    <div className="container px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Content Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your AI content agents — {allAgentNames.length} team member
          {allAgentNames.length !== 1 ? 's' : ''}
        </p>
      </div>

      {allAgentNames.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-2xl">
            🤖
          </div>
          <h3 className="mt-4 text-base font-semibold">No agents yet</h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            Your content agents will appear here once they&apos;re set up.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {allAgentNames.map((name) => (
            <AgentCard
              key={name}
              name={name}
              recentEvents={(eventsByAgent[name] ?? []).slice(0, 5)}
              isActive={activeAgentNames.has(name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
