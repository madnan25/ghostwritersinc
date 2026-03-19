'use client'

import { useState, useTransition } from 'react'
import { addPostComment } from '@/app/actions/posts'
import { ModalDialog } from '@/components/ui/modal-dialog'
import { cn } from '@/lib/utils'

interface Props {
  postId: string
  postStatus: string
}

export function OverallCommentForm({ postId, postStatus }: Props) {
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showWarning, setShowWarning] = useState(false)

  function handleSubmit() {
    if (!body.trim()) return
    if (postStatus === 'approved') {
      setShowWarning(true)
      return
    }
    doSubmit()
  }

  function doSubmit() {
    setShowWarning(false)
    setError(null)
    startTransition(async () => {
      try {
        await addPostComment(postId, body.trim())
        setBody('')
      } catch {
        setError('Failed to post comment. Please try again.')
      }
    })
  }

  return (
    <>
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
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
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

      <ModalDialog open={showWarning} onClose={() => setShowWarning(false)} titleId="revert-warning-title">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
          <h2 id="revert-warning-title" className="mb-2 text-base font-semibold text-foreground">
            Revert approved post?
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Commenting on this approved post will revert it to review status. The AI team will re-review based on your feedback before it can be re-approved.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowWarning(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={doSubmit}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Comment &amp; Revert
            </button>
          </div>
        </div>
      </ModalDialog>
    </>
  )
}
