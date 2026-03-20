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
  compareFrom: number | null
  compareTo: number | null
  onChangeFrom: (version: number | null) => void
  onChangeTo: (version: number | null) => void
}

function formatRevisionDate(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function versionLabel(version: number | null, currentVersion: number): string {
  if (version === null) return `v${currentVersion} (current)`
  return `v${version}`
}

interface DropdownProps {
  revisions: VersionListItem[]
  currentVersion: number
  selected: number | null
  onSelect: (version: number | null) => void
  label: string
}

function VersionDropdown({ revisions, currentVersion, selected, onSelect, label }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={ref} className="relative flex flex-col gap-0.5">
      <span className="px-1 text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground/60">
        {label}
      </span>
      <Button
        onClick={() => setOpen((v) => !v)}
        variant="outline"
        size="sm"
        aria-expanded={open}
        className="min-w-[148px] justify-between border-border/70 bg-background/70 text-foreground shadow-none hover:bg-card/90"
      >
        <span className="text-foreground">{versionLabel(selected, currentVersion)}</span>
        <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-[200px] overflow-hidden rounded-2xl border border-border/70 bg-card/95 py-1 shadow-[0_18px_44px_-26px_rgba(0,0,0,0.56)] backdrop-blur">
          {/* Current version */}
          <button
            onClick={() => { onSelect(null); setOpen(false) }}
            className={`flex w-full items-center gap-2 px-4 py-2 text-left text-xs transition-colors hover:bg-muted/45 ${
              selected === null ? 'bg-primary/8 text-primary font-medium' : 'text-foreground'
            }`}
          >
            {selected === null && <span className="text-primary">&#10003;</span>}
            <span className={selected === null ? '' : 'pl-5'}>v{currentVersion} (current)</span>
          </button>

          {/* Historical versions — newest first */}
          {revisions.map((rev) => {
            const isSelected = selected === rev.version
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

export function DiffVersionSelectors({
  revisions,
  currentVersion,
  compareFrom,
  compareTo,
  onChangeFrom,
  onChangeTo,
}: Props) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <VersionDropdown
        revisions={revisions}
        currentVersion={currentVersion}
        selected={compareFrom}
        onSelect={onChangeFrom}
        label="From"
      />
      <span className="mb-1.5 text-sm text-muted-foreground/60">→</span>
      <VersionDropdown
        revisions={revisions}
        currentVersion={currentVersion}
        selected={compareTo}
        onSelect={onChangeTo}
        label="To"
      />
    </div>
  )
}
