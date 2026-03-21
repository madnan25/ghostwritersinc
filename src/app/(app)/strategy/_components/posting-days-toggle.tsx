'use client'

import { useMemo, useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { updatePostingDays } from '@/app/actions/strategy'

const WEEK_DAYS = [
  { value: 0, label: 'S' },
  { value: 1, label: 'M' },
  { value: 2, label: 'T' },
  { value: 3, label: 'W' },
  { value: 4, label: 'T' },
  { value: 5, label: 'F' },
  { value: 6, label: 'S' },
]

function countSlotsThisMonth(postingDays: number[]): number {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const allowed = new Set(postingDays)
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    if (allowed.has(new Date(year, month, d).getDay())) count++
  }
  return count
}

interface PostingDaysToggleProps {
  initialDays: number[]
}

export function PostingDaysToggle({ initialDays }: PostingDaysToggleProps) {
  const [days, setDays] = useState<number[]>(initialDays)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const slotsThisMonth = useMemo(() => countSlotsThisMonth(days), [days])

  const isDirty = useMemo(() => {
    if (days.length !== initialDays.length) return true
    const sorted = [...days].sort((a, b) => a - b)
    const sortedInitial = [...initialDays].sort((a, b) => a - b)
    return sorted.some((d, i) => d !== sortedInitial[i])
  }, [days, initialDays])

  function toggleDay(day: number) {
    setSaved(false)
    setError(null)
    setDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev // at least 1 required
        return prev.filter((d) => d !== day)
      }
      return [...prev, day].sort((a, b) => a - b)
    })
  }

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        await updatePostingDays(days)
        setSaved(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save posting days.')
      }
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold">Posting Days</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Which days of the week briefs can be scheduled on
        </p>
      </div>

      {/* Day toggles */}
      <div className="flex gap-2">
        {WEEK_DAYS.map(({ value, label }) => {
          const active = days.includes(value)
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggleDay(value)}
              className={cn(
                'flex size-9 items-center justify-center rounded-full text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring/50',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
              aria-pressed={active}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Slots count */}
      <p className="mt-3 text-xs text-muted-foreground">
        {slotsThisMonth} posting {slotsThisMonth === 1 ? 'slot' : 'slots'} available this month
      </p>

      {error && (
        <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        {saved && !isPending && (
          <p className="text-xs text-emerald-400">Posting days saved.</p>
        )}
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={isPending || !isDirty} size="sm">
            {isPending ? 'Saving…' : 'Save days'}
          </Button>
        </div>
      </div>
    </div>
  )
}
