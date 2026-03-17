export default function InsightsPage() {
  // Auth handled by middleware
  return (
    <div className="container px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Insights</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Post performance metrics and engagement trends
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-2xl">
          📊
        </div>
        <h3 className="mt-4 text-base font-semibold">Coming Soon</h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          Analytics and insights are on the way. You&apos;ll be able to track post performance,
          engagement trends, and audience growth here.
        </p>
      </div>
    </div>
  )
}
