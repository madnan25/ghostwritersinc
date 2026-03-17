export default function DashboardLoading() {
  return (
    <div className="container px-4 py-8">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="mt-1.5 h-4 w-64 animate-pulse rounded bg-muted" />
      </div>

      {/* Pillar distribution bar skeleton */}
      <div className="mb-6 flex flex-col gap-2">
        <div className="h-3 w-28 animate-pulse rounded bg-muted" />
        <div className="h-2.5 w-full animate-pulse rounded-full bg-muted" />
        <div className="flex gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-3 w-20 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>

      {/* Filter pills skeleton */}
      <div className="mb-6 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-7 w-20 animate-pulse rounded-full bg-muted" />
        ))}
      </div>

      {/* Tab bar skeleton */}
      <div className="mb-6 flex gap-1 rounded-lg bg-muted/40 p-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-24 animate-pulse rounded-md bg-muted" />
        ))}
      </div>

      {/* Post card grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
            <div className="flex gap-2">
              <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="h-3.5 w-full animate-pulse rounded bg-muted" />
              <div className="h-3.5 w-5/6 animate-pulse rounded bg-muted" />
              <div className="h-3.5 w-4/6 animate-pulse rounded bg-muted" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="h-3 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-12 w-full animate-pulse rounded-lg bg-muted" />
            <div className="flex gap-2">
              <div className="h-7 w-20 animate-pulse rounded-lg bg-muted" />
              <div className="h-7 w-16 animate-pulse rounded-lg bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
