'use client'

import { useState, useTransition, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { m, AnimatePresence } from 'framer-motion'
import { X, ListOrdered, ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useModalPortal } from '@/hooks/use-modal-portal'
import { cn } from '@/lib/utils'
import type { SeriesCadence } from '@/lib/types'

interface PartOutline {
  angle: string
}

interface CreateSeriesWizardProps {
  open: boolean
  onClose: () => void
}

const CADENCE_OPTIONS: { value: SeriesCadence; label: string; description: string }[] = [
  { value: 'weekly', label: 'Weekly', description: 'One post per week' },
  { value: 'biweekly', label: 'Bi-weekly', description: 'Every two weeks' },
  { value: 'monthly', label: 'Monthly', description: 'Once a month' },
]

const STEP_LABELS = ['Setup', 'Outlines', 'Review']

export function CreateSeriesButton({
  className,
  size = 'sm',
}: {
  className?: string
  size?: 'sm' | 'default'
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)} className={cn('gap-2', className)} size={size}>
        <ListOrdered className="size-3.5" />
        Create Series
      </Button>
      <CreateSeriesWizard open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export function CreateSeriesWizard({ open, onClose }: CreateSeriesWizardProps) {
  const router = useRouter()
  const mobile = useMediaQuery('(max-width: 767px)')
  const overlayRef = useRef<HTMLDivElement>(null)
  const mounted = useModalPortal(open)

  // Step state
  const [step, setStep] = useState(0)

  // Step 1 fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [totalParts, setTotalParts] = useState(4)
  const [cadence, setCadence] = useState<SeriesCadence>('weekly')

  // Step 2 fields
  const [partOutlines, setPartOutlines] = useState<PartOutline[]>(
    Array.from({ length: 4 }, () => ({ angle: '' })),
  )

  // Status
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setStep(0)
    setTitle('')
    setDescription('')
    setTotalParts(4)
    setCadence('weekly')
    setPartOutlines(Array.from({ length: 4 }, () => ({ angle: '' })))
    setErrors({})
    setSubmitError(null)
  }

  function handleClose() {
    if (isPending) return
    onClose()
    setTimeout(reset, 300)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') handleClose()
  }

  // Sync outlines array length when totalParts changes
  function handleTotalPartsChange(n: number) {
    setTotalParts(n)
    setPartOutlines((prev) => {
      if (n > prev.length) {
        return [...prev, ...Array.from({ length: n - prev.length }, () => ({ angle: '' }))]
      }
      return prev.slice(0, n)
    })
  }

  function validateStep1() {
    const errs: Record<string, string> = {}
    if (!title.trim()) errs.title = 'Title is required.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function validateStep2() {
    const errs: Record<string, string> = {}
    partOutlines.forEach((p, i) => {
      if (!p.angle.trim()) errs[`part_${i}`] = 'Required'
    })
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleNext() {
    if (step === 0 && !validateStep1()) return
    if (step === 1 && !validateStep2()) return
    setStep((s) => s + 1)
  }

  function handleBack() {
    setErrors({})
    setStep((s) => s - 1)
  }

  function handleSubmit() {
    setSubmitError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/series', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            total_parts: totalParts,
            cadence,
            part_outlines: partOutlines.map((p, i) => ({
              part_number: i + 1,
              angle: p.angle.trim(),
            })),
          }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error ?? `Server error ${res.status}`)
        }

        const series = await res.json()
        handleClose()
        router.push(`/series/${series.id}`)
        router.refresh()
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
            aria-labelledby="create-series-title"
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
              mobile
                ? 'rounded-t-3xl border-t px-5 pt-3'
                : 'max-w-xl rounded-xl border p-6 max-h-[90vh] overflow-y-auto',
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

            {/* Header */}
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 id="create-series-title" className="text-base font-semibold">
                  Create Content Series
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Step {step + 1} of 3 — {STEP_LABELS[step]}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-transform active:scale-95 hover:bg-muted/80"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="mb-6 flex gap-1.5">
              {STEP_LABELS.map((label, i) => (
                <div
                  key={label}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors duration-300',
                    i <= step ? 'bg-primary' : 'bg-muted',
                  )}
                />
              ))}
            </div>

            {/* Step content */}
            <AnimatePresence mode="wait">
              {step === 0 && (
                <m.div
                  key="step-0"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.18 }}
                  className="flex flex-col gap-4"
                >
                  {/* Title */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-foreground">
                      Series Title <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      maxLength={200}
                      onChange={(e) => {
                        setTitle(e.target.value)
                        if (errors.title) setErrors((p) => ({ ...p, title: '' }))
                      }}
                      placeholder="e.g. Building in Public: My Startup Journey"
                      className={cn(
                        'w-full rounded-xl border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50',
                        errors.title ? 'border-destructive' : 'border-input',
                      )}
                    />
                    {errors.title && (
                      <p className="mt-1 text-xs text-destructive">{errors.title}</p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-foreground">
                      Description{' '}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <textarea
                      value={description}
                      maxLength={1000}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      placeholder="What is this series about? What arc or narrative does it follow?"
                      className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                    />
                  </div>

                  {/* Number of posts */}
                  <div>
                    <label className="mb-2 block text-xs font-medium text-foreground">
                      Number of Posts
                    </label>
                    <div className="flex gap-2">
                      {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => handleTotalPartsChange(n)}
                          className={cn(
                            'flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors',
                            totalParts === n
                              ? 'border-primary/50 bg-primary/15 text-primary'
                              : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground',
                          )}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cadence */}
                  <div>
                    <label className="mb-2 block text-xs font-medium text-foreground">
                      Posting Cadence
                    </label>
                    <div className="flex flex-col gap-2">
                      {CADENCE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setCadence(opt.value)}
                          className={cn(
                            'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                            cadence === opt.value
                              ? 'border-primary/50 bg-primary/10 text-foreground'
                              : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground',
                          )}
                        >
                          <div
                            className={cn(
                              'size-4 rounded-full border-2 transition-colors',
                              cadence === opt.value
                                ? 'border-primary bg-primary'
                                : 'border-muted-foreground',
                            )}
                          />
                          <div>
                            <p className="text-sm font-medium text-foreground">{opt.label}</p>
                            <p className="text-xs text-muted-foreground">{opt.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </m.div>
              )}

              {step === 1 && (
                <m.div
                  key="step-1"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.18 }}
                  className="flex flex-col gap-3"
                >
                  <p className="text-sm text-muted-foreground">
                    Give each part a topic or angle. These become the starting briefs for the Strategist.
                  </p>
                  {partOutlines.map((part, i) => (
                    <div key={i}>
                      <label className="mb-1.5 block text-xs font-medium text-foreground">
                        Part {i + 1}{' '}
                        <span className="text-destructive">*</span>
                      </label>
                      <textarea
                        value={part.angle}
                        maxLength={500}
                        onChange={(e) => {
                          const updated = [...partOutlines]
                          updated[i] = { angle: e.target.value }
                          setPartOutlines(updated)
                          if (errors[`part_${i}`]) setErrors((p) => ({ ...p, [`part_${i}`]: '' }))
                        }}
                        rows={2}
                        placeholder={`Topic or angle for Part ${i + 1}…`}
                        className={cn(
                          'w-full resize-none rounded-xl border bg-background px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50',
                          errors[`part_${i}`] ? 'border-destructive' : 'border-input',
                        )}
                      />
                      {errors[`part_${i}`] && (
                        <p className="mt-1 text-xs text-destructive">Part {i + 1} topic is required.</p>
                      )}
                    </div>
                  ))}
                </m.div>
              )}

              {step === 2 && (
                <m.div
                  key="step-2"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.18 }}
                  className="flex flex-col gap-4"
                >
                  <p className="text-sm text-muted-foreground">
                    Review your series before submitting to the Strategist.
                  </p>

                  <div className="rounded-xl border border-border bg-background/50 p-4 space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Title</p>
                      <p className="mt-0.5 text-sm font-medium">{title}</p>
                    </div>
                    {description && (
                      <div>
                        <p className="text-xs text-muted-foreground">Description</p>
                        <p className="mt-0.5 text-sm text-foreground/80">{description}</p>
                      </div>
                    )}
                    <div className="flex gap-6">
                      <div>
                        <p className="text-xs text-muted-foreground">Parts</p>
                        <p className="mt-0.5 text-sm font-medium">{totalParts} posts</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cadence</p>
                        <p className="mt-0.5 text-sm font-medium capitalize">{cadence}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium text-muted-foreground">Part Outlines</p>
                    {partOutlines.map((p, i) => (
                      <div
                        key={i}
                        className="flex gap-3 rounded-xl border border-border bg-background/50 px-4 py-3"
                      >
                        <span className="shrink-0 text-xs font-semibold text-primary">
                          {i + 1}
                        </span>
                        <p className="text-sm text-foreground/80">{p.angle}</p>
                      </div>
                    ))}
                  </div>

                  {submitError && (
                    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {submitError}
                    </p>
                  )}
                </m.div>
              )}
            </AnimatePresence>

            {/* Navigation */}
            <div
              className={cn(
                'mt-6 flex gap-3',
                mobile ? 'flex-col' : 'flex-row items-center justify-end',
              )}
            >
              {step > 0 && (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={isPending}
                  size={mobile ? 'default' : 'sm'}
                  className={cn('gap-1.5', mobile && 'h-[52px] rounded-xl text-base')}
                >
                  <ChevronLeft className="size-3.5" />
                  Back
                </Button>
              )}
              {step < 2 ? (
                <Button
                  onClick={handleNext}
                  size={mobile ? 'default' : 'sm'}
                  className={cn('gap-1.5', mobile && 'h-[52px] rounded-xl text-base')}
                >
                  Next
                  <ChevronRight className="size-3.5" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isPending}
                  size={mobile ? 'default' : 'sm'}
                  className={cn('gap-1.5', mobile && 'h-[52px] rounded-xl text-base')}
                >
                  {isPending ? (
                    'Creating…'
                  ) : (
                    <>
                      <Check className="size-3.5" />
                      Create Series
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isPending}
                size={mobile ? 'default' : 'sm'}
                className={cn(mobile && 'h-[52px] rounded-xl text-base')}
              >
                Cancel
              </Button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
