export default function ResearchLoading() {
  return (
    <div className="container px-4 py-8">
      <div className="mb-8">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-muted" />
        <div className="mt-1.5 h-4 w-80 animate-pulse rounded bg-muted" />
      </div>

      <div className="mx-auto max-w-2xl space-y-6">
        {/* Instructions card skeleton */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-3 h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-3.5 w-full animate-pulse rounded bg-muted" />
            ))}
          </div>
        </div>

        {/* Upload list skeleton */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 h-5 w-32 animate-pulse rounded bg-muted" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex flex-col gap-1.5">
                  <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
