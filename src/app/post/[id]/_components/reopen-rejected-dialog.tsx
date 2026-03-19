'use client'

import { useState, useTransition, useRef } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { reopenRejectedPost } from '@/app/actions/posts'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

interface ReopenRejectedDialogProps {
  postId: string
  className?: string
}

export function ReopenRejectedDialog({ postId, className }: ReopenRejectedDialogProps) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const mobile = useMediaQuery('(max-width: 767px)')
  const overlayRef = useRef<HTMLDivElement>(null)

  function handleOpen() {
    setNotes('')
    setError(null)
    setOpen(true)
  }

  function handleClose() {
    if (isPending) return
    setOpen(false)
  }

  function handleSubmit() {
    if (!notes.trim()) {
      setError('Please provide notes for the revision.')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await reopenRejectedPost(postId, notes.trim())
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reopen post.')
      }
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" className={className} onClick={handleOpen}>
        Reopen for Revision
      </Button>

      <AnimatePresence>
        {open && (
          <m.div
            ref={overlayRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => { if (e.target === overlayRef.current) handleClose() }}
            className={cn(
              'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex',
              mobile ? 'items-end' : 'items-center justify-center p-4',
            )}
          >
            <m.div
              onClick={(e) => e.stopPropagation()}
              initial={mobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 8 }}
              animate={mobile
                ? { y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } }
                : { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] } }
              }
              exit={mobile
                ? { y: '100%', transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }
                : { opacity: 0, scale: 0.95, y: 8, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }
              }
              className={cn(
                'w-full bg-card border-border shadow-2xl',
                mobile
                  ? 'rounded-t-3xl border-t px-5 pt-3'
                  : 'max-w-md rounded-xl border p-6',
              )}
              style={
                mobile
                  ? { paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }
                  : undefined
              }
            >
              {mobile && (
                <div className="mb-4 flex justify-center">
                  <div className="h-1 w-9 rounded-full bg-muted-foreground/30" />
                </div>
              )}

              <div className="mb-4">
                <h2 className="text-base font-semibold">Reopen for Revision</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  This post has been through multiple cycles. Reopening resets the revision
                  count and re-queues it for a fresh start.
                </p>
              </div>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Explain what direction you want taken in this new revision…"
                rows={mobile ? 5 : 4}
                className={cn(
                  'w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm leading-relaxed',
                  'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50',
                )}
              />

              {error && (
                <p className="mt-2 text-sm text-destructive">{error}</p>
              )}

              <div className={cn('mt-4 flex gap-3', mobile ? 'flex-col' : 'flex-row justify-end')}>
                <Button
                  onClick={handleSubmit}
                  disabled={isPending || !notes.trim()}
                  className={mobile ? 'h-[52px] rounded-xl text-base' : ''}
                  size={mobile ? 'default' : 'sm'}
                >
                  {isPending ? 'Reopening…' : 'Reopen Post'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  disabled={isPending}
                  className={mobile ? 'h-[52px] rounded-xl text-base' : ''}
                  size={mobile ? 'default' : 'sm'}
                >
                  Cancel
                </Button>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  )
}
