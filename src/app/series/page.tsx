import { getSeries } from '@/lib/queries/series'
import { SeriesCard } from './_components/series-card'
import { CreateSeriesButton } from './_components/create-series-wizard'

export default async function SeriesPage() {
  const series = await getSeries()

  return (
    <div className="container px-4 py-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Content Series</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Multi-part content series with linked posts and sequenced publishing.
          </p>
        </div>
        <CreateSeriesButton />
      </div>

      {series.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-2xl">
            📚
          </div>
          <h3 className="mt-4 text-base font-semibold">No series yet</h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            Create your first content series to plan a multi-post narrative arc.
          </p>
          <div className="mt-6">
            <CreateSeriesButton size="default" />
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {series.map((s) => (
            <SeriesCard key={s.id} series={s} />
          ))}
        </div>
      )}
    </div>
  )
}
