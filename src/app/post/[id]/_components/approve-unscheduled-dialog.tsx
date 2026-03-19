'use client'

import { useState, useTransition, useRef } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { approveAndSchedulePost } from '@/app/actions/posts'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

interface ApproveUnscheduledDialogProps {
  postId: string
  label?: string
  size?: 'sm' | 'default'
  className?: string
}

export function ApproveUnscheduledDialog({
  postId,
  label = 'Approve & Schedule',
  size = 'sm',
  className,
}: ApproveUnscheduledDialogProps) {
  const [open, setOpen] = useState(false)
  const [dateValue, setDateValue] = useState('')
  const [timeValue, setTimeValue] = useState('09:00')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const mobile = useMediaQuery('(max-width: 767px)')
  const overlayRef = useRef<HTMLDivElement>(null)

  const today = new Date().toISOString().split('T')[0]

  function handleOpen() {
    setDateValue('')
    setTimeValue('09:00')
    setError(null)
    setOpen(true)
  }

  function handleClose() {
    if (isPending) return
    setOpen(false)
  }

  function handleSubmit() {
    if (!dateValue) {
      setError('Please select a publish date.')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await approveAndSchedulePost(postId, `${dateValue}T${timeValue}:00`)
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to approve post.')
      }
    })
  }

  return (
    <>
      <Button size={size} className={className} onClick={handleOpen}>
        {label}
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
                  : 'max-w-sm rounded-xl border p-6',
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
                <h2 className="text-base font-semibold">Approve &amp; Schedule</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  No suggested date found. Choose when to schedule this post.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Publish Date
                  </label>
                  <input
                    type="date"
                    value={dateValue}
                    min={today}
                    onChange={(e) => setDateValue(e.target.value)}
                    className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Publish Time
                  </label>
                  <input
                    type="time"
                    value={timeValue}
                    onChange={(e) => setTimeValue(e.target.value)}
                    className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
              </div>

              <div className={cn('mt-4 flex gap-3', mobile ? 'flex-col' : 'flex-row justify-end')}>
                <Button
                  onClick={handleSubmit}
                  disabled={isPending || !dateValue}
                  className={mobile ? 'h-[52px] rounded-xl text-base' : ''}
                  size={mobile ? 'default' : 'sm'}
                >
                  {isPending ? 'Scheduling…' : 'Approve & Schedule'}
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
