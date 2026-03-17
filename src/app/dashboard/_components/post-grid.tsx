'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Post, PostStatus } from '@/lib/types'
import { PostCard } from './post-card'

interface FilterTab {
  label: string
  statuses: PostStatus[] | null // null = All
}

const TABS: FilterTab[] = [
  { label: 'All', statuses: null },
  { label: 'Needs Review', statuses: ['pending_review', 'agent_review'] },
  { label: 'Drafts', statuses: ['draft'] },
  { label: 'Approved', statuses: ['approved', 'scheduled'] },
  { label: 'Published', statuses: ['published', 'rejected'] },
]

interface PostGridProps {
  posts: Post[]
}

export function PostGrid({ posts }: PostGridProps) {
  const [activeTab, setActiveTab] = useState(0)

  const filtered =
    TABS[activeTab].statuses === null
      ? posts
      : posts.filter((p) => (TABS[activeTab].statuses as PostStatus[]).includes(p.status))

  function getTabCount(tab: FilterTab): number {
    if (tab.statuses === null) return posts.length
    return posts.filter((p) => (tab.statuses as PostStatus[]).includes(p.status)).length
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted/40 p-1">
        {TABS.map((tab, i) => {
          const count = getTabCount(tab)
          return (
            <button
              key={tab.label}
              onClick={() => setActiveTab(i)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                i === activeTab
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs tabular-nums',
                  i === activeTab
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Grid or empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-2xl">
            ✓
          </div>
          <h3 className="mt-4 text-base font-semibold">
            {activeTab === 0 ? 'No posts yet' : `No ${TABS[activeTab].label.toLowerCase()} posts`}
          </h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            {activeTab === 0
              ? 'Your agents are working on the next batch.'
              : 'Nothing to show in this filter right now.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
