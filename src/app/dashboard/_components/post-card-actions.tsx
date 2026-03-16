'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { approvePost } from '@/app/actions/posts'
import { RejectDialog } from './reject-dialog'

interface PostCardActionsProps {
  postId: string
}

export function PostCardActions({ postId }: PostCardActionsProps) {
  const [isPending, startTransition] = useTransition()

  function handleApprove() {
    startTransition(async () => {
      await approvePost(postId)
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={handleApprove} disabled={isPending}>
        {isPending ? 'Approving…' : 'Approve'}
      </Button>
      <Button variant="outline" size="sm" render={<Link href={`/post/${postId}`} />}>
        Edit
      </Button>
      <RejectDialog postId={postId} />
    </div>
  )
}
