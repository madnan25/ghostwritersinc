export default function DashboardLoading() {
  return (
    <div className="premium-page space-y-6">
      <section className="dashboard-frame p-7 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div>
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-12 w-4/5 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-6 w-3/4 animate-pulse rounded bg-muted" />
          </div>
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="dashboard-rail rounded-[22px] p-5">
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                <div className="mt-3 h-8 w-16 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-4 w-40 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dashboard-frame p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-8 w-60 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-10 w-40 animate-pulse rounded-full bg-muted" />
        </div>

        <div className="space-y-4">
          <div className="dashboard-rail p-4">
            <div className="mb-3 h-3 w-16 animate-pulse rounded bg-muted" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-10 w-28 animate-pulse rounded-full bg-muted" />
              ))}
            </div>
          </div>

          <div className="dashboard-rail p-4">
            <div className="mb-3 h-3 w-16 animate-pulse rounded bg-muted" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 w-32 animate-pulse rounded-full bg-muted" />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={i === 0 ? 'md:col-span-2 xl:col-span-2' : undefined}
          >
            <div className="editorial-card flex h-full flex-col gap-5 p-6">
              <div className="flex gap-2">
                <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
              </div>
              <div className="space-y-2">
                <div className="h-6 w-4/5 animate-pulse rounded bg-muted" />
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-36 animate-pulse rounded bg-muted" />
                <div className="h-3 w-28 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
