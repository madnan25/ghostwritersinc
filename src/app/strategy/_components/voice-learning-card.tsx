'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  confirmObservation,
  dismissObservation,
  editObservation,
} from '@/app/actions/strategy'
import type { VoiceObservation } from '@/lib/types'

const MIN_DIFFS = 5

interface VoiceLearningCardProps {
  observations: VoiceObservation[]
  diffCount: number
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const color =
    pct >= 80
      ? 'text-green-400 bg-green-500/10 border-green-500/25'
      : pct >= 60
        ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25'
        : 'text-muted-foreground bg-muted/40 border-border'
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${color}`}>
      {pct}% confidence
    </span>
  )
}

function ObservationRow({
  obs,
  onConfirm,
  onDismiss,
  onEdit,
}: {
  obs: VoiceObservation
  onConfirm: () => void
  onDismiss: () => void
  onEdit: (text: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(obs.observation)
  const [isPending, startTransition] = useTransition()

  function handleSaveEdit() {
    if (!draft.trim() || draft.trim() === obs.observation) {
      setEditing(false)
      return
    }
    startTransition(async () => {
      await onEdit(draft.trim())
      setEditing(false)
    })
  }

  function handleCancelEdit() {
    setDraft(obs.observation)
    setEditing(false)
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3.5">
      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            rows={3}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSaveEdit}
              disabled={isPending || !draft.trim()}
              className="h-7 px-3 text-xs"
            >
              {isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancelEdit}
              disabled={isPending}
              className="h-7 px-3 text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-start justify-between gap-3">
            <p className="text-sm leading-relaxed">{obs.observation}</p>
            <ConfidenceBadge confidence={obs.confidence} />
          </div>
          {obs.source_post_ids.length > 0 && (
            <p className="mb-2.5 text-xs text-muted-foreground">
              Based on {obs.source_post_ids.length} post{obs.source_post_ids.length !== 1 ? 's' : ''}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={onConfirm}
              disabled={isPending}
              className="h-7 bg-green-600 px-3 text-xs hover:bg-green-700"
            >
              Confirm
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
              disabled={isPending}
              className="h-7 px-3 text-xs"
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              disabled={isPending}
              className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export function VoiceLearningCard({ observations, diffCount }: VoiceLearningCardProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const pending = observations.filter((o) => o.status === 'pending')
  const confirmed = observations.filter((o) => o.status === 'confirmed')

  function handleAction(fn: () => Promise<void>) {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  // Empty state: not enough diffs yet
  if (diffCount < MIN_DIFFS) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-lg">
            🎙
          </div>
          <div>
            <h3 className="text-sm font-semibold">Voice Learning</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Need more published posts to detect patterns. Publish and approve at least{' '}
              {MIN_DIFFS} posts ({diffCount}/{MIN_DIFFS} so far).
            </p>
          </div>
        </div>
      </div>
    )
  }

  // No observations yet (diffs exist but analysis hasn't run)
  if (observations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-lg">
            🎙
          </div>
          <div>
            <h3 className="text-sm font-semibold">Voice Learning</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              No observations yet. The Strategist will analyze your editing patterns soon.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {/* Header */}
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-lg">
          🎙
        </div>
        <div>
          <h3 className="text-sm font-semibold">Voice Learning</h3>
          <p className="text-xs text-muted-foreground">
            Patterns detected from {diffCount} published post{diffCount !== 1 ? 's' : ''} · Review and confirm to improve future drafts
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {/* Pending observations */}
      {pending.length > 0 && (
        <div className="mb-5">
          <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pending review ({pending.length})
          </p>
          <div className="flex flex-col gap-2.5" aria-busy={isPending}>
            {pending.map((obs) => (
              <ObservationRow
                key={obs.id}
                obs={obs}
                onConfirm={() => handleAction(() => confirmObservation(obs.id))}
                onDismiss={() => handleAction(() => dismissObservation(obs.id))}
                onEdit={(text) => handleAction(() => editObservation(obs.id, text))}
              />
            ))}
          </div>
        </div>
      )}

      {/* Confirmed observations */}
      {confirmed.length > 0 && (
        <div>
          <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Learned preferences ({confirmed.length})
          </p>
          <div className="flex flex-col gap-2">
            {confirmed.map((obs) => (
              <div
                key={obs.id}
                className="flex items-start gap-2.5 rounded-lg border border-green-500/20 bg-green-500/5 px-3.5 py-2.5"
              >
                <span className="mt-0.5 text-green-400" aria-hidden>✓</span>
                <p className="text-sm leading-relaxed text-foreground/90">{obs.observation}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
