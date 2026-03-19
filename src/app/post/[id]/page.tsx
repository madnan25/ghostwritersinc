import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Bot, User, Calendar, FileText, MessageSquare } from 'lucide-react'
import { formatPostDate, STATUS_STYLES } from '@/lib/post-display'
import { getPostById, getPostReviewEvents, getPostComments } from '@/lib/queries/posts'
import { ReviewChain } from './_components/review-chain'
import { LinkedInPreview } from './_components/linkedin-preview'
import { PostDetailActions } from './_components/post-detail-actions'
import { CommentablePostContent } from './_components/commentable-post-content'
import { CommentThread } from './_components/comment-thread'
import { OverallCommentForm } from './_components/overall-comment-form'

interface PostPageProps {
  params: Promise<{ id: string }>
}

export default async function PostPage({ params }: PostPageProps) {
  // Auth handled by middleware; fetch data directly
  const { id } = await params
  const [post, reviewEvents, comments] = await Promise.all([
    getPostById(id),
    getPostReviewEvents(id),
    getPostComments(id),
  ])

  if (!post) notFound()

  const statusStyle =
    STATUS_STYLES[post.status] ?? 'bg-muted text-muted-foreground border-border'

  return (
    <div className="premium-page pb-28 md:pb-8">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/35 px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to queue
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        {/* Left column: full content + actions */}
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="dashboard-frame flex flex-wrap items-start justify-between gap-4 p-6 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[0.72rem] font-medium uppercase tracking-[0.16em] ${statusStyle}`}
              >
                {post.status.replace('_', ' ')}
              </span>
            </div>
            {/* PostDetailActions renders inline on md+ and sticky-bottom on mobile */}
            <PostDetailActions postId={post.id} status={post.status} content={post.content} scheduledPublishAt={post.scheduled_publish_at} />
          </div>

          {/* Post content with inline commenting */}
          <div className="dashboard-frame p-6 sm:p-7">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.24em] text-primary/72">
              Full Content
              <span className="ml-2 font-normal text-[0.72rem] tracking-normal text-muted-foreground/70">
                — select text to leave an inline comment
              </span>
            </h2>
            <CommentablePostContent postId={post.id} content={post.content} comments={comments} />
          </div>

          {/* Comment thread + overall comment form */}
          <div className="dashboard-frame p-6 sm:p-7">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-[0.24em] text-primary/72">
              <MessageSquare className="size-4" />
              Comments
              {comments.length > 0 && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[0.72rem] tracking-normal text-foreground">
                  {comments.length}
                </span>
              )}
            </h2>
            <CommentThread comments={comments} />
            <div className="mt-4 pt-4 border-t border-border">
              <OverallCommentForm postId={post.id} />
            </div>
          </div>

          {/* Metadata */}
          <div className="dashboard-rail grid grid-cols-1 gap-4 p-6 text-sm sm:grid-cols-2">
            {post.status === 'scheduled' && post.scheduled_publish_at ? (
              <div className="flex items-start gap-2">
                <Calendar className="mt-0.5 size-4 shrink-0 text-sky-400" />
                <div>
                  <div className="text-[0.72rem] uppercase tracking-[0.18em] text-sky-400/80">Scheduled for</div>
                  <div className="mt-0.5 font-medium text-sky-300">{formatPostDate(post.scheduled_publish_at)}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-[0.72rem] uppercase tracking-[0.18em] text-primary/70">Suggested publish</div>
                  <div className="mt-0.5 font-medium">{formatPostDate(post.suggested_publish_at)}</div>
                </div>
              </div>
            )}
            {post.brief_ref && (
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-[0.72rem] uppercase tracking-[0.18em] text-primary/70">Brief reference</div>
                  <div className="mt-0.5 font-medium">{post.brief_ref}</div>
                </div>
              </div>
            )}
            {post.created_by_agent && (
              <div className="flex items-start gap-2">
                <Bot className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-[0.72rem] uppercase tracking-[0.18em] text-primary/70">Written by</div>
                  <div className="mt-0.5 font-medium">{post.created_by_agent}</div>
                </div>
              </div>
            )}
            {post.reviewed_by_agent && (
              <div className="flex items-start gap-2">
                <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-[0.72rem] uppercase tracking-[0.18em] text-primary/70">Agent pre-review</div>
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
            <div className="rounded-[24px] border border-destructive/25 bg-destructive/10 p-6">
              <h3 className="text-sm font-medium text-destructive">Rejection reason</h3>
              <p className="mt-1 text-sm text-muted-foreground">{post.rejection_reason}</p>
            </div>
          )}
        </div>

        {/* Right column: LinkedIn preview + review chain */}
        <div className="flex flex-col gap-6">
          <div className="dashboard-frame p-5 sm:p-6">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.24em] text-primary/72">LinkedIn Preview</h2>
            <LinkedInPreview content={post.content} />
          </div>

          <div className="dashboard-frame p-5 sm:p-6">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.24em] text-primary/72">Review Chain</h2>
            <ReviewChain events={reviewEvents} />
          </div>
        </div>
      </div>
    </div>
  )
}
