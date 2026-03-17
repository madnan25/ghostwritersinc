'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContentPillar, Post, PostStatus } from '@/lib/types'
import type { RotationWarning } from '../page'
import { PostCard } from './post-card'

interface FilterTab {
  label: string
  statuses: PostStatus[] | null // null = All
}

const TABS: FilterTab[] = [
  { label: 'All', statuses: null },
  { label: 'Needs Review', statuses: ['pending_review', 'agent_review'] },
  { label: 'Drafts', statuses: ['draft'] },
  { label: 'Approved', statuses: ['approved', 'scheduled'] },
  { label: 'Published', statuses: ['published', 'rejected'] },
]

interface PostGridProps {
  posts: Post[]
  pillars: ContentPillar[]
  rotationWarnings: RotationWarning[]
}

export function PostGrid({ posts, pillars, rotationWarnings }: PostGridProps) {
  const [activeTab, setActiveTab] = useState(0)
  const [selectedPillarIds, setSelectedPillarIds] = useState<Set<string>>(new Set())
  const [legendExpanded, setLegendExpanded] = useState(false)

  const pillarMap = new Map(pillars.map((p) => [p.id, p]))

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

  const afterStatus =
    TABS[activeTab].statuses === null
      ? posts
      : posts.filter((p) => (TABS[activeTab].statuses as PostStatus[]).includes(p.status))

  const filtered =
    selectedPillarIds.size === 0
      ? afterStatus
      : afterStatus.filter((p) => p.pillar_id && selectedPillarIds.has(p.pillar_id))

  function getTabCount(tab: FilterTab): number {
    const statusFiltered =
      tab.statuses === null
        ? posts
        : posts.filter((p) => (tab.statuses as PostStatus[]).includes(p.status))
    if (selectedPillarIds.size === 0) return statusFiltered.length
    return statusFiltered.filter((p) => p.pillar_id && selectedPillarIds.has(p.pillar_id)).length
  }

  // Distribution: actual post counts per pillar
  const totalPosts = posts.filter((p) => p.pillar_id).length

  return (
    <div className="flex flex-col gap-6">
      {/* Rotation warning banner */}
      {rotationWarnings.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
          {rotationWarnings.map((w) => (
            <div key={w.pillar_id} className="flex items-start gap-2.5 text-sm text-amber-400">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{w.suggestion}</span>
            </div>
          ))}
        </div>
      )}

      {/* Pillar distribution widget */}
      {pillars.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Pillar Distribution</p>
            <button
              onClick={() => setLegendExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground md:hidden"
            >
              {legendExpanded ? (
                <>Hide <ChevronUp className="size-3" /></>
              ) : (
                <>Details <ChevronDown className="size-3" /></>
              )}
            </button>
          </div>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
            {pillars.map((pillar) => {
              const count = posts.filter((p) => p.pillar_id === pillar.id).length
              const pct = totalPosts > 0 ? (count / totalPosts) * 100 : 0
              if (pct === 0) return null
              return (
                <button
                  key={pillar.id}
                  title={`${pillar.name}: ${count} post${count !== 1 ? 's' : ''} (target ${pillar.weight_pct}%)`}
                  onClick={() => togglePillar(pillar.id)}
                  className="h-full cursor-pointer transition-opacity hover:opacity-80"
                  style={{ width: `${pct}%`, backgroundColor: pillar.color }}
                />
              )
            })}
          </div>
          <div className={cn('flex-wrap gap-x-4 gap-y-1', legendExpanded ? 'flex' : 'hidden md:flex')}>
            {pillars.map((pillar) => {
              const count = posts.filter((p) => p.pillar_id === pillar.id).length
              const actual = totalPosts > 0 ? Math.round((count / totalPosts) * 100) : 0
              return (
                <button
                  key={pillar.id}
                  onClick={() => togglePillar(pillar.id)}
                  className={cn(
                    'flex items-center gap-1.5 text-xs transition-opacity',
                    selectedPillarIds.size > 0 && !selectedPillarIds.has(pillar.id)
                      ? 'opacity-40'
                      : 'opacity-100',
                  )}
                >
                  <span
                    className="inline-block size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: pillar.color }}
                  />
                  <span className="text-muted-foreground">
                    {pillar.name}
                    <span className="ml-1 tabular-nums">
                      {actual}% <span className="text-muted-foreground/60">/ {pillar.weight_pct}% target</span>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Pillar filter pills */}
      {pillars.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setSelectedPillarIds(new Set())}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              selectedPillarIds.size === 0
                ? 'border-border bg-background text-foreground shadow-sm'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            All Pillars
          </button>
          {pillars.map((pillar) => {
            const active = selectedPillarIds.has(pillar.id)
            return (
              <button
                key={pillar.id}
                onClick={() => togglePillar(pillar.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'border-transparent text-foreground shadow-sm'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
                style={
                  active
                    ? { backgroundColor: `${pillar.color}26`, color: pillar.color, borderColor: `${pillar.color}40` }
                    : undefined
                }
              >
                <span
                  className="inline-block size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: pillar.color }}
                />
                {pillar.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted/40 p-1">
        {TABS.map((tab, i) => {
          const count = getTabCount(tab)
          return (
            <button
              key={tab.label}
              onClick={() => setActiveTab(i)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                i === activeTab
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs tabular-nums',
                  i === activeTab
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Grid or empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-2xl">
            ✓
          </div>
          <h3 className="mt-4 text-base font-semibold">
            {activeTab === 0 && selectedPillarIds.size === 0 ? 'No posts yet' : 'No posts match this filter'}
          </h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            {activeTab === 0 && selectedPillarIds.size === 0
              ? 'Your agents are working on the next batch.'
              : 'Try adjusting the status tab or pillar filter.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              pillar={post.pillar_id ? pillarMap.get(post.pillar_id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}
