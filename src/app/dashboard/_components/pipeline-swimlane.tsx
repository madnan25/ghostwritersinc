'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { usePostsRealtimeSync } from '@/hooks/use-posts-realtime'
import { cn } from '@/lib/utils'
import type { ContentPillar, Post } from '@/lib/types'
import {
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

export function PipelineSwimlane({ posts: initialPosts, pillars }: PipelineSwimlaneProps) {
  const [posts, setPosts] = useState(initialPosts)
  const [alertDismissed, setAlertDismissed] = useState(false)
  const [activeTab, setActiveTab] = useState(0)

  usePostsRealtimeSync(setPosts)

  const pillarMap = useMemo(
    () => new Map(pillars.map((p) => [p.id, p])),
    [pillars],
  )

  const alertPosts = useMemo(
    () => posts.filter((p) => p.status === 'rejected' || p.status === 'publish_failed'),
    [posts],
  )

  const columnGroups = useMemo(() => groupPostsByPipelineColumn(posts), [posts])

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

      {/* Mobile: tabbed single-column view */}
      <div className="md:hidden">
        <div className="flex gap-1 overflow-x-auto pb-2">
          {PIPELINE_COLUMN_DEFS.map((col, idx) => (
            <button
              key={col.id}
              onClick={() => setActiveTab(idx)}
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

        <div className="space-y-2">
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

      {/* Desktop: horizontal swimlane */}
      <div className="hidden md:flex md:gap-3 md:overflow-x-auto md:pb-2">
        {PIPELINE_COLUMN_DEFS.map((col) => {
          const colPosts = getColumnPosts(col.id)
          return (
            <div key={col.id} className="flex w-[260px] shrink-0 flex-col gap-2 xl:w-[280px]">
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
