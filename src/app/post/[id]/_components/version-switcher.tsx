'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
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
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  if (revisions.length === 0) return null

  const displayVersion = selectedVersion ?? currentVersion
  const label = `v${displayVersion}`

  return (
    <div ref={ref} className="relative mb-4 inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
      >
        <span className="uppercase tracking-wide text-muted-foreground">Version</span>
        <span>{label}</span>
        <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] rounded-md border border-border bg-card py-1 shadow-xl">
          {/* Current version */}
          <button
            onClick={() => { onSelect(null); setOpen(false) }}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted/50 ${
              selectedVersion === null ? 'text-primary font-medium' : 'text-foreground'
            }`}
          >
            {selectedVersion === null && <span className="text-primary">&#10003;</span>}
            <span className={selectedVersion === null ? '' : 'pl-5'}>v{currentVersion} (current)</span>
          </button>

          {/* Historical versions — newest first */}
          {revisions.map((rev) => {
            const isSelected = selectedVersion === rev.version
            return (
              <button
                key={rev.id}
                onClick={() => { onSelect(rev.version); setOpen(false) }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted/50 ${
                  isSelected ? 'text-primary font-medium' : 'text-muted-foreground'
                }`}
              >
                {isSelected && <span className="text-primary">&#10003;</span>}
                <span className={isSelected ? '' : 'pl-5'}>v{rev.version} &middot; {formatRevisionDate(rev.created_at)}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
