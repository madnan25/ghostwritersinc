export default function TeamLoading() {
  return (
    <div className="container px-4 py-8">
      <div className="mb-8">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-muted" />
        <div className="mt-1.5 h-4 w-56 animate-pulse rounded bg-muted" />
      </div>

      {/* Agent cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="size-10 animate-pulse rounded-full bg-muted" />
              <div className="flex flex-col gap-1.5">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-5 w-16 animate-pulse rounded-full bg-muted" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
