'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import type { ContentPillar } from '@/lib/types'

interface BriefFiltersProps {
  pillars: Pick<ContentPillar, 'id' | 'name' | 'color'>[]
  activePillarId: string
  publishFrom: string
  publishTo: string
}

export function BriefFilters({
  pillars,
  activePillarId,
  publishFrom,
  publishTo,
}: BriefFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      router.push(`/briefs?${params.toString()}`)
    },
    [router, searchParams],
  )

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Pillar filter */}
      <select
        value={activePillarId}
        onChange={(e) => updateParam('pillar_id', e.target.value)}
        className="h-8 rounded-full border border-border/70 bg-card px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
      >
        <option value="">All pillars</option>
        <option value="__wildcard__">Wildcard</option>
        {pillars.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {/* Date range */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Publish</span>
        <input
          type="date"
          value={publishFrom}
          onChange={(e) => updateParam('publish_from', e.target.value)}
          className="h-8 rounded-full border border-border/70 bg-card px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <input
          type="date"
          value={publishTo}
          onChange={(e) => updateParam('publish_to', e.target.value)}
          className="h-8 rounded-full border border-border/70 bg-card px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>

      {/* Clear filters */}
      {(activePillarId || publishFrom || publishTo) && (
        <button
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString())
            params.delete('pillar_id')
            params.delete('publish_from')
            params.delete('publish_to')
            router.push(`/briefs?${params.toString()}`)
          }}
          className="h-8 rounded-full border border-border/70 bg-card px-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  )
}
