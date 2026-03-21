export default function SettingsLoading() {
  return (
    <div className="container max-w-2xl px-4 py-8">
      <div className="mb-6 h-8 w-24 animate-pulse rounded-lg bg-muted" />

      {/* Form sections */}
      <div className="flex flex-col gap-6">
        {/* Profile section */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 h-5 w-20 animate-pulse rounded bg-muted" />
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="h-3.5 w-12 animate-pulse rounded bg-muted" />
              <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="h-3.5 w-12 animate-pulse rounded bg-muted" />
              <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
            </div>
          </div>
        </div>

        {/* LinkedIn section */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 h-5 w-36 animate-pulse rounded bg-muted" />
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1.5">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-3.5 w-48 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-8 w-24 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <div className="h-8 w-24 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  )
}
