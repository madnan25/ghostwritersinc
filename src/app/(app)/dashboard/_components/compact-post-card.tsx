'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { ArrowUpRight, Calendar } from 'lucide-react'
import { approvePost } from '@/app/actions/posts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Post } from '@/lib/types'

type PillarBadge = { name: string; color: string }

interface CompactPostCardProps {
  post: Post
  pillar?: PillarBadge
  showSubBadge?: boolean
}

const SUB_BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  pending_review_agent: {
    label: 'Agent Reviewed',
    className: 'border-primary/25 bg-primary/8 text-primary/82',
  },
  pending_review: {
    label: 'Awaiting Agent',
    className: 'border-border/45 bg-background/36 text-foreground/54',
  },
}

function normalizeContentLines(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim().replace(/^[-*#>\s]+/, ''))
    .filter(Boolean)
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1).trimEnd()}…`
}

function getPostTitle(content: string): string {
  const [firstLine] = normalizeContentLines(content)
  return truncateText(firstLine || 'Untitled post', 96)
}

function getPostPreview(content: string): string {
  const lines = normalizeContentLines(content)
  if (lines.length <= 1) return ''
  return truncateText(lines.slice(1, 3).join(' '), 140)
}

function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'No date'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    new Date(dateStr),
  )
}

function isStale(post: Post): boolean {
  if (post.status === 'published' || post.status === 'scheduled') return false
  const ref = post.suggested_publish_at
  return !!ref && new Date(ref) < new Date()
}

export function CompactPostCard({ post, pillar, showSubBadge = false }: CompactPostCardProps) {
  const [isPending, startTransition] = useTransition()

  const subBadgeKey =
    post.status === 'pending_review' && post.reviewed_by_agent
      ? 'pending_review_agent'
      : post.status === 'pending_review'
        ? 'pending_review'
        : undefined

  const subBadge = showSubBadge && subBadgeKey ? SUB_BADGE_CONFIG[subBadgeKey] : undefined
  const title = getPostTitle(post.content)
  const preview = getPostPreview(post.content)
  const stale = isStale(post)
  const publishDate =
    post.status === 'scheduled'
      ? post.scheduled_publish_at
      : post.status === 'published'
        ? post.published_at
        : post.suggested_publish_at

  const showApprove = post.status === 'pending_review'

  function handleApprove() {
    startTransition(async () => {
      await approvePost(post.id)
    })
  }

  return (
    <article
      className="group flex min-h-[152px] flex-col rounded-[22px] border border-border/60 bg-card/82 backdrop-blur-sm transition-all duration-150 hover:border-border/85 hover:bg-card/90 hover:shadow-[0_12px_32px_-18px_rgba(0,0,0,0.46)]"
      style={pillar ? { boxShadow: `inset 0 0 0 1px ${pillar.color}18` } : undefined}
    >
      <div className="flex flex-1 flex-col gap-3 px-3.5 pb-3 pt-3.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {subBadge && (
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[0.62rem] font-medium uppercase tracking-[0.12em]',
                  subBadge.className,
                )}
              >
                {subBadge.label}
              </span>
            )}
            {stale && (
              <span className="inline-flex items-center rounded-full border border-orange-400/28 bg-orange-500/10 px-2 py-0.5 text-[0.62rem] font-medium uppercase tracking-[0.12em] text-orange-300/80">
                Overdue
              </span>
            )}
          </div>
          {pillar && (
            <span
              className="max-w-[48%] truncate rounded-full border border-border/40 bg-background/28 px-2 py-0.5 text-[0.63rem] font-medium"
              style={{ color: pillar.color }}
              title={pillar.name}
            >
              {pillar.name}
            </span>
          )}
        </div>

        <Link href={`/post/${post.id}`} className="block space-y-2">
          <h4 className="line-clamp-3 text-[0.84rem] font-semibold leading-[1.35] tracking-[-0.022em] text-foreground/92 transition-colors group-hover:text-primary/90">
            {title}
          </h4>
          {preview ? (
            <p className="line-clamp-2 text-[0.72rem] leading-5 text-foreground/54">
              {preview}
            </p>
          ) : null}
        </Link>

        <div className="mt-auto flex items-center gap-1.5 text-[0.69rem]">
          <Calendar className="size-3 shrink-0 text-foreground/38" />
          <span
            className={cn(
              post.status === 'scheduled' ? 'text-sky-400/84' : 'text-foreground/46',
            )}
          >
            {formatShortDate(publishDate)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/42 px-3.5 py-2.5">
        <Link
          href={`/post/${post.id}`}
          className="inline-flex items-center gap-1 text-[0.72rem] font-medium text-foreground/58 transition-colors hover:text-foreground"
        >
          Open
          <ArrowUpRight className="size-3" />
        </Link>
        {showApprove ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 rounded-full border-primary/30 bg-primary/8 px-3 text-[0.72rem] text-primary/90 hover:border-primary/50 hover:bg-primary/14 hover:text-primary"
            onClick={handleApprove}
            disabled={isPending}
          >
            {isPending ? 'Approving…' : 'Approve'}
          </Button>
        ) : null}
      </div>
    </article>
  )
}
