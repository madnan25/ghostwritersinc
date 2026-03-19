'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { approvePost, submitForAgentReview } from '@/app/actions/posts'
import {
  canEditPost,
  canRejectPost,
  getApproveActionLabel,
  isReviewQueueStatus,
} from '@/lib/post-actions'
import { RejectDialog } from './reject-dialog'
import { EditPostDialog } from './edit-post-dialog'
import { ScheduleDialog } from './schedule-dialog'

interface PostCardActionsProps {
  postId: string
  status: string
  content: string
  suggestedPublishAt?: string | null
}

// Shared button class for consistent 44px touch targets on mobile
const btnClass = 'min-h-[40px] flex-1 sm:flex-none sm:min-h-0'
const primaryBtnClass = `${btnClass} border-border/60 bg-transparent text-foreground/72 hover:border-primary/22 hover:bg-background/34 hover:text-foreground`

export function PostCardActions({ postId, status, content, suggestedPublishAt }: PostCardActionsProps) {
  const [isPending, startTransition] = useTransition()

  function handleApprove() {
    startTransition(async () => {
      await approvePost(postId)
    })
  }

  if (status === 'draft') {
    return (
      <div className="flex w-full items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className={primaryBtnClass}
          onClick={() => startTransition(async () => { await submitForAgentReview(postId) })}
          disabled={isPending}
        >
          {isPending ? 'Submitting…' : 'Submit for Review'}
        </Button>
        <EditPostDialog postId={postId} initialContent={content} />
      </div>
    )
  }

  if (status === 'approved') {
    return (
      <div className="flex w-full items-center gap-2">
        <ScheduleDialog postId={postId} suggestedPublishAt={suggestedPublishAt} />
        {canEditPost(status) && <EditPostDialog postId={postId} initialContent={content} />}
      </div>
    )
  }

  if (!isReviewQueueStatus(status)) {
    return null
  }

  return (
    <div className="flex w-full items-center gap-2">
      <Button size="sm" variant="outline" className={primaryBtnClass} onClick={handleApprove} disabled={isPending}>
        {isPending ? 'Approving…' : getApproveActionLabel()}
      </Button>
      {canEditPost(status) && (
        <EditPostDialog postId={postId} initialContent={content} />
      )}
      {canRejectPost(status) && <RejectDialog postId={postId} />}
    </div>
  )
}
