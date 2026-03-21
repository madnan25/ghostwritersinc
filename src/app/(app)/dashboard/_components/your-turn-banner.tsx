'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { m, AnimatePresence } from 'framer-motion'
import { Bot, Calendar, RefreshCw, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Post } from '@/lib/types'
import { approvePost, publishToLinkedIn } from '@/app/actions/posts'
import { RejectDialog } from './reject-dialog'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPostTitle(content: string): string {
  const [firstLine] = content
    .split('\n')
    .map((l) => l.trim().replace(/^[-*#>\s]+/, ''))
    .filter(Boolean)
  const title = firstLine || 'Untitled post'
  return title.length > 80 ? `${title.slice(0, 79)}…` : title
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

type ActionableType = 'agent_reviewed' | 'publish_failed'

interface ActionablePost {
  post: Post
  type: ActionableType
}

function getActionablePosts(posts: Post[]): ActionablePost[] {
  const agentReviewed = posts
    .filter((p) => p.status === 'pending_review' && p.reviewed_by_agent)
    .map((post): ActionablePost => ({ post, type: 'agent_reviewed' }))

  const publishFailed = posts
    .filter((p) => p.status === 'publish_failed')
    .map((post): ActionablePost => ({ post, type: 'publish_failed' }))

  return [...agentReviewed, ...publishFailed]
}

// ---------------------------------------------------------------------------
// Banner row
// ---------------------------------------------------------------------------

function BannerRow({ item }: { item: ActionablePost }) {
  const { post, type } = item
  const [isApprovePending, startApproveTransition] = useTransition()
  const [isRetryPending, startRetryTransition] = useTransition()
  const [retryError, setRetryError] = useState<string | null>(null)

  const title = getPostTitle(post.content)
  const timeAgo = formatRelativeTime(post.updated_at)

  function handleApprove() {
    startApproveTransition(async () => {
      await approvePost(post.id)
    })
  }

  function handleRetry() {
    setRetryError(null)
    startRetryTransition(async () => {
      const result = await publishToLinkedIn(post.id)
      if (!result.success) {
        setRetryError(result.error ?? 'Publish failed. Try again.')
      }
    })
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Post info */}
      <div className="flex min-w-0 items-center gap-2.5">
        {type === 'agent_reviewed' ? (
          <Bot className="size-3.5 shrink-0 text-amber-400/80" />
        ) : (
          <RefreshCw className="size-3.5 shrink-0 text-red-400/80" />
        )}
        <div className="min-w-0">
          <Link
            href={`/post/${post.id}`}
            className="block truncate text-[0.84rem] font-medium text-foreground transition-colors hover:text-primary/90"
          >
            {title}
          </Link>
          <span className="text-[0.7rem] text-foreground/48">
            {type === 'agent_reviewed'
              ? `Reviewed by ${post.reviewed_by_agent} · ${timeAgo}`
              : `Publish failed · ${timeAgo}`}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
        <div className="flex items-center gap-2">
          {type === 'agent_reviewed' ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className={cn(
                  'h-7 border-emerald-500/28 bg-emerald-500/8 px-3 text-xs text-emerald-300',
                  'hover:border-emerald-500/40 hover:bg-emerald-500/16 hover:text-emerald-200',
                )}
                onClick={handleApprove}
                disabled={isApprovePending}
              >
                {isApprovePending ? 'Approving…' : 'Approve'}
              </Button>
              <RejectDialog
                postId={post.id}
                className="h-7 min-h-0 px-3 text-xs"
              />
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-border/60 px-3 text-xs text-foreground/72 hover:text-foreground"
                onClick={handleRetry}
                disabled={isRetryPending}
              >
                {isRetryPending ? 'Retrying…' : 'Retry'}
              </Button>
              <Link
                href={`/post/${post.id}`}
                className={cn(
                  'inline-flex h-7 items-center rounded-md border border-border/60 px-3',
                  'text-xs text-foreground/72 transition-colors hover:bg-accent hover:text-foreground',
                )}
              >
                <Calendar className="mr-1 size-3" />
                Reschedule
              </Link>
            </>
          )}
        </div>

        {retryError && (
          <p className="text-[0.68rem] text-red-400/80">{retryError}</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

interface YourTurnBannerProps {
  posts: Post[]
}

const BANNER_DISPLAY_LIMIT = 3

export function YourTurnBanner({ posts }: YourTurnBannerProps) {
  const allItems = getActionablePosts(posts)
  const visibleItems = allItems.slice(0, BANNER_DISPLAY_LIMIT)
  const hiddenCount = allItems.length - visibleItems.length

  return (
    <AnimatePresence>
      {allItems.length > 0 && (
        <m.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="editorial-card px-5 py-4"
          style={{
            boxShadow:
              'inset 0 0 0 1px rgba(251,191,36,0.10), 0 0 32px rgba(251,191,36,0.03)',
          }}
        >
          {/* Header */}
          <div className="mb-3 flex items-center gap-2">
            <Zap className="size-3.5 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-400/80">
              Your Turn
            </span>
            <span
              className={cn(
                'ml-0.5 inline-flex items-center rounded-full border px-2 py-0.5',
                'border-amber-400/20 bg-amber-500/8 text-[0.62rem] font-medium',
                'uppercase tracking-[0.12em] text-amber-300',
              )}
            >
              {allItems.length}
            </span>
          </div>

          {/* Divider */}
          <div className="editorial-rule mb-3" />

          {/* Rows */}
          <div className="space-y-0">
            {visibleItems.map((item, i) => (
              <div key={item.post.id}>
                {i > 0 && <div className="editorial-rule my-3" />}
                <BannerRow item={item} />
              </div>
            ))}
          </div>

          {/* Overflow indicator */}
          {hiddenCount > 0 && (
            <div className="mt-3 border-t border-amber-400/10 pt-3">
              <Link
                href="/dashboard"
                className="text-[0.72rem] font-medium text-amber-400/70 transition-colors hover:text-amber-300"
              >
                + {hiddenCount} more item{hiddenCount !== 1 ? 's' : ''} need your attention
              </Link>
            </div>
          )}
        </m.div>
      )}
    </AnimatePresence>
  )
}
