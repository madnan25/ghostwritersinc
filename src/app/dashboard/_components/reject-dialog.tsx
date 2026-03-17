'use client'

import { useTransition, useRef, useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { rejectPost } from '@/app/actions/posts'
import { cn } from '@/lib/utils'

interface RejectDialogProps {
  postId: string
}

export function RejectDialog({ postId }: RejectDialogProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()
  const overlayRef = useRef<HTMLDivElement>(null)

  function handleOpen() {
    setReason('')
    setOpen(true)
  }

  function handleClose() {
    if (isPending) return
    setOpen(false)
  }

  function handleSubmit() {
    if (!reason.trim()) return
    startTransition(async () => {
      await rejectPost(postId, reason.trim())
      setOpen(false)
    })
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) handleClose()
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={handleOpen}>
        Reject
      </Button>

      <AnimatePresence>
        {open && (
          <m.div
            ref={overlayRef}
            onClick={handleOverlayClick}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <m.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
            >
              <h2 className="text-base font-semibold">Reject Post</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Provide a reason so the agent knows what to improve.
              </p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. The hook isn't compelling enough. Try leading with a counterintuitive insight."
                rows={4}
                className={cn(
                  'mt-4 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm',
                  'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50',
                )}
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleClose} disabled={isPending}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleSubmit}
                  disabled={isPending || !reason.trim()}
                >
                  {isPending ? 'Rejecting…' : 'Reject Post'}
                </Button>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  )
}
