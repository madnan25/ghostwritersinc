import type { ResearchPoolStats } from '@/lib/queries/research'

interface ResearchPoolStatsProps {
  stats: ResearchPoolStats
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string | number
  detail?: string
}) {
  return (
    <div className="dashboard-rail rounded-[22px] p-5">
      <p className="premium-kicker text-[0.62rem]">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground">{value}</p>
      {detail && <p className="mt-2 text-sm text-foreground/66">{detail}</p>}
    </div>
  )
}

export function ResearchPoolStats({ stats }: ResearchPoolStatsProps) {
  const avgScoreDisplay =
    stats.avg_relevance_score != null
      ? `${Math.round(stats.avg_relevance_score * 100)}%`
      : '—'

  const totalPillar =
    stats.pillar_distribution.reduce((sum, p) => sum + p.count, 0) + stats.unassigned_count

  return (
    <section className="dashboard-frame relative overflow-hidden p-6 sm:p-7">
      <div className="pointer-events-none absolute -right-16 top-0 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(155,255,82,0.13)_0%,transparent_72%)] blur-3xl" />

      <div className="mb-6">
        <p className="premium-kicker">Research Pool</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-foreground sm:text-3xl">
          Intelligence overview
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-foreground/66">
          Aggregated stats from the research pool — items ready to be consumed into briefs and posts.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Items" value={stats.total} detail="in the pool" />
        <StatCard
          label="Available"
          value={stats.by_status.new}
          detail="new — ready to use"
        />
        <StatCard
          label="Consumed"
          value={stats.by_status.consumed}
          detail="used in posts"
        />
        <StatCard
          label="Avg Score"
          value={avgScoreDisplay}
          detail={
            stats.scored_count > 0
              ? `from ${stats.scored_count} scored item${stats.scored_count !== 1 ? 's' : ''}`
              : 'no scored items yet'
          }
        />
      </div>

      {/* Pillar distribution */}
      {stats.pillar_distribution.length > 0 && (
        <div className="dashboard-rail mt-5 p-4 sm:p-5">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.24em] text-foreground/56">
            Pillar Distribution
          </p>
          <div className="space-y-3">
            {stats.pillar_distribution.map((pillar) => {
              const pct = totalPillar > 0 ? Math.round((pillar.count / totalPillar) * 100) : 0
              return (
                <div key={pillar.pillar_id} className="flex items-center gap-3">
                  <div className="flex min-w-[120px] items-center gap-2 shrink-0">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ backgroundColor: pillar.color }}
                    />
                    <span className="truncate text-sm font-medium text-foreground">
                      {pillar.name}
                    </span>
                  </div>
                  <div className="flex flex-1 items-center gap-3">
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-background/58">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(pct, pillar.count > 0 ? 4 : 0)}%`,
                          backgroundColor: pillar.color,
                        }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs text-foreground/60">
                      {pillar.count} · {pct}%
                    </span>
                  </div>
                </div>
              )
            })}
            {stats.unassigned_count > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex min-w-[120px] items-center gap-2 shrink-0">
                  <span className="inline-block size-2 rounded-full bg-foreground/20" />
                  <span className="text-sm text-foreground/56">Unassigned</span>
                </div>
                <div className="flex flex-1 items-center gap-3">
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-background/58">
                    <div
                      className="h-full rounded-full bg-foreground/20"
                      style={{
                        width: `${Math.max(
                          totalPillar > 0
                            ? Math.round((stats.unassigned_count / totalPillar) * 100)
                            : 0,
                          4
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs text-foreground/60">
                    {stats.unassigned_count} ·{' '}
                    {totalPillar > 0
                      ? Math.round((stats.unassigned_count / totalPillar) * 100)
                      : 0}
                    %
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
