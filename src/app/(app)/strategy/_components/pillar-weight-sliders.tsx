'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { updatePillarWeights, type PillarWeightScope } from '@/app/actions/strategy'
import type { ContentPillar } from '@/lib/types'
import type { PillarWeightsConfig } from '@/lib/queries/posts'

interface PillarWeightSlidersProps {
  pillars: ContentPillar[]
  savedConfig: PillarWeightsConfig | null
}

function getInitialWeights(
  pillars: ContentPillar[],
  savedConfig: PillarWeightsConfig | null,
): Record<string, number> {
  // If there's a non-expired monthly config or a default override, use it
  if (savedConfig && !savedConfig.monthlyExpired && savedConfig.weights) {
    const merged = Object.fromEntries(pillars.map((p) => [p.id, p.weight_pct]))
    for (const [id, w] of Object.entries(savedConfig.weights)) {
      if (id in merged) merged[id] = w
    }
    return merged
  }
  return Object.fromEntries(pillars.map((p) => [p.id, p.weight_pct]))
}

export function PillarWeightSliders({ pillars, savedConfig }: PillarWeightSlidersProps) {
  const [isPending, startTransition] = useTransition()
  const [scope, setScope] = useState<PillarWeightScope>(
    savedConfig?.scope === 'monthly' && !savedConfig.monthlyExpired ? 'monthly' : 'default',
  )
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [weights, setWeights] = useState<Record<string, number>>(
    getInitialWeights(pillars, savedConfig),
  )

  const total = Object.values(weights).reduce((s, v) => s + v, 0)
  const deviation = total - 100
  const atHundred = total === 100

  function handleSliderChange(pillarId: string, value: number) {
    setSaved(false)
    setError(null)
    setWeights((prev) => ({ ...prev, [pillarId]: value }))
  }

  function handleSave() {
    if (!atHundred) {
      setError(`Weights must sum to exactly 100% (currently ${total}%)`)
      return
    }
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        await updatePillarWeights(
          Object.entries(weights).map(([pillarId, weightPct]) => ({ pillarId, weightPct })),
          scope,
        )
        setSaved(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save weights.')
      }
    })
  }

  if (pillars.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Content Mix</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Adjust target weight for each pillar
          </p>
        </div>

        {/* Sum indicator */}
        <div
          className={cn(
            'shrink-0 rounded-full border px-3 py-1 text-xs font-medium tabular-nums',
            atHundred
              ? 'border-green-500/25 bg-green-500/10 text-green-400'
              : 'border-orange-500/25 bg-orange-500/10 text-orange-400',
          )}
        >
          {total}%{deviation !== 0 && ` (${deviation > 0 ? '+' : ''}${deviation})`}
        </div>
      </div>

      {/* Sliders */}
      <div className="flex flex-col gap-4">
        {pillars.map((pillar) => (
          <div key={pillar.id}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium" style={{ color: pillar.color }}>
                {pillar.name}
              </span>
              <span className="tabular-nums text-muted-foreground">{weights[pillar.id] ?? 0}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={weights[pillar.id] ?? 0}
              onChange={(e) => handleSliderChange(pillar.id, parseInt(e.target.value, 10))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted focus:outline-none focus:ring-2 focus:ring-ring/50"
              style={{ accentColor: pillar.color }}
            />
          </div>
        ))}
      </div>

      {/* Scope toggle */}
      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => { setScope('monthly'); setSaved(false) }}
          className={cn(
            'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
            scope === 'monthly'
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:text-foreground',
          )}
        >
          This month only
        </button>
        <button
          type="button"
          onClick={() => { setScope('default'); setSaved(false) }}
          className={cn(
            'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
            scope === 'default'
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:text-foreground',
          )}
        >
          Update default
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        {saved && !isPending && (
          <p className="text-xs text-emerald-400">
            {scope === 'monthly' ? 'Monthly weights saved.' : 'Default weights updated.'}
          </p>
        )}
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={isPending || !atHundred} size="sm">
            {isPending ? 'Saving…' : 'Save weights'}
          </Button>
        </div>
      </div>
    </div>
  )
}
