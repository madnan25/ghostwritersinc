'use client'

import { useTransition, useRef, useState, useEffect } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
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
  const [mobile, setMobile] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

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

  return (
    <>
      <Button variant="destructive" size="sm" onClick={handleOpen} className="min-h-[44px] px-4 sm:min-h-0">
        Reject
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
              animate={mobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
              exit={mobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 8 }}
              transition={
                mobile
                  ? { type: 'spring', stiffness: 380, damping: 32 }
                  : { duration: 0.2, ease: 'easeOut' }
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
              {/* Drag handle — mobile only */}
              {mobile && (
                <div className="mb-4 flex justify-center">
                  <div className="h-1 w-9 rounded-full bg-muted-foreground/30" />
                </div>
              )}

              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold">Reject Post</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Provide a reason so the agent knows what to improve.
                  </p>
                </div>
                {mobile && (
                  <button
                    onClick={handleClose}
                    className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95 transition-transform"
                    aria-label="Close"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. The hook isn't compelling enough. Try leading with a counterintuitive insight."
                rows={mobile ? 5 : 4}
                className={cn(
                  'w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm leading-relaxed',
                  'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50',
                )}
              />

              <div className={cn('mt-4 flex gap-3', mobile ? 'flex-col' : 'flex-row justify-end')}>
                <Button
                  variant="destructive"
                  onClick={handleSubmit}
                  disabled={isPending || !reason.trim()}
                  className={mobile ? 'h-[52px] rounded-2xl text-base' : ''}
                  size={mobile ? 'default' : 'sm'}
                >
                  {isPending ? 'Rejecting…' : 'Reject Post'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  disabled={isPending}
                  className={mobile ? 'h-[52px] rounded-2xl text-base' : ''}
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
