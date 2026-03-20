'use client'

import { useMemo, useState } from 'react'
import { usePostsRealtimeSync } from '@/hooks/use-posts-realtime'
import { AlertTriangle } from 'lucide-react'
import { m, AnimatePresence, type Variants } from 'framer-motion'
import type { RotationWarning } from '@/lib/post-display'
import {
  DASHBOARD_STATUS_FILTERS,
  filterPostsByDashboardRule,
  filterPostsByPillars,
  getPillarFilterOptions,
  getStatusFilterCount,
  sortDashboardPosts,
  WILDCARD_PILLAR_COLOR,
  WILDCARD_PILLAR_ID,
  WILDCARD_PILLAR_NAME,
  type DashboardStatusFilter,
} from '@/lib/dashboard-ui'
import { cn } from '@/lib/utils'
import type { ContentPillar, Post } from '@/lib/types'
import { DashboardFilterBar } from './dashboard-filter-bar'
import { PostCard } from './post-card'

const cardContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.05 },
  },
  exit: {},
}

const cardItemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.15 } },
}

interface PostGridProps {
  posts: Post[]
  pillars: ContentPillar[]
  rotationWarnings: RotationWarning[]
}

export function PostGrid({ posts: initialPosts, pillars, rotationWarnings }: PostGridProps) {
  const [posts, setPosts] = useState(initialPosts)
  const [activeFilterId, setActiveFilterId] =
    useState<DashboardStatusFilter['id']>('all')
  const [selectedPillarIds, setSelectedPillarIds] = useState<Set<string>>(new Set())

  usePostsRealtimeSync(setPosts)

  function togglePillar(id: string) {
    setSelectedPillarIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const activeFilter = useMemo(
    () => DASHBOARD_STATUS_FILTERS.find((filter) => filter.id === activeFilterId) ?? DASHBOARD_STATUS_FILTERS[0],
    [activeFilterId]
  )

  const filteredPosts = useMemo(
    () =>
      sortDashboardPosts(
        filterPostsByPillars(filterPostsByDashboardRule(posts, activeFilter), selectedPillarIds),
        activeFilterId
      ),
    [activeFilter, activeFilterId, posts, selectedPillarIds]
  )

  const statusCounts = useMemo(
    () =>
      Object.fromEntries(
        DASHBOARD_STATUS_FILTERS.map((filter) => [
          filter.id,
          getStatusFilterCount(posts, filter, selectedPillarIds),
        ])
      ) as Record<DashboardStatusFilter['id'], number>,
    [posts, selectedPillarIds]
  )

  const pillarOptions = useMemo(
    () => getPillarFilterOptions(pillars, posts, activeFilterId),
    [activeFilterId, pillars, posts]
  )

  const pillarMap = useMemo(
    () => {
      const map = new Map(pillars.map((pillar) => [pillar.id, pillar]))

      if (posts.some((post) => !post.pillar_id)) {
        map.set(WILDCARD_PILLAR_ID, {
          id: WILDCARD_PILLAR_ID,
          name: WILDCARD_PILLAR_NAME,
          color: WILDCARD_PILLAR_COLOR,
        } as ContentPillar)
      }

      return map
    },
    [pillars, posts]
  )

  return (
    <div className="space-y-6">
      <DashboardFilterBar
        activeFilterId={activeFilterId}
        onFilterChange={setActiveFilterId}
        statusCounts={statusCounts}
        pillarOptions={pillarOptions}
        selectedPillarIds={selectedPillarIds}
        onTogglePillar={togglePillar}
        onClearPillars={() => setSelectedPillarIds(new Set())}
        filteredCount={filteredPosts.length}
        totalCount={posts.length}
      />

      {rotationWarnings.length > 0 ? (
        <div className="dashboard-frame flex flex-col gap-2 rounded-[22px] border border-primary/18 bg-primary/8 px-4 py-3">
          {rotationWarnings.map((warning) => (
            <div key={warning.pillar_id} className="flex items-start gap-2.5 text-sm text-foreground/82">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{warning.suggestion}</span>
            </div>
          ))}
        </div>
      ) : null}

      {filteredPosts.length === 0 ? (
        <div className="dashboard-frame flex flex-col items-center justify-center py-24 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-background/65 text-2xl">
            ✓
          </div>
          <h3 className="mt-4 text-base font-semibold">
            {activeFilterId === 'all' && selectedPillarIds.size === 0 ? 'No posts yet' : 'No posts match this filter'}
          </h3>
          <p className="mt-1.5 max-w-sm text-sm text-foreground/68">
            {activeFilterId === 'all' && selectedPillarIds.size === 0
              ? 'Your agents are working on the next batch.'
              : 'Try adjusting the status filter or pillar mix.'}
          </p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <m.div
            key={`grid-${activeFilterId}-${Array.from(selectedPillarIds).join(',')}`}
            variants={cardContainerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {filteredPosts.map((post, index) => (
              <m.div
                key={post.id}
                variants={cardItemVariants}
                className={cn(index === 0 && filteredPosts.length > 2 && 'md:col-span-2 xl:col-span-2')}
              >
                <PostCard
                  post={post}
                  pillar={pillarMap.get(post.pillar_id ?? WILDCARD_PILLAR_ID)}
                  featured={index === 0 && filteredPosts.length > 2}
                />
              </m.div>
            ))}
          </m.div>
        </AnimatePresence>
      )}
    </div>
  )
}
