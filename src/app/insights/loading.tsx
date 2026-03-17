export default function InsightsLoading() {
  return (
    <div className="container px-4 py-8">
      <div className="mb-8">
        <div className="h-8 w-28 animate-pulse rounded-lg bg-muted" />
        <div className="mt-1.5 h-4 w-72 animate-pulse rounded bg-muted" />
      </div>

      {/* Stats row */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5">
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            <div className="h-7 w-16 animate-pulse rounded bg-muted" />
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 h-5 w-36 animate-pulse rounded bg-muted" />
        <div className="h-48 w-full animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  )
}
