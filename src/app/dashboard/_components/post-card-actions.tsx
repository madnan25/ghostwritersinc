'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { approvePost } from '@/app/actions/posts'
import { RejectDialog } from './reject-dialog'

interface PostCardActionsProps {
  postId: string
  status: string
}

export function PostCardActions({ postId, status }: PostCardActionsProps) {
  const [isPending, startTransition] = useTransition()

  function handleApprove() {
    startTransition(async () => {
      await approvePost(postId)
    })
  }

  if (status === 'approved') {
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" nativeButton={false} render={<Link href={`/post/${postId}`} />}>
          Publish
        </Button>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/post/${postId}`} />}>
          View
        </Button>
      </div>
    )
  }

  if (status !== 'pending_review') {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={handleApprove} disabled={isPending}>
        {isPending ? 'Approving…' : 'Approve'}
      </Button>
      <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/post/${postId}`} />}>
        Edit
      </Button>
      <RejectDialog postId={postId} />
    </div>
  )
}
