'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { approvePost } from '@/app/actions/posts'
import { RejectDialog } from '@/app/dashboard/_components/reject-dialog'

interface PostDetailActionsProps {
  postId: string
  status: string
}

export function PostDetailActions({ postId, status }: PostDetailActionsProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleApprove() {
    startTransition(async () => {
      await approvePost(postId)
      router.push('/dashboard')
    })
  }

  if (status !== 'pending_review') {
    return (
      <div className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs text-muted-foreground capitalize">
        {status.replace('_', ' ')}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={handleApprove} disabled={isPending}>
        {isPending ? 'Approving…' : 'Approve'}
      </Button>
      <RejectDialog postId={postId} />
    </div>
  )
}
