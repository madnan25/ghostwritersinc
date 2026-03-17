import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAllPosts } from '@/lib/queries/posts'
import { PostGrid } from './_components/post-grid'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const posts = await getAllPosts()
  const needsReview = posts.filter((p) => p.status === 'pending_review' || p.status === 'agent_review').length

  return (
    <div className="container px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Content Queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {posts.length === 0
            ? 'No posts yet — your agents are working on the next batch'
            : needsReview > 0
              ? `${needsReview} post${needsReview !== 1 ? 's' : ''} need${needsReview === 1 ? 's' : ''} your review`
              : `${posts.length} post${posts.length !== 1 ? 's' : ''} total — all caught up`}
        </p>
      </div>

      <PostGrid posts={posts} />
    </div>
  )
}
