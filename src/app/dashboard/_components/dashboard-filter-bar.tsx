'use client'

import { X } from 'lucide-react'
import {
  DASHBOARD_STATUS_FILTERS,
  type DashboardStatusFilter,
} from '@/lib/dashboard-ui'
import { cn } from '@/lib/utils'

type PillarOption = {
  id: string
  name: string
  color: string
  count: number
}

interface DashboardFilterBarProps {
  activeFilterId: DashboardStatusFilter['id']
  onFilterChange: (filterId: DashboardStatusFilter['id']) => void
  statusCounts: Record<DashboardStatusFilter['id'], number>
  pillarOptions: PillarOption[]
  selectedPillarIds: Set<string>
  onTogglePillar: (pillarId: string) => void
  onClearPillars: () => void
  filteredCount: number
  totalCount: number
}

export function DashboardFilterBar({
  activeFilterId,
  onFilterChange,
  statusCounts,
  pillarOptions,
  selectedPillarIds,
  onTogglePillar,
  onClearPillars,
  filteredCount,
  totalCount,
}: DashboardFilterBarProps) {
  const hasPillarSelection = selectedPillarIds.size > 0

  return (
    <section className="dashboard-frame relative overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(145,255,88,0.12)_0%,transparent_72%)] blur-3xl" />

      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="premium-kicker text-[0.64rem]">Live Queue</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-foreground sm:text-3xl">
            Editorial pipeline
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-foreground/66">
            Filter the queue and focus on the posts that need attention first.
          </p>
        </div>

        <div className="dashboard-rail flex items-center gap-3 rounded-full px-4 py-2 text-sm text-foreground/70">
          <span className="inline-flex size-2 rounded-full bg-primary/80" />
          <span>
            {filteredCount} visible of {totalCount}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="dashboard-rail p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-foreground/56">
              Status
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {DASHBOARD_STATUS_FILTERS.map((filter) => {
              const active = filter.id === activeFilterId

              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => onFilterChange(filter.id)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-all',
                    active
                      ? 'border-border/80 bg-card text-foreground shadow-[0_10px_24px_-16px_rgba(0,0,0,0.38)]'
                      : 'border-border/50 bg-background/40 text-foreground/64 hover:border-border/75 hover:text-foreground'
                  )}
                >
                  <span>{filter.label}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[0.7rem]',
                      active ? 'bg-primary/14 text-primary' : 'bg-background/70 text-foreground/56'
                    )}
                  >
                    {statusCounts[filter.id]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {pillarOptions.length > 0 && (
          <div className="dashboard-rail p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-foreground/56">
                Pillars
              </p>

              {hasPillarSelection ? (
                <button
                  type="button"
                  onClick={onClearPillars}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                >
                  <X className="size-3.5" />
                  Clear
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onClearPillars}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-all',
                  !hasPillarSelection
                    ? 'border-border/80 bg-card text-foreground shadow-[0_10px_24px_-16px_rgba(0,0,0,0.38)]'
                    : 'border-border/50 bg-background/40 text-foreground/64 hover:border-border/75 hover:text-foreground'
                )}
              >
                <span>All pillars</span>
              </button>

              {pillarOptions.map((pillar) => {
                const active = selectedPillarIds.has(pillar.id)

                return (
                  <button
                    key={pillar.id}
                    type="button"
                    onClick={() => onTogglePillar(pillar.id)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-all',
                      active
                        ? 'border-border/80 bg-card text-foreground shadow-[0_10px_24px_-16px_rgba(0,0,0,0.38)]'
                        : 'border-border/50 bg-background/40 text-foreground/64 hover:border-border/75 hover:text-foreground'
                    )}
                  >
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ backgroundColor: pillar.color }}
                    />
                    <span>{pillar.name}</span>
                    <span className="text-xs text-foreground/45">{pillar.count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
