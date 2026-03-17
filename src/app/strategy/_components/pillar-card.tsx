'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContentPillar } from '@/lib/types'

interface PillarCardProps {
  pillar: ContentPillar
  actualPct: number
}

export function PillarCard({ pillar, actualPct }: PillarCardProps) {
  const [audienceOpen, setAudienceOpen] = useState(false)

  const targetPct = pillar.weight_pct
  const deviation = actualPct - targetPct
  const progressWidth = Math.min(actualPct, 100)
  const targetWidth = Math.min(targetPct, 100)

  return (
    <div
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5"
      style={{ borderLeftColor: pillar.color, borderLeftWidth: '3px' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-tight">{pillar.name}</h3>
        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: `${pillar.color}26`,
            color: pillar.color,
          }}
        >
          {targetPct}% target
        </span>
      </div>

      {/* Description */}
      {pillar.description && (
        <p className="text-sm leading-relaxed text-muted-foreground">{pillar.description}</p>
      )}

      {/* Audience of One — collapsible */}
      {pillar.audience_summary && (
        <div className="rounded-lg border border-border/60 bg-muted/30">
          <button
            className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium transition-colors hover:text-foreground"
            onClick={() => setAudienceOpen((v) => !v)}
          >
            <span>Audience of One</span>
            {audienceOpen ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </button>
          {audienceOpen && (
            <p className="border-t border-border/60 px-3 pb-3 pt-2.5 text-sm leading-relaxed text-muted-foreground">
              {pillar.audience_summary}
            </p>
          )}
        </div>
      )}

      {/* Example Hooks */}
      {pillar.example_hooks && pillar.example_hooks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Example Hooks
          </p>
          <ul className="flex flex-col gap-1">
            {pillar.example_hooks.map((hook, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: pillar.color }}
                />
                <span>{hook}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Brief reference */}
      {pillar.brief_ref && (
        <a
          href={pillar.brief_ref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ExternalLink className="size-3.5" />
          <span className="truncate">{pillar.brief_ref}</span>
        </a>
      )}

      {/* Actual vs Target progress */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Content mix</span>
          <span className={cn(
            'font-medium',
            deviation > 5 ? 'text-orange-400' : deviation < -5 ? 'text-blue-400' : 'text-green-400',
          )}>
            {actualPct}% actual
            {deviation !== 0 && (
              <span className="ml-1 opacity-70">
                ({deviation > 0 ? '+' : ''}{deviation}% vs target)
              </span>
            )}
          </span>
        </div>

        {/* Target bar */}
        <div className="relative h-2 overflow-hidden rounded-full bg-muted/60">
          {/* Target marker */}
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground/20"
            style={{ left: `${targetWidth}%` }}
          />
          {/* Actual fill */}
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressWidth}%`,
              backgroundColor: pillar.color,
              opacity: 0.8,
            }}
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-3 rounded-full" style={{ backgroundColor: pillar.color, opacity: 0.8 }} />
            Actual ({actualPct}%)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-0.5 bg-foreground/20 rounded-full" />
            Target ({targetPct}%)
          </span>
        </div>
      </div>
    </div>
  )
}
