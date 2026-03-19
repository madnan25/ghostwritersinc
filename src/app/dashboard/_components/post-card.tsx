'use client'

import Link from 'next/link'
import { Bot, Calendar, FileText, GitBranch, User } from 'lucide-react'
import { m } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { ContentPillar, Post } from '@/lib/types'
import { PostCardActions } from './post-card-actions'

interface PostCardProps {
  post: Post
  pillar?: ContentPillar
  featured?: boolean
  hasRevisions?: boolean
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'editorial-chip' },
  pending_review: { label: 'Needs Review', className: 'editorial-chip border-amber-300/24 text-amber-200' },
  approved: { label: 'Approved', className: 'editorial-chip border-emerald-300/20 text-emerald-200' },
  scheduled: { label: 'Scheduled', className: 'editorial-chip border-sky-300/22 text-sky-200' },
  published: { label: 'Published', className: 'editorial-chip status-chip-live border-transparent' },
  rejected: { label: 'Rejected', className: 'editorial-chip border-red-300/20 text-red-200' },
}

function getHook(content: string): string {
  const lines = content.split('\n').filter((l) => l.trim())
  return lines.slice(0, 2).join('\n') || content.slice(0, 120)
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

export function PostCard({ post, pillar, featured = false, hasRevisions = false }: PostCardProps) {
  const hook = getHook(post.content)
  const statusConfig = STATUS_CONFIG[post.status]
  const hasAgentMeta = post.created_by_agent || post.reviewed_by_agent

  return (
    <m.div
      whileHover={{
        y: -2,
      }}
      whileTap={{ scale: 0.995 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn(
        'editorial-card group flex h-full flex-col gap-5 p-6',
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
        {hasRevisions && (
          <m.span
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="inline-flex items-center gap-1 rounded-full border border-sky-400/25 bg-sky-400/8 px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.12em] text-sky-300/80"
          >
            <GitBranch className="size-3" />
            Revised
          </m.span>
        )}
      </div>

      <div className="editorial-rule" />

      <Link href={`/post/${post.id}`} className={cn('relative z-10 block min-h-[96px]', featured && 'min-h-[140px]')}>
        <p
          className={cn(
            'line-clamp-4 text-[1.05rem] leading-8 tracking-[-0.03em] text-foreground/96 transition-colors duration-200 group-hover:text-foreground',
            featured && 'max-w-2xl text-[1.42rem] leading-10 tracking-[-0.045em] md:line-clamp-5',
          )}
        >
          {hook}
        </p>
      </Link>

      <div className="relative z-10 mt-auto space-y-4">
        <div className={cn('flex flex-col gap-2', featured && 'gap-3 md:flex-row md:flex-wrap md:gap-x-5')}>
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3.5 shrink-0" />
            {post.status === 'scheduled' && post.scheduled_publish_at ? (
              <span className="editorial-meta normal-case tracking-normal text-sky-400/80">
                Scheduled: {formatDate(post.scheduled_publish_at)}
              </span>
            ) : post.suggested_publish_at ? (
              <span className="editorial-meta normal-case tracking-normal text-sky-300/60">
                Suggested: {formatDate(post.suggested_publish_at)}
              </span>
            ) : (
              <span className="editorial-meta normal-case tracking-normal text-foreground/40">No date set</span>
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
                    Written by <span className="font-medium text-foreground/88">{post.created_by_agent}</span>
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

        <div className="editorial-rule pt-4">
          <PostCardActions
            postId={post.id}
            status={post.status}
            content={post.content}
            suggestedPublishAt={post.suggested_publish_at}
          />
        </div>
      </div>
    </m.div>
  )
}
