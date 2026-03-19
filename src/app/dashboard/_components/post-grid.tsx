'use client'

import { useState, useEffect } from 'react'
import { usePostsRealtimeSync } from '@/hooks/use-posts-realtime'
import { AlertTriangle } from 'lucide-react'
import { m, AnimatePresence, type Variants } from 'framer-motion'
import type { RotationWarning } from '@/lib/post-display'
import { DASHBOARD_FILTER_TABS, type DashboardFilterTab } from '@/lib/dashboard-ui'
import { cn } from '@/lib/utils'
import type { ContentPillar, Post, PostStatus } from '@/lib/types'
import type { PostWithRevisionCount } from '@/lib/queries/posts'
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
  posts: PostWithRevisionCount[]
  pillars: ContentPillar[]
  rotationWarnings: RotationWarning[]
}

export function PostGrid({ posts: initialPosts, pillars, rotationWarnings }: PostGridProps) {
  const [posts, setPosts] = useState(initialPosts)
  const [activeTab, setActiveTab] = useState(0)
  const [selectedPillarIds, setSelectedPillarIds] = useState<Set<string>>(new Set())

  // Sync with server revalidation — when initialPosts change (e.g. after a server action
  // calls revalidatePath), merge server data as the source of truth
  useEffect(() => {
    setPosts(initialPosts)
  }, [initialPosts])

  // Keep posts in sync with realtime changes (cast: realtime updates don't carry revision_count, defaults to 0)
  usePostsRealtimeSync(setPosts as React.Dispatch<React.SetStateAction<Post[]>>)

  const pillarMap = new Map(pillars.map((pillar) => [pillar.id, pillar]))

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

  const afterStatus =
    DASHBOARD_FILTER_TABS[activeTab].statuses === null
      ? posts
      : posts.filter((post) =>
          (DASHBOARD_FILTER_TABS[activeTab].statuses as PostStatus[]).includes(post.status),
        )

  const filtered =
    selectedPillarIds.size === 0
      ? afterStatus
      : afterStatus.filter((post) => post.pillar_id && selectedPillarIds.has(post.pillar_id))

  function getTabCount(tab: DashboardFilterTab): number {
    const statusFiltered =
      tab.statuses === null
        ? posts
        : posts.filter((post) => (tab.statuses as PostStatus[]).includes(post.status))

    if (selectedPillarIds.size === 0) {
      return statusFiltered.length
    }

    return statusFiltered.filter((post) => post.pillar_id && selectedPillarIds.has(post.pillar_id)).length
  }

  const totalPosts = posts.filter((post) => post.pillar_id).length

  function getPillarCount(pillarId: string): number {
    return posts.filter((post) => post.pillar_id === pillarId).length
  }

  return (
    <div className="space-y-6">
      <section className="dashboard-frame relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(145,255,88,0.14)_0%,transparent_70%)] blur-3xl" />
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="premium-kicker text-[0.64rem]">Live Queue</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-foreground sm:text-3xl">
              Editorial pipeline
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-foreground/66">
              Filter by status or pillar to focus the queue without losing sight of the overall mix.
            </p>
          </div>
          <div className="dashboard-rail flex items-center gap-3 rounded-full px-4 py-2 text-sm text-foreground/70">
            <span className="inline-flex size-2 rounded-full bg-primary/80" />
            <span>
              {filtered.length} visible of {posts.length}
            </span>
          </div>
        </div>

        {rotationWarnings.length > 0 && (
          <div className="mb-5 flex flex-col gap-2 rounded-[22px] border border-primary/18 bg-primary/8 px-4 py-3">
            {rotationWarnings.map((warning) => (
              <div key={warning.pillar_id} className="flex items-start gap-2.5 text-sm text-foreground/82">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{warning.suggestion}</span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4">
          <div className="dashboard-rail p-3">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-foreground/56">
                  Stage Focus
                </p>
                <p className="mt-1 text-sm text-foreground/60">
                  Jump between editorial stages without losing context.
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
              {DASHBOARD_FILTER_TABS.map((tab, index) => {
                const count = getTabCount(tab)

                return (
                  <button
                    key={tab.label}
                    onClick={() => setActiveTab(index)}
                    className={cn(
                      'dashboard-stage-tab min-w-0 active:scale-[0.99]',
                      index === activeTab && 'dashboard-stage-tab-active',
                    )}
                  >
                    {index === activeTab && (
                      <m.span
                        layoutId="tab-indicator"
                        className="absolute inset-0 rounded-[18px] border border-border/75 bg-card shadow-[0_10px_24px_-16px_rgba(0,0,0,0.38)]"
                        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                      />
                    )}
                    <span className="relative z-10 leading-tight">{tab.label}</span>
                    <span
                      className={cn(
                        'dashboard-stage-count relative z-10',
                        index === activeTab ? 'bg-primary/14 text-primary' : 'bg-background/58 text-foreground/56',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {pillars.length > 0 ? (
            <div className="dashboard-rail p-4 sm:p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-foreground/56">
                    Pillar Mix
                  </p>
                  <p className="mt-1 text-sm text-foreground/60">
                    A calmer view of topic balance across the queue.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPillarIds(new Set())}
                  className={cn(
                    'text-xs font-medium transition-colors',
                    selectedPillarIds.size === 0 ? 'text-foreground/40' : 'text-primary hover:text-primary/82',
                  )}
                >
                  Clear
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <button
                  onClick={() => setSelectedPillarIds(new Set())}
                  className={cn(
                    'pillar-mix-card text-left',
                    selectedPillarIds.size === 0 && 'border-border/85 bg-card/72',
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">All pillars</p>
                      <p className="mt-1 text-xs text-foreground/56">Full editorial mix</p>
                    </div>
                    <span className="dashboard-stage-count bg-background/58 text-foreground/64">
                      {posts.length}
                    </span>
                  </div>
                </button>

                {pillars.map((pillar) => {
                  const count = getPillarCount(pillar.id)
                  const actual = totalPosts > 0 ? Math.round((count / totalPosts) * 100) : 0
                  const active = selectedPillarIds.has(pillar.id)

                  return (
                    <button
                      key={pillar.id}
                      onClick={() => togglePillar(pillar.id)}
                      title={`${pillar.name}: ${actual}% actual / ${pillar.weight_pct}% target`}
                      className={cn(
                        'pillar-mix-card text-left',
                        active && 'border-border/85 bg-card/72',
                        selectedPillarIds.size > 0 && !active && 'opacity-60',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block size-2 rounded-full"
                              style={{ backgroundColor: pillar.color }}
                            />
                            <p className="truncate text-sm font-medium text-foreground">
                              {pillar.name}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-foreground/56">
                            {actual}% of queued posts
                          </p>
                        </div>
                        <span className="dashboard-stage-count bg-background/58 text-foreground/64">
                          {count}
                        </span>
                      </div>
                      <div className="pillar-mix-track mt-3">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(actual, count > 0 ? 8 : 0)}%`,
                            backgroundColor: pillar.color,
                          }}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <AnimatePresence mode="wait">
        {filtered.length === 0 ? (
          <m.div
            key="empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="dashboard-frame flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-background/65 text-2xl">
              ✓
            </div>
            <h3 className="mt-4 text-base font-semibold">
              {activeTab === 0 && selectedPillarIds.size === 0 ? 'No posts yet' : 'No posts match this filter'}
            </h3>
            <p className="mt-1.5 max-w-sm text-sm text-foreground/68">
              {activeTab === 0 && selectedPillarIds.size === 0
                ? 'Your agents are working on the next batch.'
                : 'Try adjusting the status tab or pillar filter.'}
            </p>
          </m.div>
        ) : (
          <m.div
            key={`grid-${activeTab}-${Array.from(selectedPillarIds).join(',')}`}
            variants={cardContainerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {filtered.map((post, index) => (
              <m.div
                key={post.id}
                variants={cardItemVariants}
                className={cn(index === 0 && filtered.length > 2 && 'md:col-span-2 xl:col-span-2')}
              >
                <PostCard
                  post={post}
                  pillar={post.pillar_id ? pillarMap.get(post.pillar_id) : undefined}
                  featured={index === 0 && filtered.length > 2}
                  hasRevisions={post.revision_count > 0}
                />
              </m.div>
            ))}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
