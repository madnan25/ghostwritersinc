import type { PostComment } from '@/lib/types'
import { Bot, User } from 'lucide-react'

interface Props {
  comments: PostComment[]
}

function formatTime(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

export function CommentThread({ comments }: Props) {
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
        const isAgent = comment.author_type === 'agent'

        return (
          <div
            key={comment.id}
            className={
              isAgent
                ? 'rounded-lg border border-primary/20 bg-primary/5 p-3'
                : 'rounded-lg border border-border bg-card p-3'
            }
          >
            <div className="mb-1.5 flex items-center gap-2">
              {isAgent ? (
                <Bot className="size-3.5 shrink-0 text-primary/70" />
              ) : (
                <User className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className={`text-xs font-medium ${isAgent ? 'text-primary/90' : ''}`}>
                {comment.author_name ?? (isAgent ? 'Agent' : 'User')}
              </span>
              {isAgent && (
                <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-primary/80">
                  Agent
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">{formatTime(comment.created_at)}</span>
            </div>
            {comment.selected_text && (
              <blockquote className="mb-1.5 border-l-2 border-amber-400/60 pl-2 text-xs italic text-muted-foreground">
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
