import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Bot, User, Calendar, FileText } from 'lucide-react'
import { getPostById, getPostReviewEvents } from '@/lib/queries/posts'
import { ReviewChain } from './_components/review-chain'
import { LinkedInPreview } from './_components/linkedin-preview'
import { PostDetailActions } from './_components/post-detail-actions'

interface PostPageProps {
  params: Promise<{ id: string }>
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'No date set'
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

const STATUS_STYLES: Record<string, string> = {
  pending_review: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  rejected: 'bg-destructive/15 text-destructive border-destructive/25',
  draft: 'bg-muted text-muted-foreground border-border',
  agent_review: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  scheduled: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  published: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params
  const [post, reviewEvents] = await Promise.all([getPostById(id), getPostReviewEvents(id)])

  if (!post) notFound()

  const statusStyle =
    STATUS_STYLES[post.status] ?? 'bg-muted text-muted-foreground border-border'

  return (
    <div className="container px-4 py-8">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to queue
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        {/* Left column: full content + actions */}
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {post.pillar && (
                <span className="rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {post.pillar}
                </span>
              )}
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyle}`}
              >
                {post.status.replace('_', ' ')}
              </span>
            </div>
            <PostDetailActions postId={post.id} status={post.status} />
          </div>

          {/* Post content */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">Full Content</h2>
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {post.content}
            </div>
          </div>

          {/* Metadata */}
          <div className="grid gap-3 rounded-xl border border-border bg-card p-5 text-sm sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Suggested publish</div>
                <div className="mt-0.5 font-medium">{formatDate(post.suggested_publish_at)}</div>
              </div>
            </div>
            {post.brief_ref && (
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Brief reference</div>
                  <div className="mt-0.5 font-medium">{post.brief_ref}</div>
                </div>
              </div>
            )}
            {post.created_by_agent && (
              <div className="flex items-start gap-2">
                <Bot className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Written by</div>
                  <div className="mt-0.5 font-medium">{post.created_by_agent}</div>
                </div>
              </div>
            )}
            {post.reviewed_by_agent && (
              <div className="flex items-start gap-2">
                <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Agent pre-review</div>
                  <div className="mt-0.5 font-medium">{post.reviewed_by_agent}</div>
                  {post.review_notes && (
                    <div className="mt-0.5 text-xs text-muted-foreground italic">
                      &ldquo;{post.review_notes}&rdquo;
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Rejection reason (if rejected) */}
          {post.status === 'rejected' && post.rejection_reason && (
            <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-5">
              <h3 className="text-sm font-medium text-destructive">Rejection reason</h3>
              <p className="mt-1 text-sm text-muted-foreground">{post.rejection_reason}</p>
            </div>
          )}
        </div>

        {/* Right column: LinkedIn preview + review chain */}
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">LinkedIn Preview</h2>
            <LinkedInPreview content={post.content} />
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Review Chain</h2>
            <ReviewChain events={reviewEvents} />
          </div>
        </div>
      </div>
    </div>
  )
}
