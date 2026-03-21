'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { m, AnimatePresence } from 'framer-motion'
import { Calendar, Zap, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  publishToLinkedIn,
  schedulePost,
  cancelScheduledPost,
  reschedulePost,
} from '@/app/actions/posts'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useModalPortal } from '@/hooks/use-modal-portal'
import { cn } from '@/lib/utils'

interface PublishOptionsDialogProps {
  postId: string
  status: string
  scheduledPublishAt?: string | null
}

type Mode = 'choose' | 'schedule' | 'reschedule'

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function minDatetimeLocal(): string {
  return toDatetimeLocalValue(new Date(Date.now() + 60_000).toISOString())
}

function formatScheduledDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function PublishOptionsDialog({
  postId,
  status,
  scheduledPublishAt,
}: PublishOptionsDialogProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('choose')
  const [scheduledAt, setScheduledAt] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const mobile = useMediaQuery('(max-width: 767px)')
  const overlayRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const mounted = useModalPortal(open)

  const isScheduled = status === 'scheduled'

  function handleOpen() {
    setError(null)
    setMode('choose')
    setScheduledAt(scheduledPublishAt ? toDatetimeLocalValue(scheduledPublishAt) : '')
    setOpen(true)
  }

  function handleClose() {
    if (isPending) return
    setOpen(false)
  }

  function handlePublishNow() {
    setError(null)
    startTransition(async () => {
      const result = await publishToLinkedIn(postId)
      if (result.success) {
        setOpen(false)
        router.push('/dashboard')
      } else {
        setError(result.error ?? 'Failed to publish')
      }
    })
  }

  function handleSchedule() {
    if (!scheduledAt) {
      setError('Please select a date and time.')
      return
    }
    const publishAt = new Date(scheduledAt).toISOString()
    setError(null)
    startTransition(async () => {
      try {
        await schedulePost(postId, publishAt)
        setOpen(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to schedule post')
      }
    })
  }

  function handleReschedule() {
    if (!scheduledAt) {
      setError('Please select a new date and time.')
      return
    }
    const publishAt = new Date(scheduledAt).toISOString()
    setError(null)
    startTransition(async () => {
      try {
        await reschedulePost(postId, publishAt)
        setOpen(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reschedule post')
      }
    })
  }

  function handleCancelSchedule() {
    setError(null)
    startTransition(async () => {
      try {
        await cancelScheduledPost(postId)
        setOpen(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to cancel schedule')
      }
    })
  }

  return (
    <>
      <Button size="sm" onClick={handleOpen}>
        {isScheduled ? 'Manage Schedule' : 'Publish to LinkedIn'}
      </Button>

      {mounted
        ? createPortal(
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
                    'fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex',
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
                    style={mobile ? { paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' } : undefined}
                  >
              {/* Drag handle — mobile only */}
              {mobile && (
                <div className="mb-4 flex justify-center">
                  <div className="h-1 w-9 rounded-full bg-muted-foreground/30" />
                </div>
              )}

              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-semibold">
                    {mode === 'reschedule' ? 'Reschedule Post' : isScheduled ? 'Manage Schedule' : 'Publish to LinkedIn'}
                  </h2>
                  {mode === 'choose' && isScheduled && scheduledPublishAt && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Scheduled for <span className="text-foreground font-medium">{formatScheduledDate(scheduledPublishAt)}</span>
                    </p>
                  )}
                  {mode === 'choose' && !isScheduled && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Choose how to publish this post.
                    </p>
                  )}
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

              {/* Choose mode */}
              {mode === 'choose' && !isScheduled && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handlePublishNow}
                    disabled={isPending}
                    className={cn(
                      'flex flex-col items-center gap-2.5 rounded-xl border border-border p-4 text-left',
                      'hover:border-primary/40 hover:bg-muted/40 transition-colors',
                      'disabled:opacity-50',
                    )}
                  >
                    <Zap className="size-5 text-amber-400" />
                    <div>
                      <div className="text-sm font-medium">Publish Now</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">Post immediately to LinkedIn</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setMode('schedule')}
                    disabled={isPending}
                    className={cn(
                      'flex flex-col items-center gap-2.5 rounded-xl border border-border p-4 text-left',
                      'hover:border-primary/40 hover:bg-muted/40 transition-colors',
                      'disabled:opacity-50',
                    )}
                  >
                    <Calendar className="size-5 text-sky-400" />
                    <div>
                      <div className="text-sm font-medium">Schedule</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">Pick a date and time</div>
                    </div>
                  </button>
                </div>
              )}

              {/* Scheduled post — manage options */}
              {mode === 'choose' && isScheduled && (
                <div className="flex flex-col gap-2">
                  <Button
                    size={mobile ? 'default' : 'sm'}
                    onClick={handlePublishNow}
                    disabled={isPending}
                    className={mobile ? 'h-[52px] rounded-xl text-base' : ''}
                  >
                    {isPending ? 'Publishing…' : 'Publish Now'}
                  </Button>
                  <Button
                    variant="outline"
                    size={mobile ? 'default' : 'sm'}
                    onClick={() => setMode('reschedule')}
                    disabled={isPending}
                    className={mobile ? 'h-[52px] rounded-xl text-base' : ''}
                  >
                    Reschedule
                  </Button>
                  <Button
                    variant="ghost"
                    size={mobile ? 'default' : 'sm'}
                    onClick={handleCancelSchedule}
                    disabled={isPending}
                    className={cn(
                      'text-muted-foreground hover:text-foreground',
                      mobile ? 'h-[52px] rounded-xl text-base' : '',
                    )}
                  >
                    {isPending ? 'Cancelling…' : 'Cancel Schedule'}
                  </Button>
                </div>
              )}

              {/* Schedule date picker */}
              {(mode === 'schedule' || mode === 'reschedule') && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">
                      {mode === 'reschedule' ? 'New publish date & time' : 'Publish date & time'}
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      min={minDatetimeLocal()}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className={cn(
                        'w-full rounded-xl border border-input bg-background px-4 py-3 text-sm',
                        'focus:outline-none focus:ring-2 focus:ring-ring/50',
                        '[color-scheme:dark]',
                      )}
                    />
                  </div>

                  <div className={cn('flex gap-3', mobile ? 'flex-col' : 'flex-row justify-end')}>
                    <Button
                      size={mobile ? 'default' : 'sm'}
                      onClick={mode === 'reschedule' ? handleReschedule : handleSchedule}
                      disabled={isPending || !scheduledAt}
                      className={mobile ? 'h-[52px] rounded-xl text-base' : ''}
                    >
                      {isPending
                        ? (mode === 'reschedule' ? 'Rescheduling…' : 'Scheduling…')
                        : (mode === 'reschedule' ? 'Save New Schedule' : 'Schedule Post')}
                    </Button>
                    <Button
                      variant="outline"
                      size={mobile ? 'default' : 'sm'}
                      onClick={() => setMode('choose')}
                      disabled={isPending}
                      className={mobile ? 'h-[52px] rounded-xl text-base' : ''}
                    >
                      Back
                    </Button>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mt-3 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Desktop close button */}
              {!mobile && (
                <div className="mt-4 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={handleClose} disabled={isPending}>
                    Close
                  </Button>
                </div>
              )}
                  </m.div>
                </m.div>
              )}
            </AnimatePresence>,
            document.body
          )
        : null}
    </>
  )
}
