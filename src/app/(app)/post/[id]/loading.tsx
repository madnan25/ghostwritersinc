export default function PostLoading() {
  return (
    <div className="container px-4 py-8">
      {/* Back link skeleton */}
      <div className="mb-6 h-4 w-32 animate-pulse rounded bg-muted" />

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Main content */}
        <div className="flex flex-col gap-6">
          {/* Status + pillar badges */}
          <div className="flex gap-2">
            <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
          </div>

          {/* Post content */}
          <div className="flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`h-4 animate-pulse rounded bg-muted ${i === 7 ? 'w-1/2' : 'w-full'}`} />
            ))}
          </div>

          {/* Review chain */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 h-4 w-28 animate-pulse rounded bg-muted" />
            <div className="flex flex-col gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="size-8 animate-pulse rounded-full bg-muted" />
                  <div className="flex flex-col gap-1">
                    <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comment section */}
          <div className="flex flex-col gap-3">
            <div className="h-5 w-24 animate-pulse rounded bg-muted" />
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <div className="mb-2 flex items-center gap-2">
                  <div className="size-6 animate-pulse rounded-full bg-muted" />
                  <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-3.5 w-full animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {/* LinkedIn preview skeleton */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`h-3.5 animate-pulse rounded bg-muted ${i === 4 ? 'w-1/2' : 'w-full'}`} />
              ))}
            </div>
          </div>

          {/* Actions skeleton */}
          <div className="flex flex-col gap-2">
            <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
            <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    </div>
  )
}
