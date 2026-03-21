'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { ResearchPoolItem } from '@/lib/types'

type ExtendedItem = ResearchPoolItem & { pillar_name?: string; pillar_color?: string }

type StatusFilter = 'all' | 'new' | 'consumed'
type SortKey = 'created_at' | 'relevance_score'

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'consumed', label: 'Consumed' },
]

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-foreground/40">—</span>
  const pct = Math.round(score * 100)
  const color =
    pct >= 70 ? 'text-primary' : pct >= 40 ? 'text-foreground/76' : 'text-foreground/48'
  return <span className={cn('text-xs font-medium tabular-nums', color)}>{pct}%</span>
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[0.68rem] font-medium',
        status === 'new'
          ? 'bg-primary/14 text-primary'
          : 'bg-background/58 text-foreground/56'
      )}
    >
      {status}
    </span>
  )
}

interface ResearchPoolListProps {
  items: ExtendedItem[]
  pillars: Array<{ id: string; name: string; color: string }>
}

export function ResearchPoolList({ items, pillars }: ResearchPoolListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [pillarFilter, setPillarFilter] = useState<string>('all')
  const [minScore, setMinScore] = useState<string>('')
  const [sortBy, setSortBy] = useState<SortKey>('created_at')

  const filtered = useMemo(() => {
    let result = items

    if (statusFilter !== 'all') {
      result = result.filter((i) => i.status === statusFilter)
    }

    if (pillarFilter !== 'all') {
      result = result.filter((i) =>
        pillarFilter === '__unassigned__' ? !i.pillar_id : i.pillar_id === pillarFilter
      )
    }

    const threshold = parseFloat(minScore)
    if (!isNaN(threshold) && threshold > 0) {
      result = result.filter(
        (i) => i.relevance_score != null && i.relevance_score >= threshold / 100
      )
    }

    if (sortBy === 'relevance_score') {
      result = [...result].sort(
        (a, b) => (b.relevance_score ?? -1) - (a.relevance_score ?? -1)
      )
    }
    // created_at already sorted desc from server

    return result
  }, [items, statusFilter, pillarFilter, minScore, sortBy])

  const statusCounts = useMemo(
    () => ({
      all: items.length,
      new: items.filter((i) => i.status === 'new').length,
      consumed: items.filter((i) => i.status === 'consumed').length,
    }),
    [items]
  )

  const hasUnassigned = items.some((i) => !i.pillar_id)

  return (
    <section className="dashboard-frame relative overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(145,255,88,0.10)_0%,transparent_70%)] blur-3xl" />

      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="premium-kicker text-[0.64rem]">Research Items</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-foreground sm:text-3xl">
            Pool browser
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-foreground/66">
            Browse and filter all research items by status, pillar, or relevance score.
          </p>
        </div>
        <div className="dashboard-rail flex items-center gap-3 rounded-full px-4 py-2 text-sm text-foreground/70">
          <span className="inline-flex size-2 rounded-full bg-primary/80" />
          <span>
            {filtered.length} of {items.length}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="dashboard-rail mb-5 space-y-4 p-4">
        {/* Status tabs */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-foreground/56">
            Status
          </p>
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  'dashboard-pill',
                  statusFilter === tab.value && 'dashboard-pill-active'
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'ml-1.5 inline-flex size-4 items-center justify-center rounded-full text-[0.6rem] font-semibold tabular-nums',
                    statusFilter === tab.value
                      ? 'bg-primary/14 text-primary'
                      : 'bg-background/58 text-foreground/50'
                  )}
                >
                  {statusCounts[tab.value]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          {/* Pillar filter */}
          {(pillars.length > 0 || hasUnassigned) && (
            <div className="flex-1">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-foreground/56">
                Pillar
              </p>
              <select
                value={pillarFilter}
                onChange={(e) => setPillarFilter(e.target.value)}
                className="w-full rounded-[14px] border border-border/60 bg-background/42 px-3 py-2 text-sm text-foreground backdrop-blur-lg focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                <option value="all">All pillars</option>
                {pillars.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                {hasUnassigned && <option value="__unassigned__">Unassigned</option>}
              </select>
            </div>
          )}

          {/* Min score */}
          <div className="flex-1">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-foreground/56">
              Min Score (%)
            </p>
            <input
              type="number"
              min={0}
              max={100}
              step={5}
              placeholder="e.g. 50"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              className="w-full rounded-[14px] border border-border/60 bg-background/42 px-3 py-2 text-sm text-foreground placeholder-foreground/36 backdrop-blur-lg focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>

          {/* Sort */}
          <div className="flex-1">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-foreground/56">
              Sort by
            </p>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="w-full rounded-[14px] border border-border/60 bg-background/42 px-3 py-2 text-sm text-foreground backdrop-blur-lg focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              <option value="created_at">Date added</option>
              <option value="relevance_score">Relevance score</option>
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-background/65 text-2xl">
            ⊘
          </div>
          <h3 className="mt-4 text-base font-semibold">No items match this filter</h3>
          <p className="mt-1.5 max-w-sm text-sm text-foreground/60">
            Try adjusting the status, pillar, or score threshold.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/40 rounded-[22px] border border-border/60 bg-background/28">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <StatusBadge status={item.status} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/52">
                  {item.pillar_name && (
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block size-1.5 rounded-full"
                        style={{ backgroundColor: item.pillar_color ?? '#6b7280' }}
                      />
                      {item.pillar_name}
                    </span>
                  )}
                  {item.source_type && (
                    <span className="capitalize">{item.source_type}</span>
                  )}
                  {item.source_url && (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate max-w-[200px] hover:text-primary transition-colors"
                    >
                      {item.source_url}
                    </a>
                  )}
                  <span>{formatDate(item.created_at)}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <p className="text-[0.6rem] uppercase tracking-widest text-foreground/40">
                    Score
                  </p>
                  <ScoreBadge score={item.relevance_score} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
