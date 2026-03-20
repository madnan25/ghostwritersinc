import { getCalendarPosts, getPillars } from '@/lib/queries/posts'
import { computeRotationWarnings } from '@/lib/post-display'
import { ScheduleHealthPanels } from '@/components/schedule-health-panels'
import { CalendarView } from './_components/calendar-view'
import { RequestPostButton } from '../dashboard/_components/request-post-dialog'

export default async function CalendarPage() {
  // Auth handled by middleware
  const [{ scheduled, unscheduled }, pillars] = await Promise.all([
    getCalendarPosts(),
    getPillars(),
  ])

  const totalPosts = scheduled.length + unscheduled.length
  const rotationWarnings = computeRotationWarnings([...scheduled, ...unscheduled], pillars)

  return (
    <div className="container px-4 py-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Content Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalPosts === 0
              ? 'No posts scheduled yet'
              : `${scheduled.length} scheduled · ${unscheduled.length} unscheduled`}
          </p>
        </div>
        <RequestPostButton />
      </div>

      {totalPosts === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-2xl">
            📅
          </div>
          <h3 className="mt-4 text-base font-semibold">Nothing scheduled</h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            Approved or scheduled posts will appear here once they have a publish date.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <ScheduleHealthPanels warnings={rotationWarnings} />
          <CalendarView posts={scheduled} unscheduledPosts={unscheduled} pillars={pillars} />
        </div>
      )}
    </div>
  )
}
