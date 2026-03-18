'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  approvePost,
  publishToLinkedIn,
  submitForAgentReview,
  submitForClientReview,
} from '@/app/actions/posts'
import { useCopyFeedback } from '@/hooks/use-copy-feedback'
import {
  canEditPost,
  canRejectPost,
  getApproveActionLabel,
  isReviewQueueStatus,
} from '@/lib/post-actions'
import { RejectDialog } from '@/app/dashboard/_components/reject-dialog'
import { EditPostDialog } from '@/app/dashboard/_components/edit-post-dialog'

interface PostDetailActionsProps {
  postId: string
  status: string
  content: string
}

export function PostDetailActions({ postId, status, content }: PostDetailActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [publishError, setPublishError] = useState<string | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const { copied: copyToast, copy } = useCopyFeedback(3000)
  const router = useRouter()

  function handleApprove() {
    startTransition(async () => {
      if (status === 'agent_review') {
        await submitForClientReview(postId, 'client')
      } else {
        await approvePost(postId)
      }
      router.push('/dashboard')
    })
  }

  async function handlePublish() {
    setPublishError(null)
    setIsPublishing(true)
    try {
      const result = await publishToLinkedIn(postId)
      if (result.success) {
        router.push('/dashboard')
      } else {
        setPublishError(result.error ?? 'Failed to publish')
      }
    } catch {
      setPublishError('An unexpected error occurred')
    } finally {
      setIsPublishing(false)
    }
  }

  async function handleCopyAndOpen() {
    await copy(content)
    window.open('https://www.linkedin.com/feed/', '_blank')
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
        </div>
      )
    }

    if (isReviewQueueStatus(status)) {
      return (
        <div className={wrapClass}>
          <Button size="sm" className={sticky ? 'flex-1' : ''} onClick={handleApprove} disabled={isPending}>
            {isPending ? 'Approving…' : getApproveActionLabel(status)}
          </Button>
          {canEditPost(status) && (
            <EditPostDialog postId={postId} initialContent={content} />
          )}
          {canRejectPost(status) && <RejectDialog postId={postId} />}
        </div>
      )
    }

    if (status === 'approved' || status === 'scheduled') {
      return (
        <div className="flex flex-col gap-2 w-full">
          <div className={wrapClass}>
            <Button
              size="sm"
              className={sticky ? 'flex-1' : ''}
              onClick={handlePublish}
              disabled={isPublishing}
            >
              {isPublishing ? 'Publishing…' : 'Publish to LinkedIn'}
            </Button>
            <Button variant="outline" size="sm" className={sticky ? 'flex-1' : ''} onClick={handleCopyAndOpen}>
              Copy & Open LinkedIn
            </Button>
          </div>
          {publishError && (
            <p className="text-xs text-destructive">{publishError}</p>
          )}
          {copyToast && (
            <p className="text-xs text-emerald-400">Post copied to clipboard!</p>
          )}
        </div>
      )
    }

    return (
      <div className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs text-muted-foreground capitalize">
        {status.replace('_', ' ')}
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
