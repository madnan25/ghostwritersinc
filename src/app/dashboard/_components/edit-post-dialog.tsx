'use client'

import { useTransition, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { updatePostContent } from '@/app/actions/posts'
import { cn } from '@/lib/utils'

interface EditPostDialogProps {
  postId: string
  initialContent: string
}

export function EditPostDialog({ postId, initialContent }: EditPostDialogProps) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState(initialContent)
  const [isPending, startTransition] = useTransition()
  const overlayRef = useRef<HTMLDivElement>(null)

  function handleOpen() {
    setContent(initialContent)
    setOpen(true)
  }

  function handleClose() {
    if (isPending) return
    setOpen(false)
  }

  function handleSave() {
    if (!content.trim()) return
    startTransition(async () => {
      await updatePostContent(postId, content.trim())
      setOpen(false)
    })
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) handleClose()
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen}>
        Edit
      </Button>

      {open && (
        <div
          ref={overlayRef}
          onClick={handleOverlayClick}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-xl">
            <h2 className="text-base font-semibold">Edit Post</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Make changes to the post content below.
            </p>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              className={cn(
                'mt-4 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm',
                'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50',
              )}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleClose} disabled={isPending}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isPending || !content.trim()}
              >
                {isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
