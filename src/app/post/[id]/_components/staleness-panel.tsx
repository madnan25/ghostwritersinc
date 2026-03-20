'use client'

import { useTransition } from 'react'
import { Clock, Archive, RotateCcw, CheckCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getStalenessState, getStalenessTooltip, STALENESS_CONFIG } from '@/lib/staleness'
import type { Post } from '@/lib/types'
import {
  archivePost,
  restorePost,
  markPostStillValid,
  requestPostUpdate,
} from '@/app/actions/posts'

interface StalenessPanelProps {
  post: Pick<Post, 'id' | 'freshness_type' | 'expiry_date' | 'archived_at' | 'status'>
}

/**
 * Staleness panel shown on post detail when a post has freshness metadata.
 *
 * Displays:
 * - Staleness badge (fresh / aging / flagged / archived)
 * - Expiry date + days until/past expiry for time_sensitive and date_locked posts
 * - Action buttons: Still Valid, Request Update, Archive, Restore (context-aware)
 */
export function StalenessPanel({ post }: StalenessPanelProps) {
  const staleness = getStalenessState(post)
  const [isPending, startTransition] = useTransition()

  // Don't render panel for evergreen posts with no expiry and no archive
  if (staleness === null) return null

  const config = STALENESS_CONFIG[staleness]
  const tooltip = getStalenessTooltip(post)

  function handleStillValid() {
    startTransition(async () => { await markPostStillValid(post.id) })
  }

  function handleRequestUpdate() {
    startTransition(async () => { await requestPostUpdate(post.id) })
  }

  function handleArchive() {
    startTransition(async () => { await archivePost(post.id) })
  }

  function handleRestore() {
    startTransition(async () => { await restorePost(post.id) })
  }

  const isPublished = post.status === 'published'

  return (
    <div
      className={`rounded-[24px] border p-5 ${
        staleness === 'flagged'
          ? 'border-red-500/25 bg-red-500/5'
          : staleness === 'archived'
            ? 'border-border bg-muted/20'
            : staleness === 'aging'
              ? 'border-yellow-500/25 bg-yellow-500/5'
              : 'border-emerald-500/25 bg-emerald-500/5'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-primary/70">
                Content Freshness
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.12em] ${config.badgeClass}`}
              >
                {config.label}
              </span>
            </div>
            {tooltip && (
              <div className="mt-1 text-xs text-muted-foreground">{tooltip}</div>
            )}
            {staleness === 'archived' && !post.expiry_date && (
              <div className="mt-1 text-xs text-muted-foreground">This post has been archived</div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {!isPublished && (
          <div className="flex flex-wrap items-center gap-2">
            {staleness === 'archived' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestore}
                disabled={isPending}
                className="gap-1.5"
              >
                <RotateCcw className="size-3.5" />
                {isPending ? 'Restoring…' : 'Restore'}
              </Button>
            ) : (
              <>
                {post.freshness_type === 'time_sensitive' && (staleness === 'flagged' || staleness === 'aging') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStillValid}
                    disabled={isPending}
                    className="gap-1.5"
                  >
                    <CheckCircle className="size-3.5" />
                    {isPending ? 'Updating…' : 'Still Valid'}
                  </Button>
                )}
                {(staleness === 'flagged' || staleness === 'aging') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRequestUpdate}
                    disabled={isPending}
                    className="gap-1.5"
                  >
                    <RefreshCw className="size-3.5" />
                    {isPending ? 'Requesting…' : 'Request Update'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleArchive}
                  disabled={isPending}
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Archive className="size-3.5" />
                  {isPending ? 'Archiving…' : 'Archive'}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
