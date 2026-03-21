'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  approvePost,
  submitForAgentReview,
  requestAgentReview,
  requestReReview,
} from '@/app/actions/posts'
import { useCopyFeedback } from '@/hooks/use-copy-feedback'
import {
  canEditPost,
  canRejectPost,
  isReviewQueueStatus,
} from '@/lib/post-actions'
import { RejectDialog } from '@/app/(app)/dashboard/_components/reject-dialog'
import { EditPostDialog } from '@/app/(app)/dashboard/_components/edit-post-dialog'
import { DeletePostDialog } from '@/app/(app)/dashboard/_components/delete-post-dialog'
import { PublishOptionsDialog } from './publish-options-dialog'
import { ApproveUnscheduledDialog } from './approve-unscheduled-dialog'
import { ReopenRejectedDialog } from './reopen-rejected-dialog'

interface PostDetailActionsProps {
  postId: string
  status: string
  content: string
  scheduledPublishAt?: string | null
  suggestedPublishAt?: string | null
  revisionCount?: number
  reviewedByAgent?: string | null
}

export function PostDetailActions({
  postId,
  status,
  content,
  scheduledPublishAt,
  suggestedPublishAt,
  revisionCount = 0,
  reviewedByAgent,
}: PostDetailActionsProps) {
  const [isPending, startTransition] = useTransition()
  const { copied: copyToast, copy } = useCopyFeedback(3000)

  function handleApprove() {
    startTransition(async () => {
      await approvePost(postId)
    })
  }

  function handleRequestReview() {
    startTransition(async () => {
      await requestAgentReview(postId)
    })
  }

  function handleRequestReReview() {
    startTransition(async () => {
      await requestReReview(postId)
    })
  }

  async function handleCopyAndOpen() {
    await copy(content)
    window.open('https://www.linkedin.com/feed/', '_blank')
  }

  function renderApproveButton(sticky = false) {
    // If post has a suggested date: Approve auto-schedules it
    // If not: show date/time picker dialog
    if (suggestedPublishAt) {
      return (
        <Button
          size="sm"
          className={sticky ? 'flex-1' : ''}
          onClick={handleApprove}
          disabled={isPending}
          title={`Will schedule for ${new Date(suggestedPublishAt).toLocaleDateString()}`}
        >
          {isPending ? 'Approving…' : 'Approve & Schedule'}
        </Button>
      )
    }

    return (
      <ApproveUnscheduledDialog
        postId={postId}
        label="Approve & Schedule"
        size="sm"
        className={sticky ? 'flex-1' : undefined}
      />
    )
  }

  function renderActions(sticky = false) {
    const wrapClass = sticky ? 'flex w-full items-center gap-2' : 'flex items-center gap-2'

    if (status === 'draft') {
      return (
        <div className={wrapClass}>
          <Button
            size="sm"
            className={sticky ? 'flex-1' : ''}
            onClick={() => startTransition(async () => { await submitForAgentReview(postId) })}
            disabled={isPending}
          >
            {isPending ? 'Submitting…' : 'Submit for Review'}
          </Button>
          <EditPostDialog postId={postId} initialContent={content} />
          <DeletePostDialog postId={postId} />
        </div>
      )
    }

    if (isReviewQueueStatus(status)) {
      return (
        <div className={wrapClass}>
          {renderApproveButton(sticky)}
          {canEditPost(status) && (
            <EditPostDialog postId={postId} initialContent={content} />
          )}
          {canRejectPost(status) && <RejectDialog postId={postId} />}
          {reviewedByAgent && (
            <Button variant="outline" size="sm" onClick={handleRequestReReview} disabled={isPending}>
              {isPending ? 'Requesting…' : 'Request Re-review'}
            </Button>
          )}
          <DeletePostDialog postId={postId} />
        </div>
      )
    }

    if (status === 'approved' || status === 'scheduled') {
      return (
        <div className="flex flex-col gap-2 w-full">
          <div className={wrapClass}>
            <PublishOptionsDialog
              postId={postId}
              status={status}
              scheduledPublishAt={scheduledPublishAt}
            />
            <Button variant="outline" size="sm" className={sticky ? 'flex-1' : ''} onClick={handleCopyAndOpen}>
              Copy & Open LinkedIn
            </Button>
            <Button variant="outline" size="sm" onClick={handleRequestReview} disabled={isPending}>
              {isPending ? 'Requesting…' : 'Request Agent Review'}
            </Button>
            <DeletePostDialog postId={postId} />
          </div>
          {copyToast && (
            <p className="text-xs text-emerald-400">Post copied to clipboard!</p>
          )}
        </div>
      )
    }

    if (status === 'rejected') {
      return (
        <div className={wrapClass}>
          {revisionCount >= 3 && (
            <ReopenRejectedDialog postId={postId} className={sticky ? 'flex-1' : undefined} />
          )}
          <Button variant="outline" size="sm" onClick={handleRequestReview} disabled={isPending}>
            {isPending ? 'Requesting…' : 'Request Agent Review'}
          </Button>
          <DeletePostDialog postId={postId} />
        </div>
      )
    }

    if (status === 'publish_failed') {
      return (
        <div className={wrapClass}>
          <PublishOptionsDialog
            postId={postId}
            status="approved"
            scheduledPublishAt={scheduledPublishAt}
          />
          <Button variant="outline" size="sm" onClick={handleRequestReview} disabled={isPending}>
            {isPending ? 'Requesting…' : 'Request Agent Review'}
          </Button>
          <DeletePostDialog postId={postId} />
        </div>
      )
    }

    return (
      <div className={wrapClass}>
        <DeletePostDialog postId={postId} />
      </div>
    )
  }

  return (
    <>
      {/* Inline actions — hidden on mobile */}
      <div className="hidden md:flex items-center">
        {renderActions(false)}
      </div>

      {/* Sticky bottom bar — mobile only, sits above the bottom nav (h-16 = 64px) */}
      <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
        style={{ paddingBottom: 'max(0.75rem, calc(env(safe-area-inset-bottom)))' }}
      >
        {renderActions(true)}
      </div>
    </>
  )
}
