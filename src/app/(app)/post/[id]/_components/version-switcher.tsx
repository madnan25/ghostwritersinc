'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface VersionListItem {
  id: string
  version: number
  created_at: string
}

interface Props {
  revisions: VersionListItem[]
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
    <div ref={ref} className="relative">
      <Button
        onClick={() => setOpen((v) => !v)}
        variant="outline"
        size="sm"
        aria-expanded={open}
        className="min-w-[132px] justify-between border-border/70 bg-background/70 text-foreground shadow-none hover:bg-card/90"
      >
        <span className="flex items-center gap-1.5">
          <span className="uppercase tracking-[0.16em] text-muted-foreground">Version</span>
          <span className="text-foreground">{label}</span>
        </span>
        <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 min-w-[200px] overflow-hidden rounded-2xl border border-border/70 bg-card/95 py-1 shadow-[0_18px_44px_-26px_rgba(0,0,0,0.56)] backdrop-blur">
          {/* Current version */}
          <button
            onClick={() => { onSelect(null); setOpen(false) }}
            className={`flex w-full items-center gap-2 px-4 py-2 text-left text-xs transition-colors hover:bg-muted/45 ${
              selectedVersion === null ? 'bg-primary/8 text-primary font-medium' : 'text-foreground'
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
                className={`flex w-full items-center gap-2 px-4 py-2 text-left text-xs transition-colors hover:bg-muted/45 ${
                  isSelected ? 'bg-primary/8 text-primary font-medium' : 'text-muted-foreground'
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
