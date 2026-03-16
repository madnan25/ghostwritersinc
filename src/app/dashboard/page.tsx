import { getPendingReviewPosts } from '@/lib/queries/posts'
import { PostCard } from './_components/post-card'

export default async function DashboardPage() {
  const posts = await getPendingReviewPosts()

  return (
    <div className="container px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Content Queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {posts.length === 0
            ? 'No posts pending review'
            : `${posts.length} post${posts.length !== 1 ? 's' : ''} pending your review — ordered by suggested publish date`}
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-2xl">
            ✓
          </div>
          <h3 className="mt-4 text-base font-semibold">All caught up</h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            No posts are waiting for your review right now. Your agents are working on the next
            batch.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
