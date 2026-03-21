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
import { DeletePostDialog } from './delete-post-dialog'

interface PostCardActionsProps {
  postId: string
  status: string
  content: string
  compact?: boolean
}

export function PostCardActions({ postId, status, content, compact = false }: PostCardActionsProps) {
  const [isPending, startTransition] = useTransition()

  /* Full-size cards keep original sizing; pipeline compact cards use tighter sizing */
  const btnClass = compact
    ? 'h-7 px-2.5 text-[0.72rem]'
    : 'min-h-[40px] flex-1 sm:flex-none sm:min-h-0'

  const outlineCls = `${btnClass} border-border/55 bg-transparent text-foreground/68 hover:border-primary/25 hover:bg-background/30 hover:text-foreground`
  const wrap = compact ? 'flex w-full flex-wrap items-center gap-1.5' : 'flex w-full items-center gap-2'

  function handleApprove() {
    startTransition(async () => { await approvePost(postId) })
  }

  if (status === 'draft') {
    return (
      <div className={wrap}>
        <Button size="sm" variant="outline" className={outlineCls}
          onClick={() => startTransition(async () => { await submitForAgentReview(postId) })}
          disabled={isPending}>
          {isPending ? 'Submitting…' : 'Submit'}
        </Button>
        <EditPostDialog postId={postId} initialContent={content} className={btnClass} />
        <DeletePostDialog postId={postId} className={btnClass} />
      </div>
    )
  }

  if (status === 'approved') {
    return (
      <div className={wrap}>
        {canEditPost(status) && <EditPostDialog postId={postId} initialContent={content} className={btnClass} />}
        <DeletePostDialog postId={postId} className={btnClass} />
      </div>
    )
  }

  if (!isReviewQueueStatus(status)) {
    return (
      <div className={wrap}>
        <DeletePostDialog postId={postId} className={btnClass} />
      </div>
    )
  }

  /* pending_review — show Approve prominently, then secondary actions */
  return (
    <div className="flex w-full flex-col gap-1.5">
      <Button size="sm" variant="outline"
        className={`w-full ${compact ? 'h-7 text-[0.72rem]' : 'min-h-[40px]'} border-primary/30 bg-primary/8 text-primary/90 hover:border-primary/50 hover:bg-primary/14 hover:text-primary`}
        onClick={handleApprove} disabled={isPending}>
        {isPending ? 'Approving…' : getApproveActionLabel()}
      </Button>
      <div className={wrap}>
        {canEditPost(status) && <EditPostDialog postId={postId} initialContent={content} className={btnClass} />}
        {canRejectPost(status) && <RejectDialog postId={postId} className={btnClass} />}
        <DeletePostDialog postId={postId} className={btnClass} />
      </div>
    </div>
  )
}
