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
      {comments.map((comment) => (
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
            <span className="ml-auto text-xs text-muted-foreground">{formatTime(comment.created_at)}</span>
          </div>
          {comment.selected_text && (
            <blockquote className="mb-1.5 border-l-2 border-amber-400/60 pl-2 text-xs italic text-muted-foreground">
              {comment.selected_text}
            </blockquote>
          )}
          <p className="text-sm">{comment.body}</p>
        </div>
      ))}
    </div>
  )
}
