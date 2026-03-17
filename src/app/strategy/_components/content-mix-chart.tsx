'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ContentPillar, Post } from '@/lib/types'

type Period = '7d' | '30d' | '90d'

const PERIOD_LABELS: Record<Period, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
}

const PERIOD_DAYS: Record<Period, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

interface ContentMixChartProps {
  pillars: ContentPillar[]
  posts: Post[]
}

export function ContentMixChart({ pillars, posts }: ContentMixChartProps) {
  const [period, setPeriod] = useState<Period>('30d')

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - PERIOD_DAYS[period])

  const filtered = posts.filter((p) => {
    const date = p.suggested_publish_at ?? p.created_at
    return new Date(date) >= cutoff
  })

  const total = filtered.length
  const pillarMap = new Map(pillars.map((p) => [p.id, p]))

  // Count posts per pillar
  const counts: Record<string, number> = {}
  let unassigned = 0
  for (const post of filtered) {
    if (post.pillar_id && pillarMap.has(post.pillar_id)) {
      counts[post.pillar_id] = (counts[post.pillar_id] ?? 0) + 1
    } else {
      unassigned++
    }
  }

  const segments = pillars.map((p) => ({
    pillar: p,
    count: counts[p.id] ?? 0,
    actualPct: total > 0 ? Math.round(((counts[p.id] ?? 0) / total) * 100) : 0,
  }))

  return (
    <div className="flex flex-col gap-4">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              period === p
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {p}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {total} post{total !== 1 ? 's' : ''} · {PERIOD_LABELS[period]}
        </span>
      </div>

      {total === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-8 text-sm text-muted-foreground">
          No posts in this period
        </div>
      ) : (
        <>
          {/* Stacked bar — actual */}
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">Actual</p>
            <div className="flex h-8 overflow-hidden rounded-lg">
              {segments
                .filter((s) => s.count > 0)
                .map((s) => (
                  <div
                    key={s.pillar.id}
                    className="flex items-center justify-center transition-all duration-500"
                    style={{
                      width: `${s.actualPct}%`,
                      backgroundColor: s.pillar.color,
                      opacity: 0.85,
                      minWidth: s.actualPct > 0 ? '2px' : '0',
                    }}
                    title={`${s.pillar.name}: ${s.actualPct}%`}
                  >
                    {s.actualPct >= 10 && (
                      <span className="text-xs font-semibold text-white drop-shadow">
                        {s.actualPct}%
                      </span>
                    )}
                  </div>
                ))}
              {unassigned > 0 && (
                <div
                  className="flex items-center justify-center bg-muted"
                  style={{ width: `${Math.round((unassigned / total) * 100)}%` }}
                  title={`Unassigned: ${Math.round((unassigned / total) * 100)}%`}
                />
              )}
            </div>
          </div>

          {/* Stacked bar — target */}
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">Target</p>
            <div className="flex h-8 overflow-hidden rounded-lg">
              {pillars
                .filter((p) => p.weight_pct > 0)
                .map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-center"
                    style={{
                      width: `${p.weight_pct}%`,
                      backgroundColor: p.color,
                      opacity: 0.35,
                    }}
                    title={`${p.name}: ${p.weight_pct}%`}
                  >
                    {p.weight_pct >= 10 && (
                      <span className="text-xs font-semibold text-white drop-shadow">
                        {p.weight_pct}%
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
            {segments.map((s) => (
              <div key={s.pillar.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: s.pillar.color }}
                />
                <span>{s.pillar.name}</span>
                <span className="font-medium text-foreground">
                  {s.actualPct}%
                </span>
                {s.actualPct !== s.pillar.weight_pct && (
                  <span className={cn(
                    'text-[10px]',
                    s.actualPct > s.pillar.weight_pct ? 'text-orange-400' : 'text-blue-400',
                  )}>
                    ({s.actualPct > s.pillar.weight_pct ? '+' : ''}{s.actualPct - s.pillar.weight_pct}%)
                  </span>
                )}
              </div>
            ))}
            {unassigned > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2.5 shrink-0 rounded-sm bg-muted" />
                <span>Unassigned</span>
                <span className="font-medium text-foreground">
                  {Math.round((unassigned / total) * 100)}%
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
