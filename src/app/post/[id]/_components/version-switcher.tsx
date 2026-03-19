'use client'

import { History } from 'lucide-react'
import type { PostRevision } from '@/lib/types'

interface Props {
  revisions: PostRevision[]
  currentVersion: number
  selectedVersion: number | null
  onSelect: (version: number | null) => void
}

function formatRevisionDate(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function VersionSwitcher({ revisions, currentVersion, selectedVersion, onSelect }: Props) {
  if (revisions.length === 0) return null

  const isCurrentSelected = selectedVersion === null

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 flex items-center gap-1 text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground">
        <History className="size-3.5" />
        Version
      </span>

      {/* Current tab */}
      <button
        onClick={() => onSelect(null)}
        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
          isCurrentSelected
            ? 'border-primary/40 bg-primary/15 text-primary'
            : 'border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground'
        }`}
      >
        Current (v{currentVersion})
      </button>

      {/* Historical version tabs — oldest first */}
      {[...revisions].reverse().map((rev) => {
        const isSelected = selectedVersion === rev.version
        return (
          <button
            key={rev.id}
            onClick={() => onSelect(rev.version)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              isSelected
                ? 'border-primary/40 bg-primary/15 text-primary'
                : 'border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground'
            }`}
          >
            v{rev.version} · {formatRevisionDate(rev.created_at)}
          </button>
        )
      })}
    </div>
  )
}
