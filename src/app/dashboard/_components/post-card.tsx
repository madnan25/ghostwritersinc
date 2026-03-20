'use client'

import Link from 'next/link'
import { Bot, Calendar, FileText, User } from 'lucide-react'
import { m } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { Post } from '@/lib/types'
import { PostCardActions } from './post-card-actions'

type PillarBadge = {
  name: string
  color: string
}

interface PostCardProps {
  post: Post
  pillar?: PillarBadge
  featured?: boolean
  variant?: 'default' | 'board'
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'editorial-chip' },
  pending_review: { label: 'Needs Review', className: 'editorial-chip border-amber-300/24 text-amber-200' },
  pending_review_agent: { label: 'Agent Reviewed — Needs Approval', className: 'editorial-chip border-amber-400/50 bg-amber-500/10 text-amber-300' },
  approved: { label: 'Approved', className: 'editorial-chip border-emerald-300/20 text-emerald-200' },
  scheduled: { label: 'Scheduled', className: 'editorial-chip border-sky-300/22 text-sky-200' },
  published: { label: 'Published', className: 'editorial-chip status-chip-live border-transparent' },
  revision: { label: 'Revision', className: 'editorial-chip border-amber-400/40 bg-amber-500/10 text-amber-300' },
  rejected: { label: 'Rejected', className: 'editorial-chip border-red-300/20 text-red-200' },
  publish_failed: { label: 'Publish Failed', className: 'editorial-chip border-red-300/30 text-red-200' },
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
  return truncateText(firstLine || 'Untitled post', 88)
}

function getPostPreview(content: string): string {
  const lines = normalizeContentLines(content)

  if (lines.length > 1) {
    return truncateText(lines.slice(1, 4).join(' '), 220)
  }

  const [firstLine = ''] = lines
  return firstLine.length > 88 ? truncateText(firstLine.slice(88).trim(), 180) : ''
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'No date set'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

export function PostCard({ post, pillar, featured = false, variant = 'default' }: PostCardProps) {
  const title = getPostTitle(post.content)
  const preview = getPostPreview(post.content)
  const statusKey =
    post.status === 'pending_review' && post.reviewed_by_agent ? 'pending_review_agent' : post.status
  const statusConfig = STATUS_CONFIG[statusKey]
  const hasAgentMeta = post.created_by_agent || post.reviewed_by_agent
  const isBoardCard = variant === 'board'

  return (
    <m.div
      whileHover={{
        y: -2,
      }}
      whileTap={{ scale: 0.995 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn(
        'editorial-card group flex h-full flex-col',
        isBoardCard ? 'gap-4 rounded-[24px] p-4' : 'gap-5 p-6',
        featured && 'min-h-[360px] justify-between md:p-7',
      )}
      style={pillar ? { boxShadow: `inset 0 0 0 1px ${pillar.color}14` } : undefined}
    >
      <div className="relative z-10 flex items-center gap-2 flex-wrap">
        {statusConfig && (
          <m.span
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'inline-flex items-center rounded-full border px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.16em]',
              statusConfig.className,
            )}
          >
            {statusConfig.label}
          </m.span>
        )}
        {pillar && (
          <m.span
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            className="editorial-chip"
            style={{
              color: pillar.color,
              borderColor: `${pillar.color}40`,
            }}
          >
            {pillar.name}
          </m.span>
        )}
      </div>

      <div className="editorial-rule" />

      <Link
        href={`/post/${post.id}`}
        className={cn(
          'relative z-10 block space-y-3',
          isBoardCard ? 'min-h-[84px]' : 'min-h-[96px]',
          featured && 'min-h-[140px]'
        )}
      >
        <h3
          className={cn(
            'font-semibold tracking-[-0.035em] text-foreground transition-colors duration-200 group-hover:text-primary/92',
            isBoardCard ? 'line-clamp-3 text-[1.02rem] leading-6' : 'line-clamp-2 text-lg leading-7',
            featured && 'max-w-2xl text-[1.7rem] leading-10 tracking-[-0.05em]',
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            'text-foreground/68 transition-colors duration-200 group-hover:text-foreground/82',
            isBoardCard ? 'line-clamp-3 text-[0.82rem] leading-6' : 'line-clamp-3 text-sm leading-7',
            featured && 'max-w-2xl text-[1.02rem] leading-8 md:line-clamp-4',
          )}
        >
          {preview || title}
        </p>
      </Link>

      <div className={cn('relative z-10 mt-auto', isBoardCard ? 'space-y-3' : 'space-y-4')}>
        <div className={cn('flex flex-col gap-2', featured && 'gap-3 md:flex-row md:flex-wrap md:gap-x-5')}>
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3.5 shrink-0" />
            {post.status === 'scheduled' && post.scheduled_publish_at ? (
              <span className="editorial-meta normal-case tracking-normal text-sky-400/80">
                Scheduled: {formatDate(post.scheduled_publish_at)}
              </span>
            ) : (
              <span className="editorial-meta normal-case tracking-normal text-foreground/56">{formatDate(post.suggested_publish_at)}</span>
            )}
          </div>
          {post.brief_ref && (
            <div className="flex items-center gap-1.5">
              <FileText className="size-3.5 shrink-0" />
              <span className="editorial-meta normal-case tracking-normal text-foreground/56 truncate">{post.brief_ref}</span>
            </div>
          )}
        </div>

        <div className="editorial-rule" />

        <div className={cn('px-0 py-0', featured && '')}>
          {hasAgentMeta ? (
            <div className={cn('space-y-2 text-xs', featured && 'md:grid md:grid-cols-2 md:gap-3 md:space-y-0')}>
              {post.created_by_agent && (
                <div className="flex items-center gap-1.5 text-foreground/66">
                  <Bot className="size-3.5 shrink-0" />
                  <span>
                    Drafted by <span className="font-medium text-foreground/88">{post.created_by_agent}</span>
                  </span>
                </div>
              )}
              {post.reviewed_by_agent && (
                <div className="flex items-center gap-1.5 text-foreground/66">
                  <User className="size-3.5 shrink-0" />
                  <span>
                    Reviewed by <span className="font-medium text-foreground/88">{post.reviewed_by_agent}</span>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-foreground/56">No agent attribution</span>
          )}
        </div>

        <div className={cn('editorial-rule', isBoardCard ? 'pt-3' : 'pt-4')}>
          <PostCardActions postId={post.id} status={post.status} content={post.content} compact={isBoardCard} />
        </div>
      </div>
    </m.div>
  )
}
