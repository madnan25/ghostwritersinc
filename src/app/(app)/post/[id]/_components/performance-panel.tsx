'use client'

import { useState, useTransition } from 'react'
import { BarChart2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { logPostPerformance, type PostPerformanceInput } from '@/app/actions/posts'
import type { PostPerformanceRow } from '@/lib/queries/posts'

interface PerformancePanelProps {
  postId: string
  initialPerformance: PostPerformanceRow | null
}

function toInputValue(n: number | null | undefined): string {
  if (n === null || n === undefined) return ''
  return String(n)
}

export function PerformancePanel({ postId, initialPerformance }: PerformancePanelProps) {
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [impressions, setImpressions] = useState(toInputValue(initialPerformance?.impressions))
  const [reactions, setReactions] = useState(toInputValue(initialPerformance?.reactions))
  const [commentsCount, setCommentsCount] = useState(toInputValue(initialPerformance?.comments_count))
  const [reposts, setReposts] = useState(toInputValue(initialPerformance?.reposts))
  const [qualitativeNotes, setQualitativeNotes] = useState(initialPerformance?.qualitative_notes ?? '')

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        const data: PostPerformanceInput = {
          impressions: impressions ? parseInt(impressions, 10) : null,
          reactions: reactions ? parseInt(reactions, 10) : null,
          comments_count: commentsCount ? parseInt(commentsCount, 10) : null,
          reposts: reposts ? parseInt(reposts, 10) : null,
          qualitative_notes: qualitativeNotes.trim() || null,
        }
        await logPostPerformance(postId, data)
        setSaved(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save performance data.')
      }
    })
  }

  return (
    <div className="dashboard-frame p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-[0.24em] text-primary/72">
        <BarChart2 className="size-4" />
        Performance
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricField
          label="Impressions"
          value={impressions}
          onChange={setImpressions}
        />
        <MetricField
          label="Reactions"
          value={reactions}
          onChange={setReactions}
        />
        <MetricField
          label="Comments"
          value={commentsCount}
          onChange={setCommentsCount}
        />
        <MetricField
          label="Reposts"
          value={reposts}
          onChange={setReposts}
        />
      </div>

      <div className="mt-3">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Qualitative notes
        </label>
        <textarea
          value={qualitativeNotes}
          onChange={(e) => setQualitativeNotes(e.target.value)}
          rows={3}
          placeholder="What worked? What didn't? Audience reaction, unexpected engagement…"
          className="w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        {saved && !isPending && (
          <p className="text-xs text-emerald-400">Performance data saved.</p>
        )}
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={isPending} size="sm">
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function MetricField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm tabular-nums placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/50"
      />
    </div>
  )
}
