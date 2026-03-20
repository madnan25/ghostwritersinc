'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Archive, RotateCcw, CheckCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getStalenessState, STALENESS_CONFIG } from '@/lib/staleness'
import type { Post } from '@/lib/types'

interface StalenessPanelProps {
  post: Pick<Post, 'id' | 'freshness_type' | 'expiry_date' | 'archived_at' | 'status'>
}

/**
 * Staleness panel shown on post detail when a post has freshness metadata.
 *
 * Displays:
 * - Staleness badge (fresh / aging / flagged / archived)
 * - Expiry date for time_sensitive and date_locked posts
 * - Action buttons: Still Valid, Archive, Restore (context-aware)
 */
export function StalenessPanel({ post }: StalenessPanelProps) {
  const staleness = getStalenessState(post)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Don't render panel for evergreen posts with no expiry and no archive
  if (staleness === null) return null

  const config = STALENESS_CONFIG[staleness]

  async function callAction(path: string) {
    const res = await fetch(`/api/posts/${post.id}/${path}`, { method: 'POST' })
    if (!res.ok) {
      console.error(`[staleness-panel] ${path} failed:`, await res.text())
    }
    router.refresh()
  }

  function handleStillValid() {
    startTransition(() => callAction('still-valid'))
  }

  function handleArchive() {
    startTransition(() => callAction('archive'))
  }

  function handleRestore() {
    startTransition(() => callAction('restore'))
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
            {post.expiry_date && (
              <div className="mt-1 text-xs text-muted-foreground">
                {staleness === 'archived'
                  ? `Archived · was set to expire ${new Date(post.expiry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : staleness === 'flagged'
                    ? `Expired ${new Date(post.expiry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                    : `Expires ${new Date(post.expiry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
              </div>
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
                    onClick={() => router.push(`/post/${post.id}?action=request-update`)}
                    disabled={isPending}
                    className="gap-1.5"
                  >
                    <RefreshCw className="size-3.5" />
                    Request Update
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
