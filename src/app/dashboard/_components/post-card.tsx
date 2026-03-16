import Link from 'next/link'
import { Bot, Calendar, FileText, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Post } from '@/lib/types'
import { PostCardActions } from './post-card-actions'

interface PostCardProps {
  post: Post
}

const PILLAR_COLORS: Record<string, string> = {
  'thought-leadership': 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  'personal-story': 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  'industry-insight': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  'how-to': 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  'case-study': 'bg-rose-500/15 text-rose-400 border-rose-500/25',
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

export function PostCard({ post }: PostCardProps) {
  const hook = getHook(post.content)
  const pillarColor =
    post.pillar ? (PILLAR_COLORS[post.pillar] ?? 'bg-muted text-muted-foreground border-border') : null

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
      {/* Pillar tag */}
      {post.pillar && (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
              pillarColor,
            )}
          >
            {post.pillar}
          </span>
        </div>
      )}

      {/* Hook */}
      <Link href={`/post/${post.id}`} className="group block">
        <p className="line-clamp-3 text-sm leading-relaxed text-foreground group-hover:text-primary">
          {hook}
        </p>
      </Link>

      {/* Meta */}
      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Calendar className="size-3.5 shrink-0" />
          <span>{formatDate(post.suggested_publish_at)}</span>
        </div>
        {post.brief_ref && (
          <div className="flex items-center gap-1.5">
            <FileText className="size-3.5 shrink-0" />
            <span className="truncate">{post.brief_ref}</span>
          </div>
        )}
      </div>

      {/* Agent attribution */}
      <div className="flex flex-col gap-1 rounded-lg bg-muted/40 px-3 py-2 text-xs">
        {post.created_by_agent && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Bot className="size-3.5 shrink-0" />
            <span>
              Written by <span className="font-medium text-foreground">{post.created_by_agent}</span>
            </span>
          </div>
        )}
        {post.reviewed_by_agent && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <User className="size-3.5 shrink-0" />
            <span>
              Reviewed by{' '}
              <span className="font-medium text-foreground">{post.reviewed_by_agent}</span>
              {post.review_notes && (
                <span className="ml-1 italic">· &ldquo;{post.review_notes}&rdquo;</span>
              )}
            </span>
          </div>
        )}
        {!post.created_by_agent && !post.reviewed_by_agent && (
          <span className="text-muted-foreground">No agent attribution</span>
        )}
      </div>

      {/* Actions */}
      <PostCardActions postId={post.id} />
    </div>
  )
}
