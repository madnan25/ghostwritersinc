import { cn } from '@/lib/utils'
import type { ContentPillar } from '@/lib/types'

interface RecentPost {
  id: string
  pillar_id: string | null
  suggested_publish_at: string | null
}

interface RotationTimelineProps {
  recentPosts: RecentPost[]
  pillars: ContentPillar[]
}

function detectRuns(posts: RecentPost[]): Map<string, number> {
  // Returns a map of postId -> run length it belongs to (only for runs > 2)
  const highlighted = new Map<string, number>()
  if (posts.length < 3) return highlighted

  let i = 0
  while (i < posts.length) {
    const currentPillar = posts[i].pillar_id
    if (!currentPillar) {
      i++
      continue
    }
    let runEnd = i + 1
    while (runEnd < posts.length && posts[runEnd].pillar_id === currentPillar) {
      runEnd++
    }
    const runLength = runEnd - i
    if (runLength > 2) {
      for (let j = i; j < runEnd; j++) {
        highlighted.set(posts[j].id, runLength)
      }
    }
    i = runEnd
  }
  return highlighted
}

export function RotationTimeline({ recentPosts, pillars }: RotationTimelineProps) {
  const pillarMap = new Map(pillars.map((p) => [p.id, p]))

  // Sort chronologically (oldest first for left-to-right reading)
  const sorted = [...recentPosts]
    .filter((p) => p.suggested_publish_at)
    .sort((a, b) => new Date(a.suggested_publish_at!).getTime() - new Date(b.suggested_publish_at!).getTime())
    .slice(-10)

  const highlighted = detectRuns(sorted)

  // Collect warnings
  const warningRuns = new Map<string, { pillarName: string; length: number }>()
  for (const [postId, runLength] of highlighted) {
    const post = sorted.find((p) => p.id === postId)
    if (post?.pillar_id) {
      const pillar = pillarMap.get(post.pillar_id)
      if (pillar && !warningRuns.has(post.pillar_id)) {
        warningRuns.set(post.pillar_id, { pillarName: pillar.name, length: runLength })
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Dot timeline */}
      {sorted.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-8 text-sm text-muted-foreground">
          No posts with scheduled dates yet
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">Oldest</span>
            <div className="flex items-center gap-1.5">
              {sorted.map((post) => {
                const pillar = post.pillar_id ? pillarMap.get(post.pillar_id) : null
                const isHighlighted = highlighted.has(post.id)
                return (
                  <div
                    key={post.id}
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all',
                      isHighlighted
                        ? 'ring-2 ring-offset-1 ring-offset-background ring-orange-400/60 scale-110'
                        : '',
                    )}
                    style={{
                      backgroundColor: pillar ? `${pillar.color}cc` : 'hsl(var(--muted))',
                    }}
                    title={pillar ? `${pillar.name} · ${post.suggested_publish_at?.slice(0, 10)}` : 'Unassigned'}
                  >
                    <span className="text-white drop-shadow-sm">
                      {pillar ? pillar.name.slice(0, 1).toUpperCase() : '?'}
                    </span>
                  </div>
                )
              })}
            </div>
            <span className="text-xs text-muted-foreground ml-1">Newest</span>
          </div>

          {/* Legend dots */}
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {pillars.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                {p.name}
              </div>
            ))}
          </div>

          {/* Warning messages */}
          {warningRuns.size > 0 ? (
            <div className="flex flex-col gap-2">
              {[...warningRuns.entries()].map(([pillarId, { pillarName, length }]) => (
                <div
                  key={pillarId}
                  className="flex items-start gap-2 rounded-lg border border-orange-500/25 bg-orange-500/10 px-3 py-2.5 text-sm text-orange-300"
                >
                  <span className="mt-0.5 text-orange-400">⚠</span>
                  <span>
                    {length} consecutive <strong>{pillarName}</strong> posts detected.
                    Mix in content from other pillars to keep your feed balanced and engaging.
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-green-500/25 bg-green-500/10 px-3 py-2.5 text-sm text-green-300">
              <span className="text-green-400">✓</span>
              <span>Good variety — no consecutive same-pillar runs detected in recent posts.</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
