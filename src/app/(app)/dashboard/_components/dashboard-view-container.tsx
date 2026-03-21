'use client'

import { useEffect, useState } from 'react'
import { Columns2, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContentPillar, Post } from '@/lib/types'
import { PostGrid } from './post-grid'
import { PipelineSwimlane } from './pipeline-swimlane'

type ViewMode = 'grid' | 'pipeline'

const VIEW_MODE_KEY = 'dashboard_view_mode'

interface DashboardViewContainerProps {
  posts: Post[]
  pillars: ContentPillar[]
}

export function DashboardViewContainer({ posts, pillars }: DashboardViewContainerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(VIEW_MODE_KEY)
    if (stored === 'grid' || stored === 'pipeline') {
      setViewMode(stored)
    }
    setMounted(true)
  }, [])

  function switchView(mode: ViewMode) {
    setViewMode(mode)
    localStorage.setItem(VIEW_MODE_KEY, mode)
  }

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex items-center justify-end">
        <div className="flex rounded-lg border border-border/40 bg-background/60 p-0.5">
          <button
            onClick={() => switchView('grid')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              viewMode === 'grid'
                ? 'bg-foreground/8 text-foreground'
                : 'text-foreground/50 hover:text-foreground/70',
            )}
            aria-label="Grid view"
          >
            <LayoutGrid className="size-3.5" />
            Grid
          </button>
          <button
            onClick={() => switchView('pipeline')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              viewMode === 'pipeline'
                ? 'bg-foreground/8 text-foreground'
                : 'text-foreground/50 hover:text-foreground/70',
            )}
            aria-label="Pipeline view"
          >
            <Columns2 className="size-3.5" />
            Pipeline
          </button>
        </div>
      </div>

      {/* Render selected view — always render grid until mounted to avoid hydration mismatch */}
      {mounted && viewMode === 'pipeline' ? (
        <PipelineSwimlane posts={posts} pillars={pillars} />
      ) : (
        <PostGrid posts={posts} pillars={pillars} />
      )}
    </div>
  )
}
