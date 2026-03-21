'use client'

import type { WhatsWorkingSummary } from '@/lib/performance-analysis'

interface WhatsWorkingCardProps {
  summary: WhatsWorkingSummary | null
  updatedAt: string | null
}

function StatBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  )
}

export function WhatsWorkingCard({ summary, updatedAt }: WhatsWorkingCardProps) {
  if (!summary) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-lg">
            💡
          </div>
          <div>
            <h3 className="text-sm font-semibold">What&apos;s Working</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Strategist insights will appear here once you have at least 5 published posts with
              performance data. Keep publishing!
            </p>
          </div>
        </div>
      </div>
    )
  }

  const formattedDate = updatedAt
    ? new Date(updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-lg">
            💡
          </div>
          <div>
            <h3 className="text-sm font-semibold">What&apos;s Working</h3>
            <p className="text-xs text-muted-foreground">
              Based on {summary.data_points} post{summary.data_points !== 1 ? 's' : ''} with performance data
              {formattedDate ? ` · Updated ${formattedDate}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* Overall stats */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatBadge label="Total posts" value={summary.engagement_trends.total_posts} />
          <StatBadge label="Avg impressions" value={summary.engagement_trends.avg_impressions.toLocaleString()} />
          <StatBadge label="Avg engagement" value={summary.engagement_trends.avg_engagement} />
        </div>

        {/* Top performing pillars */}
        {summary.top_pillars.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Top Pillars by Engagement</p>
            <div className="flex flex-col gap-1.5">
              {summary.top_pillars.slice(0, 3).map((pillar, i) => (
                <div key={pillar.pillar_id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="flex size-4 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="font-medium">{pillar.pillar_name}</span>
                    <span className="text-muted-foreground">({pillar.post_count} post{pillar.post_count !== 1 ? 's' : ''})</span>
                  </div>
                  <span className="font-semibold text-green-400">{pillar.avg_engagement} eng</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Best posting days */}
        {summary.best_posting_days.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Best Posting Days</p>
            <div className="flex flex-wrap gap-1.5">
              {summary.best_posting_days.slice(0, 3).map((day) => (
                <div
                  key={day.day}
                  className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs"
                >
                  <span className="font-medium">{day.day}</span>
                  <span className="ml-1.5 text-muted-foreground">{day.avg_engagement} avg eng</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Highest performing post */}
        {summary.engagement_trends.highest_performing_post && (
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
            <p className="font-medium text-muted-foreground">Highest performing post</p>
            <p className="mt-0.5 font-semibold">
              {summary.engagement_trends.highest_performing_post.title ?? 'Untitled'}{' '}
              <span className="font-normal text-muted-foreground">
                — {summary.engagement_trends.highest_performing_post.engagement} engagements
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
