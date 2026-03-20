'use client'

import { useState, useTransition } from 'react'
import { X, Flag, RotateCcw, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FlaggedAnnotation } from './annotatable-post-content'

interface Props {
  postId: string
  annotations: FlaggedAnnotation[]
  maxAnnotations: number
  onRemove: (id: string) => void
  onReset: () => void
}

export function RevisionSidebar({ postId, annotations, maxAnnotations, onRemove, onReset }: Props) {
  const [isPending, startTransition] = useTransition()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const atMax = annotations.length >= maxAnnotations

  function handleSubmit() {
    if (annotations.length === 0) return
    setError(null)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/drafts/${postId}/targeted-revision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            annotations: annotations.map((a) => ({
              start_char: a.start,
              end_char: a.end,
              selected_text: a.text,
              instruction: a.note || '',
            })),
          }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error((body as { error?: string }).error ?? `Server error ${res.status}`)
        }
        setSubmitted(true)
        onReset()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to submit revisions. Please try again.')
      }
    })
  }

  if (submitted) {
    return (
      <div className="rounded-[20px] border border-emerald-500/30 bg-emerald-500/10 p-5">
        <p className="text-sm font-medium text-emerald-300">Targeted revision submitted!</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The writing agent will revise the flagged sections and generate a new version.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[20px] border border-border/60 bg-background/40 p-5 shadow-[0_14px_36px_-30px_rgba(0,0,0,0.5)]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag className="size-4 text-amber-400" />
          <h3 className="text-sm font-medium">Flagged for Revision</h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[0.72rem] font-medium tracking-wide ${
              atMax
                ? 'bg-amber-400/20 text-amber-300'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {annotations.length}/{maxAnnotations}
          </span>
          {annotations.length > 0 && (
            <button
              type="button"
              onClick={onReset}
              title="Clear all flags"
              className="rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {annotations.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Select text in the post content above and click &ldquo;Flag for revision&rdquo; to mark sections you&apos;d like rewritten.
        </p>
      )}

      {/* Annotation list */}
      {annotations.length > 0 && (
        <ul className="space-y-3">
          {annotations.map((ann, idx) => (
            <li
              key={ann.id}
              className="group flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2.5"
            >
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-[0.65rem] font-bold text-amber-300">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground/80">
                  &ldquo;{ann.text.length > 60 ? ann.text.slice(0, 60) + '…' : ann.text}&rdquo;
                </p>
                {ann.note && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{ann.note}</p>
                )}
                {!ann.note && (
                  <p className="mt-0.5 text-xs italic text-muted-foreground/60">No instruction added</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemove(ann.id)}
                className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                aria-label="Remove flag"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Max reached warning */}
      {atMax && (
        <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
          <p className="text-xs text-amber-300/90">
            Maximum reached. Submit these revisions, or consider requesting a full rewrite instead.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mt-3 text-xs text-destructive">{error}</p>
      )}

      {/* Submit */}
      {annotations.length > 0 && (
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={isPending}
          className="mt-4 w-full bg-amber-500 text-black hover:bg-amber-400"
        >
          {isPending ? 'Submitting…' : `Submit ${annotations.length} Targeted Revision${annotations.length !== 1 ? 's' : ''}`}
        </Button>
      )}
    </div>
  )
}
