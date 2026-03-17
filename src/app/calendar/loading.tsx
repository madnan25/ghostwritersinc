export default function CalendarLoading() {
  return (
    <div className="container px-4 py-8">
      <div className="mb-8">
        <div className="h-8 w-44 animate-pulse rounded-lg bg-muted" />
        <div className="mt-1.5 h-4 w-48 animate-pulse rounded bg-muted" />
      </div>

      {/* Month header + nav */}
      <div className="mb-4 flex items-center justify-between">
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
          <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="mb-2 grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-muted" />
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="flex min-h-[80px] flex-col gap-1 rounded-lg border border-border p-1.5">
            <div className="h-4 w-5 animate-pulse rounded bg-muted" />
            {i % 5 === 0 && <div className="h-5 w-full animate-pulse rounded bg-muted" />}
            {i % 7 === 2 && <div className="h-5 w-full animate-pulse rounded bg-muted" />}
          </div>
        ))}
      </div>
    </div>
  )
}
