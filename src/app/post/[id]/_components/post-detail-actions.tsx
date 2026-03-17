'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { approvePost, publishToLinkedIn, submitForAgentReview } from '@/app/actions/posts'
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
  const [copyToast, setCopyToast] = useState(false)
  const router = useRouter()

  function handleApprove() {
    startTransition(async () => {
      await approvePost(postId)
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

  function handleCopyAndOpen() {
    navigator.clipboard.writeText(content)
    setCopyToast(true)
    setTimeout(() => setCopyToast(false), 3000)
    window.open('https://www.linkedin.com/feed/', '_blank')
  }

  if (status === 'draft') {
    return (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => startTransition(async () => { await submitForAgentReview(postId) })}
          disabled={isPending}
        >
          {isPending ? 'Submitting…' : 'Submit for Review'}
        </Button>
        <EditPostDialog postId={postId} initialContent={content} />
      </div>
    )
  }

  if (status === 'pending_review') {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleApprove} disabled={isPending}>
          {isPending ? 'Approving…' : 'Approve'}
        </Button>
        <RejectDialog postId={postId} />
      </div>
    )
  }

  if (status === 'approved' || status === 'scheduled') {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={isPublishing}
          >
            {isPublishing ? 'Publishing…' : 'Publish to LinkedIn'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyAndOpen}>
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
