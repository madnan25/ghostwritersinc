'use client'

import { useState, useTransition } from 'react'
import { addPostComment } from '@/app/actions/posts'
import { cn } from '@/lib/utils'

interface Props {
  postId: string
}

export function OverallCommentForm({ postId }: Props) {
  const [body, setBody] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    if (!body.trim()) return
    startTransition(async () => {
      await addPostComment(postId, body.trim())
      setBody('')
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add an overall comment on this post…"
        rows={3}
        className={cn(
          'w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm',
          'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50',
        )}
      />
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={isPending || !body.trim()}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {isPending ? 'Posting…' : 'Post comment'}
        </button>
      </div>
    </div>
  )
}
