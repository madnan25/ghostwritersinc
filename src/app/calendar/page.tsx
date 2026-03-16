import { getAllPosts } from '@/lib/queries/posts'
import { CalendarView } from './_components/calendar-view'

export default async function CalendarPage() {
  const posts = await getAllPosts()

  return (
    <div className="container px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Content Calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Schedule view of all posts — color-coded by content pillar
        </p>
      </div>
      <CalendarView posts={posts} />
    </div>
  )
}
