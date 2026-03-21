import { cn } from '@/lib/utils'
import type { ContentPillar, Post } from '@/lib/types'
import { computeRotationWarnings, getCalendarDate, startOfCalendarWeek } from '@/lib/post-display'

interface RecentPost {
  id: string
  pillar_id: string | null
  suggested_publish_at: string | null
  scheduled_publish_at: string | null
}

interface RotationTimelineProps {
  recentPosts: RecentPost[]
  pillars: ContentPillar[]
}

function getCrowdedWeekPostIds(posts: RecentPost[], pillars: ContentPillar[]): Map<string, number> {
  const pillarIds = new Set(pillars.map((pillar) => pillar.id))
  const highlighted = new Map<string, number>()
  const weekGroups = new Map<string, RecentPost[]>()

  for (const post of posts) {
    const calendarDate = post.suggested_publish_at
    if (!calendarDate || post.scheduled_publish_at || !post.pillar_id || !pillarIds.has(post.pillar_id)) continue

    const weekStart = startOfCalendarWeek(new Date(calendarDate)).toISOString()
    const key = `${post.pillar_id}:${weekStart}`
    if (!weekGroups.has(key)) weekGroups.set(key, [])
    weekGroups.get(key)!.push(post)
  }

  for (const group of weekGroups.values()) {
    if (group.length < 3) continue
    for (const post of group) {
      highlighted.set(post.id, group.length)
    }
  }

  return highlighted
}

export function RotationTimeline({ recentPosts, pillars }: RotationTimelineProps) {
  const pillarMap = new Map(pillars.map((p) => [p.id, p]))

  // Sort chronologically (oldest first for left-to-right reading)
  const sorted = [...recentPosts]
    .filter((p) => getCalendarDate(p))
    .sort((a, b) => new Date(getCalendarDate(a)!).getTime() - new Date(getCalendarDate(b)!).getTime())
    .slice(-10)

  const highlighted = getCrowdedWeekPostIds(sorted, pillars)
  const warnings = computeRotationWarnings(
    sorted as Pick<Post, 'id' | 'pillar_id' | 'suggested_publish_at' | 'scheduled_publish_at'>[],
    pillars,
  )

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
                const calendarDate = getCalendarDate(post)
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
                    title={pillar ? `${pillar.name} · ${calendarDate?.slice(0, 10)}` : 'Unassigned'}
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
          {warnings.length > 0 ? (
            <div className="flex flex-col gap-2">
              {warnings.map((warning, index) => (
                <div
                  key={`${warning.scope ?? 'warning'}-${warning.pillar_id}-${warning.period_label ?? index}`}
                  className="flex items-start gap-2 rounded-lg border border-orange-500/25 bg-orange-500/10 px-3 py-2.5 text-sm text-orange-300"
                >
                  <span className="mt-0.5 text-orange-400">⚠</span>
                  <span>{warning.suggestion}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-green-500/25 bg-green-500/10 px-3 py-2.5 text-sm text-green-300">
              <span className="text-green-400">✓</span>
              <span>Good variety — no weekly crowding or monthly pillar overweight detected.</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
