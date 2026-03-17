'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { approvePost, submitForAgentReview, submitForClientReview } from '@/app/actions/posts'
import { RejectDialog } from './reject-dialog'
import { EditPostDialog } from './edit-post-dialog'

interface PostCardActionsProps {
  postId: string
  status: string
  content: string
}

// Shared button class for consistent 44px touch targets on mobile
const btnClass = 'min-h-[44px] flex-1 sm:flex-none sm:min-h-0'

export function PostCardActions({ postId, status, content }: PostCardActionsProps) {
  const [isPending, startTransition] = useTransition()

  function handleApprove() {
    startTransition(async () => {
      if (status === 'agent_review') {
        await submitForClientReview(postId, 'client')
      } else {
        await approvePost(postId)
      }
    })
  }

  if (status === 'approved') {
    return (
      <div className="flex items-center gap-2">
        <EditPostDialog postId={postId} initialContent={content} />
      </div>
    )
  }

  if (status === 'draft') {
    return (
      <div className="flex items-center gap-2 w-full">
        <Button
          size="sm"
          className={btnClass}
          onClick={() => startTransition(async () => { await submitForAgentReview(postId) })}
          disabled={isPending}
        >
          {isPending ? 'Submitting…' : 'Submit for Review'}
        </Button>
        <EditPostDialog postId={postId} initialContent={content} />
      </div>
    )
  }

  if (status !== 'pending_review' && status !== 'agent_review') {
    return null
  }

  return (
    <div className="flex items-center gap-2 w-full">
      <Button size="sm" className={btnClass} onClick={handleApprove} disabled={isPending}>
        {isPending ? 'Approving…' : status === 'agent_review' ? 'Approve for Review' : 'Approve'}
      </Button>
      <EditPostDialog postId={postId} initialContent={content} />
      <RejectDialog postId={postId} />
    </div>
  )
}
