import type { PostComment } from '@/lib/types'
import { Bot, User } from 'lucide-react'

interface Props {
  comments: PostComment[]
  currentVersion: number
}

function formatTime(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

export function CommentThread({ comments, currentVersion }: Props) {
  if (comments.length === 0) {
    return (
      <p className="text-sm italic text-muted-foreground">
        No comments yet. Select text above to add an inline comment.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {comments.map((comment) => {
        const commentVersion = comment.content_version ?? 1
        const isOldVersion = commentVersion < currentVersion

        return (
          <div key={comment.id} className="rounded-lg border border-border bg-card p-3">
            <div className="mb-1.5 flex items-center gap-2">
              {comment.author_type === 'agent' ? (
                <Bot className="size-3.5 text-muted-foreground" />
              ) : (
                <User className="size-3.5 text-muted-foreground" />
              )}
              <span className="text-xs font-medium">
                {comment.author_name ??
                  (comment.author_type === 'agent' ? 'Agent' : 'User')}
              </span>
              {isOldVersion && (
                <span className="rounded border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[0.65rem] font-medium text-amber-300">
                  v{commentVersion}
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">{formatTime(comment.created_at)}</span>
            </div>
            {comment.selected_text && (
              <blockquote className="mb-1.5 border-l-2 border-amber-400/60 pl-2 text-xs italic text-muted-foreground">
                {isOldVersion && (
                  <span className="not-italic text-amber-300/70">v{commentVersion}: </span>
                )}
                {comment.selected_text}
              </blockquote>
            )}
            <p className="text-sm">{comment.body}</p>
          </div>
        )
      })}
    </div>
  )
}
