'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { publishPost } from '@/app/actions/posts'
import { cn } from '@/lib/utils'

interface Props {
  postId: string
  status: string
}

export function PostNowButton({ postId, status }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const overlayRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  if (status !== 'approved') return null

  function handleOpen() {
    setError(null)
    setOpen(true)
  }

  function handleClose() {
    if (isPending) return
    setOpen(false)
    setError(null)
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) handleClose()
  }

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      try {
        await publishPost(postId)
        setOpen(false)
        router.push('/dashboard')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to publish. Please try again.')
      }
    })
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className={cn(
          'rounded-lg bg-[#0a66c2] px-3 py-1.5 text-sm font-medium text-white',
          'transition-opacity hover:opacity-90',
        )}
      >
        Post to LinkedIn
      </button>

      {open && (
        <div
          ref={overlayRef}
          onClick={handleOverlayClick}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h2 className="text-base font-semibold">Publish to LinkedIn?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This will post the content to your LinkedIn profile immediately and cannot be undone.
            </p>

            {error && (
              <div className="mt-3 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={handleClose}
                disabled={isPending}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className="rounded-lg bg-[#0a66c2] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {isPending ? 'Publishing…' : 'Yes, post now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
