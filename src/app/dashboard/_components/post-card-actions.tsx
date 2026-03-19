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

const defaultBtnClass = 'min-h-[40px] flex-1 sm:flex-none sm:min-h-0'
const compactBtnClass = 'min-h-[36px] px-3 text-[0.76rem] sm:min-h-0'

export function PostCardActions({ postId, status, content, compact = false }: PostCardActionsProps) {
  const [isPending, startTransition] = useTransition()
  const btnClass = compact ? compactBtnClass : defaultBtnClass
  const primaryBtnClass = `${btnClass} border-border/60 bg-transparent text-foreground/72 hover:border-primary/22 hover:bg-background/34 hover:text-foreground`
  const wrapClass = compact ? 'flex w-full flex-wrap items-center gap-2' : 'flex w-full items-center gap-2'

  function handleApprove() {
    startTransition(async () => {
      await approvePost(postId)
    })
  }

  if (status === 'draft') {
    return (
      <div className={wrapClass}>
        <Button
          size="sm"
          variant="outline"
          className={primaryBtnClass}
          onClick={() => startTransition(async () => { await submitForAgentReview(postId) })}
          disabled={isPending}
        >
          {isPending ? 'Submitting…' : 'Submit for Review'}
        </Button>
        <EditPostDialog postId={postId} initialContent={content} className={btnClass} />
        <DeletePostDialog postId={postId} className={btnClass} />
      </div>
    )
  }

  if (status === 'approved') {
    return (
      <div className={compact ? 'flex flex-wrap items-center gap-2' : 'flex items-center gap-2'}>
        {canEditPost(status) && <EditPostDialog postId={postId} initialContent={content} className={btnClass} />}
        <DeletePostDialog postId={postId} className={btnClass} />
      </div>
    )
  }

  if (!isReviewQueueStatus(status)) {
    return (
      <div className={compact ? 'flex flex-wrap items-center gap-2' : 'flex items-center gap-2'}>
        <DeletePostDialog postId={postId} className={btnClass} />
      </div>
    )
  }

  return (
    <div className={wrapClass}>
      <Button size="sm" variant="outline" className={primaryBtnClass} onClick={handleApprove} disabled={isPending}>
        {isPending ? 'Approving…' : getApproveActionLabel()}
      </Button>
      {canEditPost(status) && (
        <EditPostDialog postId={postId} initialContent={content} className={btnClass} />
      )}
      {canRejectPost(status) && <RejectDialog postId={postId} className={btnClass} />}
      <DeletePostDialog postId={postId} className={btnClass} />
    </div>
  )
}
