'use client'

import { useTransition, useRef, useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { Calendar, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { schedulePost } from '@/app/actions/posts'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

interface ScheduleDialogProps {
  postId: string
  suggestedPublishAt?: string | null
}

/** Convert an ISO datetime string to the value expected by <input type="datetime-local"> */
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  // Format: YYYY-MM-DDTHH:MM (no seconds, no timezone — browser uses local time)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

function formatSuggested(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function ScheduleDialog({ postId, suggestedPublishAt }: ScheduleDialogProps) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [isPending, startTransition] = useTransition()
  const mobile = useMediaQuery('(max-width: 767px)')
  const overlayRef = useRef<HTMLDivElement>(null)

  function handleOpen() {
    // Pre-fill with suggested date if available, otherwise blank
    setValue(suggestedPublishAt ? toDatetimeLocal(suggestedPublishAt) : '')
    setOpen(true)
  }

  function handleClose() {
    if (isPending) return
    setOpen(false)
  }

  function handleAcceptSuggestion() {
    if (!suggestedPublishAt) return
    setValue(toDatetimeLocal(suggestedPublishAt))
  }

  function handleSubmit() {
    if (!value) return
    startTransition(async () => {
      await schedulePost(postId, new Date(value).toISOString())
      setOpen(false)
    })
  }

  const hasSuggestion = Boolean(suggestedPublishAt)
  const suggestionIsSelected = hasSuggestion && value === toDatetimeLocal(suggestedPublishAt!)

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="min-h-[40px] flex-1 sm:flex-none sm:min-h-0 border-border/60 bg-transparent text-foreground/72 hover:border-primary/22 hover:bg-background/34 hover:text-foreground"
        onClick={handleOpen}
      >
        <Calendar className="mr-1.5 size-3.5" />
        Schedule
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
              {/* Drag handle — mobile only */}
              {mobile && (
                <div className="mb-4 flex justify-center">
                  <div className="h-1 w-9 rounded-full bg-muted-foreground/30" />
                </div>
              )}

              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold">Schedule Post</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Choose when this post goes live.
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

              {/* Suggested date banner */}
              {hasSuggestion && (
                <div className={cn(
                  'mb-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm transition-colors',
                  suggestionIsSelected
                    ? 'border-emerald-500/30 bg-emerald-500/8 text-emerald-300'
                    : 'border-sky-500/25 bg-sky-500/8 text-sky-300',
                )}>
                  <div className="flex items-center gap-2 min-w-0">
                    {suggestionIsSelected
                      ? <Check className="size-3.5 shrink-0 text-emerald-400" />
                      : <Calendar className="size-3.5 shrink-0 text-sky-400" />
                    }
                    <div className="min-w-0">
                      <span className="block text-xs font-medium uppercase tracking-wider opacity-70 mb-0.5">
                        {suggestionIsSelected ? 'Suggestion applied' : 'Strategist suggests'}
                      </span>
                      <span className="block truncate font-medium">
                        {formatSuggested(suggestedPublishAt!)}
                      </span>
                    </div>
                  </div>
                  {!suggestionIsSelected && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 h-8 border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 hover:text-sky-200 text-xs"
                      onClick={handleAcceptSuggestion}
                    >
                      Accept
                    </Button>
                  )}
                </div>
              )}

              {/* Datetime picker */}
              <div className="space-y-1.5 mb-5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {hasSuggestion ? 'Or pick a custom date' : 'Publish date & time'}
                </label>
                <input
                  type="datetime-local"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className={cn(
                    'w-full rounded-xl border border-input bg-background px-4 py-3 text-sm leading-relaxed',
                    'text-foreground placeholder:text-muted-foreground',
                    'focus:outline-none focus:ring-2 focus:ring-ring/50',
                    '[color-scheme:dark]',
                  )}
                />
              </div>

              <div className={cn('flex gap-3', mobile ? 'flex-col' : 'flex-row justify-end')}>
                <Button
                  onClick={handleSubmit}
                  disabled={isPending || !value}
                  className={mobile ? 'h-[52px] rounded-xl text-base' : ''}
                  size={mobile ? 'default' : 'sm'}
                >
                  {isPending ? 'Scheduling…' : 'Schedule Post'}
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
