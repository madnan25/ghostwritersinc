'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { saveScoutContext } from '@/app/actions/strategy'

interface ScoutInstructionsCardProps {
  initialContext: string | null
  initialUpdatedAt: string | null
}

export function ScoutInstructionsCard({
  initialContext,
  initialUpdatedAt,
}: ScoutInstructionsCardProps) {
  const [context, setContext] = useState(initialContext ?? '')
  const [lastSaved, setLastSaved] = useState<Date | null>(
    initialUpdatedAt ? new Date(initialUpdatedAt) : null,
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setError(null)
    startTransition(async () => {
      try {
        await saveScoutContext(context)
        setLastSaved(new Date())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save.')
      }
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Scout Instructions</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Research priorities and directions for the Scout agent
          </p>
        </div>
        {lastSaved && (
          <p className="shrink-0 text-xs text-muted-foreground">
            Updated{' '}
            {lastSaved.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>

      <textarea
        value={context}
        onChange={(e) => setContext(e.target.value)}
        rows={5}
        placeholder="e.g. Focus on AI infrastructure trends this week. Look for case studies on enterprise adoption..."
        className="w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
      />

      {error && (
        <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="mt-3 flex justify-end">
        <Button onClick={handleSave} disabled={isPending} size="sm">
          {isPending ? 'Saving…' : 'Save Instructions'}
        </Button>
      </div>
    </div>
  )
}
