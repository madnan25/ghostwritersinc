'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronDown, X } from 'lucide-react'
import { usePostsRealtimeSync } from '@/hooks/use-posts-realtime'
import { cn } from '@/lib/utils'
import type { ContentPillar, Post } from '@/lib/types'
import {
  filterPostsByPillars,
  getPillarFilterOptions,
  groupPostsByPipelineColumn,
  PIPELINE_COLUMN_DEFS,
  type PipelineColumnId,
} from '@/lib/dashboard-ui'
import { CompactPostCard } from './compact-post-card'

interface PipelineSwimlaneProps {
  posts: Post[]
  pillars: ContentPillar[]
}

function EmptyColumn() {
  return (
    <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-border/25 text-xs text-foreground/36">
      Empty
    </div>
  )
}

interface PillarDropdownProps {
  pillarOptions: ReturnType<typeof getPillarFilterOptions>
  selectedPillarIds: Set<string>
  onToggle: (id: string) => void
  onClear: () => void
}

function PillarDropdown({ pillarOptions, selectedPillarIds, onToggle, onClear }: PillarDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const selectedCount = selectedPillarIds.size
  const label = selectedCount > 0 ? `${selectedCount} pillar${selectedCount > 1 ? 's' : ''}` : 'Filter by pillar'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
          selectedCount > 0
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border/40 bg-background/50 text-foreground/60 hover:border-border/60 hover:text-foreground/80',
        )}
      >
        <span>{label}</span>
        {selectedCount > 0 && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onClear() }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onClear() }
            }}
            className="ml-0.5 cursor-pointer rounded-full text-primary/70 hover:text-primary"
            aria-label="Clear pillar filter"
          >
            <X className="size-3" />
          </span>
        )}
        <ChevronDown className={cn('size-3 text-foreground/50 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1.5 min-w-[180px] rounded-xl border border-border/40 bg-card p-1.5 shadow-xl">
          {pillarOptions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-foreground/50">No pillars</p>
          ) : (
            <>
              {pillarOptions.map((pillar) => {
                const active = selectedPillarIds.has(pillar.id)
                return (
                  <button
                    key={pillar.id}
                    type="button"
                    onClick={() => onToggle(pillar.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition-colors',
                      active
                        ? 'bg-primary/10 text-foreground'
                        : 'text-foreground/70 hover:bg-foreground/5 hover:text-foreground',
                    )}
                  >
                    <span
                      className="inline-block size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: pillar.color }}
                    />
                    <span className="flex-1 truncate">{pillar.name}</span>
                    <span className="text-foreground/40">{pillar.count}</span>
                    {active && <span className="size-1.5 rounded-full bg-primary" />}
                  </button>
                )
              })}
              {selectedCount > 0 && (
                <>
                  <div className="my-1 border-t border-border/30" />
                  <button
                    type="button"
                    onClick={() => { onClear(); setOpen(false) }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs text-foreground/56 transition-colors hover:bg-foreground/5 hover:text-foreground"
                  >
                    <X className="size-3" />
                    Clear filter
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function PipelineSwimlane({ posts: initialPosts, pillars }: PipelineSwimlaneProps) {
  const [posts, setPosts] = useState(initialPosts)
  const [alertDismissed, setAlertDismissed] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [selectedPillarIds, setSelectedPillarIds] = useState<Set<string>>(new Set())

  usePostsRealtimeSync(setPosts)

  const pillarMap = useMemo(
    () => new Map(pillars.map((p) => [p.id, p])),
    [pillars],
  )

  const pillarOptions = useMemo(
    () => getPillarFilterOptions(pillars, posts, 'all'),
    [pillars, posts],
  )

  const alertPosts = useMemo(
    () => posts.filter((p) => p.status === 'rejected' || p.status === 'publish_failed'),
    [posts],
  )

  const filteredPosts = useMemo(
    () => filterPostsByPillars(posts, selectedPillarIds),
    [posts, selectedPillarIds],
  )

  const columnGroups = useMemo(() => groupPostsByPipelineColumn(filteredPosts), [filteredPosts])

  const rejectedCount = alertPosts.filter((p) => p.status === 'rejected').length
  const failedCount = alertPosts.filter((p) => p.status === 'publish_failed').length

  function getAlertDescription() {
    if (rejectedCount > 0 && failedCount > 0) return 'rejected and publish failed'
    if (rejectedCount > 0) return 'rejected'
    return 'publish failed'
  }

  function getColumnPosts(id: PipelineColumnId) {
    return columnGroups[id]
  }

  function togglePillar(id: string) {
    setSelectedPillarIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function handleTabKeyDown(e: React.KeyboardEvent, idx: number) {
    const count = PIPELINE_COLUMN_DEFS.length
    let next: number | null = null
    if (e.key === 'ArrowRight') { e.preventDefault(); next = (idx + 1) % count }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); next = (idx - 1 + count) % count }
    else if (e.key === 'Home') { e.preventDefault(); next = 0 }
    else if (e.key === 'End') { e.preventDefault(); next = count - 1 }
    if (next !== null) {
      setActiveTab(next)
      document.getElementById(`pipeline-tab-${next}`)?.focus()
    }
  }

  return (
    <div className="space-y-4">
      {/* Alert bar for rejected/failed posts */}
      {!alertDismissed && alertPosts.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-500/8 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-400/80" />
          <div className="flex-1 text-sm">
            <span className="font-medium text-red-300">
              {alertPosts.length} post{alertPosts.length !== 1 ? 's' : ''} need attention
            </span>
            <span className="ml-1.5 text-red-300/68">— {getAlertDescription()}</span>
          </div>
          <button
            onClick={() => setAlertDismissed(true)}
            className="mt-0.5 shrink-0 text-red-300/60 transition-colors hover:text-red-300"
            aria-label="Dismiss alert"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Pillar filter dropdown */}
      {pillarOptions.length > 0 && (
        <div className="flex items-center gap-3">
          <PillarDropdown
            pillarOptions={pillarOptions}
            selectedPillarIds={selectedPillarIds}
            onToggle={togglePillar}
            onClear={() => setSelectedPillarIds(new Set())}
          />
          {selectedPillarIds.size > 0 && (
            <span className="text-xs text-foreground/50">
              {filteredPosts.length} post{filteredPosts.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Mobile: tabbed single-column view */}
      <div className="md:hidden">
        <div role="tablist" aria-label="Pipeline stages" className="flex gap-1 overflow-x-auto pb-2">
          {PIPELINE_COLUMN_DEFS.map((col, idx) => (
            <button
              key={col.id}
              id={`pipeline-tab-${idx}`}
              role="tab"
              aria-selected={activeTab === idx}
              aria-controls={`pipeline-panel-${col.id}`}
              tabIndex={activeTab === idx ? 0 : -1}
              onClick={() => setActiveTab(idx)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                activeTab === idx
                  ? 'border-primary/30 bg-primary/12 text-primary'
                  : 'border-border/40 text-foreground/60 hover:border-border/60 hover:text-foreground/80',
              )}
            >
              {col.label}
              <span
                className={cn(
                  'inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[0.6rem]',
                  activeTab === idx
                    ? 'bg-primary/20 text-primary'
                    : 'bg-foreground/8 text-foreground/56',
                )}
              >
                {getColumnPosts(PIPELINE_COLUMN_DEFS[idx].id).length}
              </span>
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`pipeline-panel-${PIPELINE_COLUMN_DEFS[activeTab].id}`}
          aria-labelledby={`pipeline-tab-${activeTab}`}
          tabIndex={0}
          className="space-y-2"
        >
          {getColumnPosts(PIPELINE_COLUMN_DEFS[activeTab].id).length === 0 ? (
            <EmptyColumn />
          ) : (
            getColumnPosts(PIPELINE_COLUMN_DEFS[activeTab].id).map((post) => (
              <CompactPostCard
                key={post.id}
                post={post}
                pillar={post.pillar_id ? pillarMap.get(post.pillar_id) : undefined}
                showSubBadge={PIPELINE_COLUMN_DEFS[activeTab].id === 'in_review'}
              />
            ))
          )}
        </div>
      </div>

      {/* Tablet: 2-column hybrid view (768px–1024px) */}
      <div className="hidden md:block lg:hidden">
        <div role="tablist" aria-label="Pipeline stages" className="mb-3 flex gap-1 overflow-x-auto pb-2">
          {PIPELINE_COLUMN_DEFS.map((col, idx) => (
            <button
              key={col.id}
              id={`pipeline-tab-tablet-${idx}`}
              role="tab"
              aria-selected={activeTab === idx}
              aria-controls={`pipeline-panel-tablet-${col.id}`}
              tabIndex={activeTab === idx ? 0 : -1}
              onClick={() => setActiveTab(idx)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                activeTab === idx
                  ? 'border-primary/30 bg-primary/12 text-primary'
                  : 'border-border/40 text-foreground/60 hover:border-border/60 hover:text-foreground/80',
              )}
            >
              {col.label}
              <span
                className={cn(
                  'inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[0.6rem]',
                  activeTab === idx
                    ? 'bg-primary/20 text-primary'
                    : 'bg-foreground/8 text-foreground/56',
                )}
              >
                {getColumnPosts(PIPELINE_COLUMN_DEFS[idx].id).length}
              </span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Primary panel: active tab */}
          {(() => {
            const col = PIPELINE_COLUMN_DEFS[activeTab]
            const colPosts = getColumnPosts(col.id)
            return (
              <div
                role="tabpanel"
                id={`pipeline-panel-tablet-${col.id}`}
                aria-labelledby={`pipeline-tab-tablet-${activeTab}`}
                tabIndex={0}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center justify-between rounded-lg border border-border/30 bg-background/40 px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.1em] text-foreground/68">{col.label}</span>
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-foreground/8 px-1.5 text-[0.65rem] font-medium text-foreground/56">
                    {colPosts.length}
                  </span>
                </div>
                <div className="flex max-h-[calc(100vh-380px)] min-h-[120px] flex-col gap-2 overflow-y-auto pr-0.5">
                  {colPosts.length === 0 ? (
                    <EmptyColumn />
                  ) : (
                    colPosts.map((post) => (
                      <CompactPostCard
                        key={post.id}
                        post={post}
                        pillar={post.pillar_id ? pillarMap.get(post.pillar_id) : undefined}
                        showSubBadge={col.id === 'in_review'}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })()}

          {/* Secondary panel: adjacent column (next, or previous when on last tab) */}
          {(() => {
            const adjIdx = activeTab < PIPELINE_COLUMN_DEFS.length - 1 ? activeTab + 1 : activeTab - 1
            const col = PIPELINE_COLUMN_DEFS[adjIdx]
            const colPosts = getColumnPosts(col.id)
            return (
              <div className="flex flex-col gap-2" aria-label={col.label}>
                <div className="flex items-center justify-between rounded-lg border border-border/30 bg-background/40 px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.1em] text-foreground/68">{col.label}</span>
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-foreground/8 px-1.5 text-[0.65rem] font-medium text-foreground/56">
                    {colPosts.length}
                  </span>
                </div>
                <div className="flex max-h-[calc(100vh-380px)] min-h-[120px] flex-col gap-2 overflow-y-auto pr-0.5">
                  {colPosts.length === 0 ? (
                    <EmptyColumn />
                  ) : (
                    colPosts.map((post) => (
                      <CompactPostCard
                        key={post.id}
                        post={post}
                        pillar={post.pillar_id ? pillarMap.get(post.pillar_id) : undefined}
                        showSubBadge={col.id === 'in_review'}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Desktop: horizontal swimlane (1024px+) */}
      <div className="hidden lg:flex lg:gap-3 lg:overflow-x-auto lg:pb-2">
        {PIPELINE_COLUMN_DEFS.map((col) => {
          const colPosts = getColumnPosts(col.id)
          return (
            <div key={col.id} aria-label={col.label} className="flex w-[260px] shrink-0 flex-col gap-2 xl:w-[280px]">
              {/* Column header */}
              <div className="flex items-center justify-between rounded-lg border border-border/30 bg-background/40 px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-foreground/68">
                  {col.label}
                </span>
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-foreground/8 px-1.5 text-[0.65rem] font-medium text-foreground/56">
                  {colPosts.length}
                </span>
              </div>

              {/* Column body — independent vertical scroll */}
              <div className="flex max-h-[calc(100vh-340px)] min-h-[120px] flex-col gap-2 overflow-y-auto pr-0.5">
                {colPosts.length === 0 ? (
                  <EmptyColumn />
                ) : (
                  colPosts.map((post) => (
                    <CompactPostCard
                      key={post.id}
                      post={post}
                      pillar={post.pillar_id ? pillarMap.get(post.pillar_id) : undefined}
                      showSubBadge={col.id === 'in_review'}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
