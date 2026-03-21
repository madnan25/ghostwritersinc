'use client'

import { useTransition, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { m, AnimatePresence } from 'framer-motion'
import { X, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createHumanBriefRequest } from '@/app/actions/posts'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useModalPortal } from '@/hooks/use-modal-portal'
import { cn } from '@/lib/utils'

interface RequestPostButtonProps {
  className?: string
  size?: 'sm' | 'default'
}

export function RequestPostButton({ className, size = 'sm' }: RequestPostButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)} className={cn('gap-2', className)} size={size}>
        <PenLine className="size-3.5" />
        Request a Post
      </Button>
      <RequestPostDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function RequestPostDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [topic, setTopic] = useState('')
  const [angle, setAngle] = useState('')
  const [publishWeek, setPublishWeek] = useState('')
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal')
  const [notes, setNotes] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()
  const mobile = useMediaQuery('(max-width: 767px)')
  const overlayRef = useRef<HTMLDivElement>(null)
  const mounted = useModalPortal(open)

  function reset() {
    setTopic('')
    setAngle('')
    setPublishWeek('')
    setPriority('normal')
    setNotes('')
    setFieldError(null)
    setSubmitError(null)
    setSuccess(false)
  }

  function handleClose() {
    if (isPending) return
    onClose()
    setTimeout(reset, 200)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') handleClose()
  }

  function handleSubmit() {
    if (!topic.trim()) {
      setFieldError('Topic is required.')
      return
    }
    setFieldError(null)
    setSubmitError(null)

    startTransition(async () => {
      try {
        await createHumanBriefRequest({
          topic: topic.trim(),
          angle: angle.trim() || undefined,
          publishWeek: publishWeek || null,
          priority,
          notes: notes.trim() || undefined,
        })
        setSuccess(true)
        setTimeout(() => handleClose(), 1500)
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => {
            if (e.target === overlayRef.current) handleClose()
          }}
          className={cn(
            'fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex',
            mobile ? 'items-end' : 'items-center justify-center p-4',
          )}
        >
          <m.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-post-title"
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            initial={mobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 8 }}
            animate={
              mobile
                ? { y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } }
                : { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] } }
            }
            exit={
              mobile
                ? { y: '100%', transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }
                : { opacity: 0, scale: 0.95, y: 8, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }
            }
            className={cn(
              'w-full bg-card border-border shadow-2xl',
              mobile ? 'rounded-t-3xl border-t px-5 pt-3' : 'max-w-lg rounded-xl border p-6',
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

            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 id="request-post-title" className="text-base font-semibold">
                  Request a Post
                </h2>
                {!mobile && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Tell the team what to write about.
                  </p>
                )}
              </div>
              {mobile && (
                <button
                  onClick={handleClose}
                  className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-transform active:scale-95"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {success ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-green-500/15 text-lg text-green-400">
                  ✓
                </div>
                <p className="text-sm font-medium">Request submitted!</p>
                <p className="text-xs text-muted-foreground">
                  Your brief has been added to the queue.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Topic */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">
                    Topic <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={topic}
                    maxLength={500}
                    onChange={(e) => {
                      setTopic(e.target.value)
                      if (fieldError) setFieldError(null)
                    }}
                    placeholder="What should this post be about?"
                    className={cn(
                      'w-full rounded-xl border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50',
                      fieldError ? 'border-destructive' : 'border-input',
                    )}
                  />
                  {fieldError && (
                    <p className="mt-1 text-xs text-destructive">{fieldError}</p>
                  )}
                </div>

                {/* Angle/Hook */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">
                    Angle / Hook{' '}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={angle}
                    maxLength={2000}
                    onChange={(e) => setAngle(e.target.value)}
                    placeholder="Any specific direction or hook?"
                    className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Target Publish Week */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-foreground">
                      Target Week{' '}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <input
                      type="week"
                      value={publishWeek}
                      onChange={(e) => setPublishWeek(e.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                    />
                  </div>

                  {/* Priority toggle */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-foreground">
                      Priority
                    </label>
                    <div className="flex gap-1.5">
                      {(['normal', 'urgent'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={cn(
                            'flex-1 rounded-lg border py-2.5 text-xs font-medium capitalize transition-colors',
                            priority === p
                              ? p === 'urgent'
                                ? 'border-orange-500/50 bg-orange-500/15 text-orange-400'
                                : 'border-primary/50 bg-primary/15 text-primary'
                              : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground',
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">
                    Notes{' '}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <textarea
                    value={notes}
                    maxLength={5000}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Any additional context for the writer..."
                    className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                  />
                </div>

                {submitError && (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {submitError}
                  </p>
                )}

                <div className={cn('flex gap-3', mobile ? 'flex-col' : 'flex-row justify-end')}>
                  <Button
                    onClick={handleSubmit}
                    disabled={isPending || !topic.trim()}
                    className={mobile ? 'h-[52px] rounded-xl text-base' : ''}
                    size={mobile ? 'default' : 'sm'}
                  >
                    {isPending ? 'Submitting…' : 'Submit Request'}
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
              </div>
            )}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
