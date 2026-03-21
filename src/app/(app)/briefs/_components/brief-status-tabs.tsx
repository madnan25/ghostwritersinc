'use client'

import Link from 'next/link'

interface StatusFilter {
  value: string
  label: string
}

interface BriefStatusTabsProps {
  filters: ReadonlyArray<StatusFilter>
  activeStatus: string
}

export function BriefStatusTabs({ filters, activeStatus }: BriefStatusTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => {
        const isActive = filter.value === activeStatus
        const href = filter.value ? `/briefs?status=${filter.value}` : '/briefs'
        return (
          <Link
            key={filter.value}
            href={href}
            className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border/70 bg-card text-muted-foreground hover:border-border hover:text-foreground'
            }`}
          >
            {filter.label}
          </Link>
        )
      })}
    </div>
  )
}
