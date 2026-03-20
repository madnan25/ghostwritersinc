'use client'

import Link from 'next/link'
import { Bot, Calendar, FileText, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Post } from '@/lib/types'
import { PostCardActions } from './post-card-actions'

type PillarBadge = {
  name: string
  color: string
}

interface CompactPostCardProps {
  post: Post
  pillar?: PillarBadge
  showSubBadge?: boolean
}

const SUB_BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  pending_review_agent: {
    label: 'Agent Reviewed',
    className: 'border-amber-400/50 bg-amber-500/10 text-amber-300',
  },
  pending_review: {
    label: 'Awaiting Agent',
    className: 'border-amber-300/24 text-amber-200',
  },
}

function getPostTitle(content: string): string {
  const [firstLine] = content
    .split('\n')
    .map((l) => l.trim().replace(/^[-*#>\s]+/, ''))
    .filter(Boolean)
  const title = firstLine || 'Untitled post'
  return title.length > 60 ? `${title.slice(0, 59)}…` : title
}

function getPostPreview(content: string): string {
  const lines = content
    .split('\n')
    .map((l) => l.trim().replace(/^[-*#>\s]+/, ''))
    .filter(Boolean)
  if (lines.length > 1) {
    const preview = lines.slice(1, 3).join(' ')
    return preview.length > 120 ? `${preview.slice(0, 119)}…` : preview
  }
  const [firstLine = ''] = lines
  return firstLine.length > 60 ? firstLine.slice(60, 180).trim() : ''
}

function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'No date'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    new Date(dateStr),
  )
}

export function CompactPostCard({ post, pillar, showSubBadge = false }: CompactPostCardProps) {
  const title = getPostTitle(post.content)
  const preview = getPostPreview(post.content)

  const subBadgeKey =
    post.status === 'pending_review' && post.reviewed_by_agent
      ? 'pending_review_agent'
      : post.status === 'pending_review'
        ? 'pending_review'
        : undefined

  const subBadge = showSubBadge && subBadgeKey ? SUB_BADGE_CONFIG[subBadgeKey] : undefined

  const publishDate =
    post.status === 'scheduled'
      ? post.scheduled_publish_at
      : post.status === 'published'
        ? post.published_at
        : post.suggested_publish_at

  return (
    <div
      className="group editorial-card relative flex flex-col gap-3 p-3.5"
      style={pillar ? { boxShadow: `inset 0 0 0 1px ${pillar.color}14` } : undefined}
    >
      {/* Sub-badge (only in In Review column) */}
      {subBadge && (
        <span
          className={cn(
            'inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[0.62rem] font-medium uppercase tracking-[0.14em]',
            subBadge.className,
          )}
        >
          {subBadge.label}
        </span>
      )}

      {/* Title */}
      <Link href={`/post/${post.id}`} className="block">
        <h4 className="line-clamp-1 text-sm font-semibold tracking-[-0.02em] text-foreground transition-colors group-hover:text-primary/92">
          {title}
        </h4>
      </Link>

      {/* Publish date */}
      <div className="flex items-center gap-1.5 text-[0.72rem]">
        <Calendar className="size-3 shrink-0 text-foreground/48" />
        <span
          className={cn(
            post.status === 'scheduled' ? 'text-sky-400/80' : 'text-foreground/56',
          )}
        >
          {formatShortDate(publishDate)}
        </span>
        {pillar && (
          <span
            className="ml-auto truncate text-[0.68rem]"
            style={{ color: pillar.color }}
          >
            {pillar.name}
          </span>
        )}
      </div>

      {/* Hover reveal: preview + agent attribution */}
      <div className="grid grid-rows-[0fr] transition-all duration-200 group-hover:grid-rows-[1fr]">
        <div className="overflow-hidden">
          <div className="space-y-2 pb-1 pt-0.5">
            {preview && (
              <p className="line-clamp-2 text-[0.74rem] leading-5 text-foreground/56">
                {preview}
              </p>
            )}
            {(post.created_by_agent || post.reviewed_by_agent || post.brief_ref) && (
              <div className="space-y-1">
                {post.created_by_agent && (
                  <div className="flex items-center gap-1 text-[0.7rem] text-foreground/52">
                    <Bot className="size-2.5 shrink-0" />
                    <span className="truncate">{post.created_by_agent}</span>
                  </div>
                )}
                {post.reviewed_by_agent && (
                  <div className="flex items-center gap-1 text-[0.7rem] text-foreground/52">
                    <User className="size-2.5 shrink-0" />
                    <span className="truncate">{post.reviewed_by_agent}</span>
                  </div>
                )}
                {post.brief_ref && (
                  <div className="flex items-center gap-1 text-[0.7rem] text-foreground/52">
                    <FileText className="size-2.5 shrink-0" />
                    <span className="truncate">{post.brief_ref}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="editorial-rule pt-0">
        <PostCardActions postId={post.id} status={post.status} content={post.content} compact />
      </div>
    </div>
  )
}
